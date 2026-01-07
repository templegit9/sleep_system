const express = require('express');
const router = express.Router();
const db = require('../models/db');

// Health check endpoint
router.get('/', async (req, res) => {
    try {
        // Check database connection
        await db.query('SELECT 1');

        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            services: {
                database: 'connected',
                api: 'running'
            }
        });
    } catch (error) {
        res.status(500).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }
});

// Get system stats
router.get('/stats', async (req, res) => {
    try {
        const sessionsCount = await db.query('SELECT COUNT(*) FROM sleep_sessions');
        const eventsCount = await db.query('SELECT COUNT(*) FROM audio_events');
        const avgEfficiency = await db.query(
            'SELECT AVG(efficiency_score) as avg FROM sleep_sessions WHERE efficiency_score IS NOT NULL'
        );

        res.json({
            total_sessions: parseInt(sessionsCount.rows[0].count),
            total_audio_events: parseInt(eventsCount.rows[0].count),
            average_efficiency: avgEfficiency.rows[0].avg ? parseFloat(avgEfficiency.rows[0].avg).toFixed(1) : null
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

module.exports = router;
