const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

// Test connection
pool.on('connect', () => {
    console.log('📊 Connected to PostgreSQL database');
});

pool.on('error', (err) => {
    console.error('Database pool error:', err);
});

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool,
};
