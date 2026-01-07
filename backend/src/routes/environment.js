const express = require('express');
const router = express.Router();
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const db = require('../models/db');

const HA_URL = process.env.HOME_ASSISTANT_URL;
const HA_TOKEN = process.env.HOME_ASSISTANT_TOKEN;

// Fetch current environmental data from Home Assistant
router.get('/current', async (req, res) => {
    try {
        if (!HA_URL || !HA_TOKEN) {
            return res.status(500).json({ error: 'Home Assistant not configured' });
        }

        const entities = [
            process.env.QINGPING_CO2_ENTITY,
            process.env.QINGPING_TEMP_ENTITY,
            process.env.QINGPING_HUMIDITY_ENTITY
        ];

        const readings = {};

        for (const entityId of entities) {
            if (!entityId) continue;

            try {
                const response = await axios.get(`${HA_URL}/api/states/${entityId}`, {
                    headers: {
                        'Authorization': `Bearer ${HA_TOKEN}`,
                        'Content-Type': 'application/json'
                    }
                });

                const state = response.data;

                if (entityId.includes('co2')) {
                    readings.co2_ppm = parseFloat(state.state);
                } else if (entityId.includes('temperature')) {
                    readings.temperature_c = parseFloat(state.state);
                } else if (entityId.includes('humidity')) {
                    readings.humidity_percent = parseFloat(state.state);
                }
            } catch (entityError) {
                console.error(`Failed to fetch ${entityId}:`, entityError.message);
            }
        }

        readings.timestamp = new Date().toISOString();
        res.json(readings);
    } catch (error) {
        console.error('Error fetching environmental data:', error);
        res.status(500).json({ error: 'Failed to fetch environmental data' });
    }
});

// Store environmental reading (called by polling service)
router.post('/reading', async (req, res) => {
    try {
        const { sessionId, co2_ppm, temperature_c, humidity_percent } = req.body;

        if (!sessionId) {
            return res.status(400).json({ error: 'Session ID required' });
        }

        const result = await db.query(
            `INSERT INTO environmental_readings 
       (id, session_id, timestamp, co2_ppm, temperature_c, humidity_percent)
       VALUES ($1, $2, NOW(), $3, $4, $5)
       RETURNING *`,
            [uuidv4(), sessionId, co2_ppm, temperature_c, humidity_percent]
        );

        // Broadcast for real-time dashboard
        const broadcast = req.app.get('broadcast');
        if (broadcast) {
            broadcast('environment_update', result.rows[0]);
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error storing environmental reading:', error);
        res.status(500).json({ error: 'Failed to store reading' });
    }
});

// Get environmental history for a session
router.get('/session/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;

        const result = await db.query(
            `SELECT * FROM environmental_readings 
       WHERE session_id = $1 
       ORDER BY timestamp ASC`,
            [sessionId]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching environmental history:', error);
        res.status(500).json({ error: 'Failed to fetch environmental history' });
    }
});

// Get environmental stats for a session
router.get('/stats/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;

        const result = await db.query(
            `SELECT 
        AVG(co2_ppm) as avg_co2,
        MIN(co2_ppm) as min_co2,
        MAX(co2_ppm) as max_co2,
        AVG(temperature_c) as avg_temp,
        MIN(temperature_c) as min_temp,
        MAX(temperature_c) as max_temp,
        AVG(humidity_percent) as avg_humidity,
        MIN(humidity_percent) as min_humidity,
        MAX(humidity_percent) as max_humidity
       FROM environmental_readings 
       WHERE session_id = $1`,
            [sessionId]
        );

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching environmental stats:', error);
        res.status(500).json({ error: 'Failed to fetch environmental stats' });
    }
});

module.exports = router;
