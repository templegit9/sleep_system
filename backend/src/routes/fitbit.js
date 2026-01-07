const express = require('express');
const router = express.Router();
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const db = require('../models/db');

// Configure multer for JSON file uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Import Fitbit sleep data export
router.post('/import', upload.single('fitbitData'), async (req, res) => {
    try {
        let data;

        if (req.file) {
            // Parse uploaded JSON file
            data = JSON.parse(req.file.buffer.toString());
        } else if (req.body.data) {
            // Parse JSON from body
            data = typeof req.body.data === 'string' ? JSON.parse(req.body.data) : req.body.data;
        } else {
            return res.status(400).json({ error: 'No data provided' });
        }

        const importedSessions = [];

        // Handle Fitbit sleep data format
        const sleepData = data.sleep || data;

        for (const entry of (Array.isArray(sleepData) ? sleepData : [sleepData])) {
            const date = entry.dateOfSleep || entry.date;

            if (!date) continue;

            // Find or create session for this date
            const sessionResult = await db.query(
                `INSERT INTO sleep_sessions (id, date, bed_time, wake_time, duration_minutes)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (date) DO UPDATE SET
           bed_time = COALESCE(sleep_sessions.bed_time, $3),
           wake_time = COALESCE(sleep_sessions.wake_time, $4),
           duration_minutes = COALESCE(sleep_sessions.duration_minutes, $5)
         RETURNING id`,
                [
                    uuidv4(),
                    date,
                    entry.startTime || null,
                    entry.endTime || null,
                    entry.duration ? Math.round(entry.duration / 60000) : entry.minutesAsleep || null
                ]
            );

            const sessionId = sessionResult.rows[0].id;

            // Parse sleep stages
            const stages = entry.levels?.summary || {};
            const sleepStages = {
                deep: stages.deep?.minutes || entry.minutesDeep || 0,
                light: stages.light?.minutes || entry.minutesLight || 0,
                rem: stages.rem?.minutes || entry.minutesRem || 0,
                awake: stages.wake?.minutes || entry.minutesAwake || 0
            };

            // Store health metrics
            await db.query(
                `INSERT INTO health_metrics (id, session_id, source, sleep_stages, avg_heart_rate, spo2_percent, imported_at)
         VALUES ($1, $2, 'fitbit', $3, $4, $5, NOW())
         ON CONFLICT (session_id, source) DO UPDATE SET
           sleep_stages = $3,
           avg_heart_rate = COALESCE($4, health_metrics.avg_heart_rate),
           spo2_percent = COALESCE($5, health_metrics.spo2_percent),
           imported_at = NOW()`,
                [
                    uuidv4(),
                    sessionId,
                    JSON.stringify(sleepStages),
                    entry.avgHeartRate || null,
                    entry.avgSpO2 || null
                ]
            );

            importedSessions.push({ date, sessionId });
        }

        res.json({
            success: true,
            imported: importedSessions.length,
            sessions: importedSessions
        });
    } catch (error) {
        console.error('Fitbit import error:', error);
        res.status(500).json({ error: 'Failed to import Fitbit data: ' + error.message });
    }
});

// Get imported health metrics for a session
router.get('/metrics/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;

        const result = await db.query(
            `SELECT * FROM health_metrics WHERE session_id = $1`,
            [sessionId]
        );

        if (result.rows.length === 0) {
            return res.json({ metrics: null });
        }

        const metrics = result.rows[0];
        metrics.sleep_stages = typeof metrics.sleep_stages === 'string'
            ? JSON.parse(metrics.sleep_stages)
            : metrics.sleep_stages;

        res.json({ metrics });
    } catch (error) {
        console.error('Error fetching health metrics:', error);
        res.status(500).json({ error: 'Failed to fetch health metrics' });
    }
});

module.exports = router;
