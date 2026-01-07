-- Sleep Efficiency Tracking System Database Schema
-- Run this migration on PostgreSQL

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Sleep Sessions Table
CREATE TABLE IF NOT EXISTS sleep_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE UNIQUE NOT NULL,
    bed_time TIMESTAMPTZ,
    wake_time TIMESTAMPTZ,
    duration_minutes INTEGER,
    efficiency_score DECIMAL(5,2),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audio Chunks Table (raw audio files from Pi)
CREATE TABLE IF NOT EXISTS audio_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES sleep_sessions(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL,
    audio_level DECIMAL(5,2),
    processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audio Events Table (detected sounds)
CREATE TABLE IF NOT EXISTS audio_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES sleep_sessions(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL, -- snore, cough, talk, movement, breathing_irregular
    timestamp TIMESTAMPTZ NOT NULL,
    duration_seconds DECIMAL(6,2),
    confidence DECIMAL(3,2), -- 0.00 to 1.00
    audio_file_path TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Environmental Readings Table (from Qingping via Home Assistant)
CREATE TABLE IF NOT EXISTS environmental_readings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES sleep_sessions(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ NOT NULL,
    co2_ppm INTEGER,
    temperature_c DECIMAL(4,1),
    humidity_percent DECIMAL(4,1),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Health Metrics Table (imported from Fitbit/Pixel Watch)
CREATE TABLE IF NOT EXISTS health_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES sleep_sessions(id) ON DELETE CASCADE,
    source VARCHAR(50) NOT NULL, -- fitbit, google_fit
    sleep_stages JSONB, -- {light: minutes, deep: minutes, rem: minutes, awake: minutes}
    avg_heart_rate INTEGER,
    min_heart_rate INTEGER,
    max_heart_rate INTEGER,
    spo2_percent DECIMAL(4,1),
    imported_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(session_id, source)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_audio_chunks_session ON audio_chunks(session_id);
CREATE INDEX IF NOT EXISTS idx_audio_chunks_recorded ON audio_chunks(recorded_at);
CREATE INDEX IF NOT EXISTS idx_audio_events_session ON audio_events(session_id);
CREATE INDEX IF NOT EXISTS idx_audio_events_timestamp ON audio_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_audio_events_type ON audio_events(event_type);
CREATE INDEX IF NOT EXISTS idx_environmental_session ON environmental_readings(session_id);
CREATE INDEX IF NOT EXISTS idx_environmental_timestamp ON environmental_readings(timestamp);
CREATE INDEX IF NOT EXISTS idx_health_metrics_session ON health_metrics(session_id);
CREATE INDEX IF NOT EXISTS idx_sleep_sessions_date ON sleep_sessions(date);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for sleep_sessions
DROP TRIGGER IF EXISTS update_sleep_sessions_updated_at ON sleep_sessions;
CREATE TRIGGER update_sleep_sessions_updated_at
    BEFORE UPDATE ON sleep_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Sample data for testing (optional)
-- INSERT INTO sleep_sessions (date, bed_time, wake_time, duration_minutes, efficiency_score)
-- VALUES ('2026-01-06', '2026-01-06 23:00:00', '2026-01-07 07:00:00', 480, 85.5);
