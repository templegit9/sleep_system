# Detailed Setup Guide

## Prerequisites

- Proxmox VE server with available storage
- Raspberry Pi 4 (or 3B+) with USB microphone
- Qingping Air Monitor Lite
- Pixel Watch 4 with Fitbit app

---

## Part 1: Proxmox LXC Containers

### 1.1 Create Database Container (sleep-db)

```bash
# Create Alpine Linux LXC
pct create 201 local:vztmpl/alpine-3.19-default_20231218_amd64.tar.xz \
  --hostname sleep-db \
  --memory 512 \
  --cores 1 \
  --net0 name=eth0,bridge=vmbr0,ip=dhcp \
  --storage local-lvm \
  --rootfs local-lvm:8

# Start and enter container
pct start 201
pct enter 201

# Install PostgreSQL
apk add postgresql postgresql-contrib
rc-update add postgresql default
/etc/init.d/postgresql setup
rc-service postgresql start

# Create database and user
su - postgres
psql
CREATE USER sleep_user WITH PASSWORD 'your_secure_password';
CREATE DATABASE sleep_db OWNER sleep_user;
\q
exit

# Allow network connections (edit postgresql.conf and pg_hba.conf)
```

### 1.2 Create API Container (sleep-api)

```bash
# Create Debian LXC with bind mount for audio storage
pct create 202 local:vztmpl/debian-12-standard_12.2-1_amd64.tar.zst \
  --hostname sleep-api \
  --memory 1024 \
  --cores 2 \
  --net0 name=eth0,bridge=vmbr0,ip=dhcp \
  --storage local-lvm \
  --rootfs local-lvm:16 \
  --mp0 /mnt/sleep-audio,mp=/mnt/sleep-audio

# Install Node.js
pct enter 202
apt update && apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs python3 python3-pip

# Deploy backend
cd /opt
git clone <your-repo> sleep-system
cd sleep-system/backend
npm install
cp .env.example .env
# Edit .env with database credentials
npm run start
```

### 1.3 Create Dashboard Container (sleep-web)

```bash
# Similar to API container but for Next.js
pct create 203 local:vztmpl/debian-12-standard_12.2-1_amd64.tar.zst \
  --hostname sleep-web \
  --memory 512 \
  --cores 1 \
  --net0 name=eth0,bridge=vmbr0,ip=dhcp \
  --storage local-lvm \
  --rootfs local-lvm:8

pct enter 203
# Install Node.js and deploy dashboard
cd /opt/sleep-system/dashboard
npm install
npm run build
npm run start
```

---

## Part 2: Raspberry Pi Setup

### 2.1 Install Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install audio libraries
sudo apt install -y python3-pip portaudio19-dev python3-pyaudio

# Install Python dependencies
pip3 install pyaudio pyyaml requests numpy
```

### 2.2 Connect USB Microphone

```bash
# List audio devices
arecord -l

# Test recording (should show your USB mic)
arecord -d 5 -f cd test.wav
aplay test.wav
```

### 2.3 Deploy Agent

```bash
# Copy sleep-agent files
mkdir ~/sleep-agent
# Copy all files from pi-agent/

# Edit config.yaml with your server IP
nano ~/sleep-agent/config.yaml

# Test manually
python3 ~/sleep-agent/audio_capture.py
```

### 2.4 Enable Auto-Start

```bash
sudo cp ~/sleep-agent/sleep-agent.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable sleep-agent
sudo systemctl start sleep-agent

# Check status
sudo systemctl status sleep-agent
journalctl -u sleep-agent -f
```

---

## Part 3: Qingping Air Monitor Setup

### 3.1 Configure in HomeKit Mode

1. Download **Qingping+** app (not Mi Home)
2. Add device using "HomeKit" mode
3. Complete setup with your Apple ID

### 3.2 Add to Home Assistant

```yaml
# In configuration.yaml, ensure HomeKit Controller is enabled
homekit_controller:

# After discovery, note the entity IDs:
# sensor.qingping_air_monitor_co2
# sensor.qingping_air_monitor_temperature  
# sensor.qingping_air_monitor_humidity
```

### 3.3 Update Backend Config

```bash
# Edit backend/.env
HOME_ASSISTANT_URL=http://192.168.1.XXX:8123
HOME_ASSISTANT_TOKEN=your_long_lived_token
QINGPING_CO2_ENTITY=sensor.qingping_air_monitor_co2
QINGPING_TEMP_ENTITY=sensor.qingping_air_monitor_temperature
QINGPING_HUMIDITY_ENTITY=sensor.qingping_air_monitor_humidity
```

---

## Part 4: Pixel Watch Data Import

Since Pixel Watch doesn't support direct offline export, use the Fitbit export:

### 4.1 Export from Fitbit

1. Go to [Fitbit Export](https://www.fitbit.com/settings/data/export)
2. Request your data
3. Download the ZIP file
4. Extract `sleep-*.json` files

### 4.2 Import to Dashboard

1. Open the dashboard
2. Go to Settings → Import Data
3. Upload the sleep JSON file
4. Data will be merged with existing sessions

---

## Troubleshooting

### Pi Not Sending Audio
```bash
# Check service status
sudo systemctl status sleep-agent

# Check logs
journalctl -u sleep-agent -f

# Test network connectivity
curl http://YOUR_SERVER_IP:3001/api/ping
```

### Qingping Not Updating
```bash
# Verify Home Assistant can see the device
curl -H "Authorization: Bearer TOKEN" \
  http://homeassistant.local:8123/api/states/sensor.qingping_air_monitor_co2
```

### Dashboard Not Loading
```bash
# Check API is running
curl http://localhost:3001/api/health

# Check database connection
psql -U sleep_user -d sleep_db -c "SELECT 1"
```
