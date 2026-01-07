# Sleep Efficiency Tracking System

> 🛡️ **Completely Offline** - All data stays on your local Proxmox server

A comprehensive sleep monitoring system that combines audio analysis, environmental data from Qingping Air Monitor, and Pixel Watch health metrics into a beautiful real-time dashboard.

## 🏗️ Architecture

```
┌─────────────────┐     ┌──────────────────────────────────────┐
│   Raspberry Pi  │────▶│          Proxmox Server              │
│   + USB Mic     │     │  ┌──────────┐  ┌──────────────────┐  │
└─────────────────┘     │  │ sleep-db │  │    sleep-api     │  │
                        │  │ Postgres │◀─│  Node.js + Audio │  │
┌─────────────────┐     │  └──────────┘  │    Processing    │  │
│ Qingping Air    │     │                └────────┬─────────┘  │
│ Monitor Lite    │────▶│  ┌──────────────────────┼──────────┐ │
└─────────────────┘     │  │   Home Assistant     │          │ │
                        │  └──────────────────────┘          │ │
┌─────────────────┐     │  ┌──────────────────────┴─────────┐│ │
│  Pixel Watch 4  │     │  │        sleep-web               ││ │
│  (Fitbit Data)  │─────│  │      Next.js Dashboard         ││ │
└─────────────────┘     │  └────────────────────────────────┘│ │
                        └──────────────────────────────────────┘
```

## 📁 Project Structure

```
Sleep_System/
├── backend/          # Node.js API server
├── dashboard/        # Next.js web UI
├── pi-agent/         # Raspberry Pi audio capture
├── database/         # PostgreSQL migrations
└── docs/             # Documentation
```

## 🚀 Quick Start

### 1. Set Up Database (Proxmox LXC)

```bash
# Create PostgreSQL LXC container
# Then run migrations:
psql -U sleep_user -d sleep_db -f database/migrations/001_initial_schema.sql
```

### 2. Configure Backend

```bash
cd backend
cp .env.example .env
# Edit .env with your settings
npm install
npm run dev
```

### 3. Set Up Dashboard

```bash
cd dashboard
npm install
npm run dev
```

### 4. Deploy Raspberry Pi Agent

```bash
# Copy pi-agent folder to Raspberry Pi
scp -r pi-agent/ pi@raspberrypi:~/sleep-agent/

# On the Pi:
cd ~/sleep-agent
pip install -r requirements.txt
sudo cp sleep-agent.service /etc/systemd/system/
sudo systemctl enable sleep-agent
sudo systemctl start sleep-agent
```

### 5. Configure Qingping (Home Assistant)

1. Set up Air Monitor in HomeKit mode via Qingping+ app
2. Add to Home Assistant using HomeKit Controller
3. Update `.env` with entity IDs

## 📊 Features

- **Real-time Audio Monitoring** - Snoring detection, breathing patterns
- **Environmental Tracking** - CO₂, temperature, humidity from Qingping
- **Sleep Efficiency Score** - Calculated from audio events and duration
- **Fitbit Data Import** - Manual import of Pixel Watch sleep data
- **Beautiful Dashboard** - Dark theme with glassmorphism design

## 🔧 Tech Stack

| Component | Technology |
|-----------|------------|
| Backend API | Node.js, Express, WebSocket |
| Database | PostgreSQL |
| Dashboard | Next.js 14, Tailwind CSS, Recharts |
| Pi Agent | Python, PyAudio |
| Environment | Home Assistant (for Qingping) |

## 📝 License

MIT
