const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { format } = require('date-fns');
const db = require('../models/db');

// Configure multer for audio file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const today = format(new Date(), 'yyyy-MM-dd');
        const uploadPath = path.join(process.env.AUDIO_STORAGE_PATH || './uploads', today);

        // Create directory if it doesn't exist
        fs.mkdirSync(uploadPath, { recursive: true });
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const timestamp = format(new Date(), 'HHmmss');
        const ext = path.extname(file.originalname) || '.wav';
        cb(null, `audio_${timestamp}_${uuidv4().slice(0, 8)}${ext}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit per chunk
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['audio/wav', 'audio/wave', 'audio/x-wav', 'audio/opus', 'audio/ogg'];
        if (allowedTypes.includes(file.mimetype) || file.originalname.endsWith('.wav') || file.originalname.endsWith('.opus')) {
            cb(null, true);
        } else {
            cb(new Error('Invalid audio format. Allowed: WAV, OPUS'), false);
        }
    }
});

// Upload audio chunk from Raspberry Pi
router.post('/upload', upload.single('audio'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No audio file provided' });
        }

        const { piId, sessionId, timestamp, audioLevel } = req.body;

        // Get or create today's session
        let currentSessionId = sessionId;
        if (!currentSessionId) {
            const today = format(new Date(), 'yyyy-MM-dd');
            const sessionResult = await db.query(
                `INSERT INTO sleep_sessions (id, date, bed_time) 
         VALUES ($1, $2, NOW()) 
         ON CONFLICT (date) DO UPDATE SET id = sleep_sessions.id
         RETURNING id`,
                [uuidv4(), today]
            );
            currentSessionId = sessionResult.rows[0].id;
        }

        // Store audio chunk reference
        await db.query(
            `INSERT INTO audio_chunks (id, session_id, file_path, recorded_at, audio_level)
       VALUES ($1, $2, $3, $4, $5)`,
            [uuidv4(), currentSessionId, req.file.path, timestamp || new Date(), audioLevel || 0]
        );

        // Broadcast audio level for real-time visualization
        const broadcast = req.app.get('broadcast');
        if (broadcast && audioLevel) {
            broadcast('audio_level', { level: parseFloat(audioLevel), timestamp: new Date() });
        }

        console.log(`📁 Audio chunk saved: ${req.file.filename}`);

        res.json({
            success: true,
            sessionId: currentSessionId,
            filePath: req.file.path,
            filename: req.file.filename
        });
    } catch (error) {
        console.error('Audio upload error:', error);
        res.status(500).json({ error: 'Failed to save audio chunk' });
    }
});

// Get audio events for a session
router.get('/events/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;

        const result = await db.query(
            `SELECT * FROM audio_events 
       WHERE session_id = $1 
       ORDER BY timestamp ASC`,
            [sessionId]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching audio events:', error);
        res.status(500).json({ error: 'Failed to fetch audio events' });
    }
});

// Get audio chunks for a session (for playback)
router.get('/chunks/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;

        const result = await db.query(
            `SELECT id, recorded_at, audio_level, file_path 
       FROM audio_chunks 
       WHERE session_id = $1 
       ORDER BY recorded_at ASC`,
            [sessionId]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching audio chunks:', error);
        res.status(500).json({ error: 'Failed to fetch audio chunks' });
    }
});

// Stream audio file
router.get('/stream/:date/:filename', (req, res) => {
    const { date, filename } = req.params;
    const filePath = path.join(process.env.AUDIO_STORAGE_PATH || './uploads', date, filename);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Audio file not found' });
    }

    res.sendFile(filePath);
});

module.exports = router;
