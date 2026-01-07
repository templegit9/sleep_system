require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

// Import middleware
const { authMiddleware, logMiddleware } = require('./middleware/auth');

// Import routes
const audioRoutes = require('./routes/audio');
const sessionsRoutes = require('./routes/sessions');
const environmentRoutes = require('./routes/environment');
const healthRoutes = require('./routes/health');
const fitbitRoutes = require('./routes/fitbit');

const app = express();
const server = http.createServer(app);

// WebSocket server for real-time updates
const wss = new WebSocket.Server({ server, path: '/ws' });

// Security middleware
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(logMiddleware);
app.use('/api', authMiddleware);

// Make WebSocket server available to routes
app.set('wss', wss);

// API Routes
app.use('/api/audio', audioRoutes);
app.use('/api/sessions', sessionsRoutes);
app.use('/api/environment', environmentRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/fitbit', fitbitRoutes);

// Health check (no auth required)
app.get('/api/ping', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// WebSocket connection handling
wss.on('connection', (ws) => {
  console.log('Dashboard client connected');

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log('Received:', data);
    } catch (e) {
      console.error('Invalid message format');
    }
  });

  ws.on('close', () => {
    console.log('Dashboard client disconnected');
  });
});

// Broadcast function for real-time updates
app.set('broadcast', (type, data) => {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type, data, timestamp: new Date().toISOString() }));
    }
  });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`🌙 Sleep API running on port ${PORT}`);
  console.log(`📡 WebSocket server ready at ws://localhost:${PORT}/ws`);
  console.log(`🔐 API key authentication enabled`);
});

module.exports = { app, server, wss };
