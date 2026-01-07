#!/bin/bash
# =============================================================================
# Sleep System - Complete Proxmox Setup Helper
# Run this on your Proxmox host (pve)
# 
# Usage: bash <(curl -s https://raw.githubusercontent.com/templegit9/sleep_system/main/deploy/pve-helper.sh)
# =============================================================================

set -e

CTID=121
CT_NAME="sleep-system"
CT_MEMORY=1024
CT_CORES=2
CT_DISK=16
REPO_URL="https://github.com/templegit9/sleep_system.git"

echo "=============================================="
echo "🌙 Sleep System - Proxmox LXC Setup"
echo "=============================================="
echo ""

# Check if running on Proxmox
if ! command -v pct &> /dev/null; then
    echo "❌ Error: This script must be run on a Proxmox host"
    exit 1
fi

# Check if container ID already exists
if pct status $CTID &> /dev/null; then
    echo "⚠️  Container $CTID already exists."
    read -p "Delete and recreate? (y/N): " confirm
    if [[ $confirm == [yY] ]]; then
        pct stop $CTID 2>/dev/null || true
        pct destroy $CTID
    else
        echo "Using existing container..."
    fi
fi

# Download template if needed
TEMPLATE="debian-12-standard_12.2-1_amd64.tar.zst"
if [ ! -f "/var/lib/vz/template/cache/$TEMPLATE" ]; then
    echo "📥 Downloading Debian 12 template..."
    pveam update
    pveam download local $TEMPLATE
fi

# Create container if it doesn't exist
if ! pct status $CTID &> /dev/null; then
    echo "📦 Creating container $CTID..."
    pct create $CTID local:vztmpl/$TEMPLATE \
        --hostname $CT_NAME \
        --memory $CT_MEMORY \
        --cores $CT_CORES \
        --net0 name=eth0,bridge=vmbr0,ip=dhcp \
        --storage local-lvm \
        --rootfs local-lvm:$CT_DISK \
        --unprivileged 1 \
        --features nesting=1
fi

# Start container
echo "🚀 Starting container..."
pct start $CTID
sleep 5

# Get container IP
CT_IP=$(pct exec $CTID -- hostname -I | awk '{print $1}')
echo "📡 Container IP: $CT_IP"

# Install dependencies inside container
echo ""
echo "📦 Installing dependencies (this may take a few minutes)..."
pct exec $CTID -- bash -c "apt update -qq"
pct exec $CTID -- bash -c "apt install -y -qq git curl postgresql postgresql-contrib sudo"

# Install Node.js 20
echo "📦 Installing Node.js 20..."
pct exec $CTID -- bash -c "curl -fsSL https://deb.nodesource.com/setup_20.x | bash -"
pct exec $CTID -- bash -c "apt install -y -qq nodejs"

# Setup PostgreSQL
echo "🗄️ Setting up database..."
pct exec $CTID -- bash -c "sudo -u postgres psql -c \"CREATE USER sleep_user WITH PASSWORD 'sleeppass123';\" 2>/dev/null || true"
pct exec $CTID -- bash -c "sudo -u postgres psql -c \"CREATE DATABASE sleep_db OWNER sleep_user;\" 2>/dev/null || true"

# Clone repository
echo "📥 Cloning Sleep System..."
pct exec $CTID -- bash -c "rm -rf /opt/sleep-system"
pct exec $CTID -- bash -c "git clone $REPO_URL /opt/sleep-system"

# Run database migrations
echo "🗄️ Running database migrations..."
pct exec $CTID -- bash -c "cd /opt/sleep-system && PGPASSWORD=sleeppass123 psql -U sleep_user -h localhost -d sleep_db -f database/migrations/001_initial_schema.sql"

# Install npm dependencies
echo "📦 Installing Node.js dependencies..."
pct exec $CTID -- bash -c "cd /opt/sleep-system/backend && npm install --production"

# Create .env file
echo "⚙️ Creating configuration..."
API_KEY=$(openssl rand -hex 24)
PI_KEY=$(openssl rand -hex 16)

pct exec $CTID -- bash -c "cat > /opt/sleep-system/backend/.env << EOF
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://sleep_user:sleeppass123@localhost:5432/sleep_db
AUDIO_STORAGE_PATH=/mnt/sleep-audio
API_KEY=$API_KEY
PI_API_KEY=$PI_KEY
TRUSTED_IPS=127.0.0.1,::1,10.0.0.0/8,192.168.0.0/16
EOF"

# Create audio storage directory
pct exec $CTID -- bash -c "mkdir -p /mnt/sleep-audio && chmod 755 /mnt/sleep-audio"

# Create systemd service
echo "⚙️ Setting up systemd service..."
pct exec $CTID -- bash -c "cat > /etc/systemd/system/sleep-api.service << EOF
[Unit]
Description=Sleep Efficiency Tracking API
After=network.target postgresql.service

[Service]
Type=simple
WorkingDirectory=/opt/sleep-system/backend
ExecStart=/usr/bin/node src/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF"

pct exec $CTID -- bash -c "systemctl daemon-reload && systemctl enable sleep-api && systemctl start sleep-api"

# Wait for service to start
sleep 3

# Verify
echo ""
echo "=============================================="
echo "✅ Sleep System Installed!"
echo "=============================================="
echo ""
echo "🌐 API URL: http://$CT_IP:3001"
echo "🔑 API Key: $API_KEY"
echo "🔑 Pi Key:  $PI_KEY"
echo ""
echo "Test with: curl http://$CT_IP:3001/api/ping"
echo ""
echo "📋 Update your Pi config with:"
echo "   SLEEP_SERVER=\"http://$CT_IP:3001\""
echo ""
echo "View logs: pct exec $CTID -- journalctl -u sleep-api -f"
echo "=============================================="
