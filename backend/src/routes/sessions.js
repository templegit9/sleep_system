const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../models/db');

// Get all sleep sessions
router.get('/', async (req, res) => {
    try {
        const { limit = 30, offset = 0 } = req.query;

        const result = await db.query(
            `SELECT 
        s.*,
        COUNT(DISTINCT ae.id) as event_count,
        AVG(er.co2_ppm) as avg_co2,
        AVG(er.temperature_c) as avg_temp,
        AVG(er.humidity_percent) as avg_humidity
       FROM sleep_sessions s
       LEFT JOIN audio_events ae ON s.id = ae.session_id
       LEFT JOIN environmental_readings er ON s.id = er.session_id
       GROUP BY s.id
       ORDER BY s.date DESC
       LIMIT $1 OFFSET $2`,
            [limit, offset]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching sessions:', error);
        res.status(500).json({ error: 'Failed to fetch sessions' });
    }
});

// Get single session with full details
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Get session
        const sessionResult = await db.query(
            'SELECT * FROM sleep_sessions WHERE id = $1',
            [id]
        );

        if (sessionResult.rows.length === 0) {
            return res.status(404).json({ error: 'Session not found' });
        }

        const session = sessionResult.rows[0];

        // Get audio events
        const eventsResult = await db.query(
            `SELECT * FROM audio_events 
       WHERE session_id = $1 
       ORDER BY timestamp ASC`,
            [id]
        );

        // Get environmental readings
        const envResult = await db.query(
            `SELECT * FROM environmental_readings 
       WHERE session_id = $1 
       ORDER BY timestamp ASC`,
            [id]
        );

        // Get health metrics (from Fitbit import)
        const healthResult = await db.query(
            `SELECT * FROM health_metrics 
       WHERE session_id = $1`,
            [id]
        );

        res.json({
            ...session,
            audio_events: eventsResult.rows,
            environmental_readings: envResult.rows,
            health_metrics: healthResult.rows[0] || null
        });
    } catch (error) {
        console.error('Error fetching session:', error);
        res.status(500).json({ error: 'Failed to fetch session' });
    }
});

// Get today's session
router.get('/today/current', async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];

        const result = await db.query(
            `SELECT * FROM sleep_sessions WHERE date = $1`,
            [today]
        );

        if (result.rows.length === 0) {
            return res.json({ session: null, isRecording: false });
        }

        const session = result.rows[0];
        const isRecording = !session.wake_time;

        res.json({ session, isRecording });
    } catch (error) {
        console.error('Error fetching today session:', error);
        res.status(500).json({ error: 'Failed to fetch today session' });
    }
});

// Start a new sleep session
router.post('/start', async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const id = uuidv4();

        const result = await db.query(
            `INSERT INTO sleep_sessions (id, date, bed_time) 
       VALUES ($1, $2, NOW()) 
       ON CONFLICT (date) DO UPDATE SET 
         bed_time = NOW(),
         wake_time = NULL,
         efficiency_score = NULL,
         duration_minutes = NULL
       RETURNING *`,
            [id, today]
        );

        const broadcast = req.app.get('broadcast');
        if (broadcast) {
            broadcast('session_started', result.rows[0]);
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error starting session:', error);
        res.status(500).json({ error: 'Failed to start session' });
    }
});

// End a sleep session
router.post('/:id/end', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await db.query(
            `UPDATE sleep_sessions 
       SET wake_time = NOW(),
           duration_minutes = EXTRACT(EPOCH FROM (NOW() - bed_time)) / 60
       WHERE id = $1
       RETURNING *`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Session not found' });
        }

        const broadcast = req.app.get('broadcast');
        if (broadcast) {
            broadcast('session_ended', result.rows[0]);
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error ending session:', error);
        res.status(500).json({ error: 'Failed to end session' });
    }
});

// Calculate efficiency score for a session
router.post('/:id/calculate-score', async (req, res) => {
    try {
        const { id } = req.params;

        // Get session data
        const sessionResult = await db.query(
            'SELECT * FROM sleep_sessions WHERE id = $1',
            [id]
        );

        if (sessionResult.rows.length === 0) {
            return res.status(404).json({ error: 'Session not found' });
        }

        const session = sessionResult.rows[0];

        // Get disturbance events
        const eventsResult = await db.query(
            `SELECT COUNT(*) as disturbance_count, 
              SUM(duration_seconds) as total_disturbance_time
       FROM audio_events 
       WHERE session_id = $1 
       AND event_type IN ('snore', 'movement', 'cough')`,
            [id]
        );

        const events = eventsResult.rows[0];
        const disturbanceMinutes = (events.total_disturbance_time || 0) / 60;

        // Calculate efficiency: (sleep time - disturbances) / sleep time * 100
        const sleepMinutes = session.duration_minutes || 0;
        let efficiency = 100;

        if (sleepMinutes > 0) {
            efficiency = Math.max(0, Math.min(100,
                ((sleepMinutes - disturbanceMinutes) / sleepMinutes) * 100
            ));
        }

        // Update session with score
        const updateResult = await db.query(
            `UPDATE sleep_sessions 
       SET efficiency_score = $1 
       WHERE id = $2 
       RETURNING *`,
            [efficiency.toFixed(2), id]
        );

        res.json(updateResult.rows[0]);
    } catch (error) {
        console.error('Error calculating score:', error);
        res.status(500).json({ error: 'Failed to calculate efficiency score' });
    }
});

module.exports = router;
