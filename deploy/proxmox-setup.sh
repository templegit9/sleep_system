#!/bin/bash
# =============================================================================
# Sleep System - Proxmox LXC Setup Script
# Run this script on your Proxmox host (pve)
# =============================================================================

set -e

# Configuration - Update these as needed
CTID=121                        # Container ID (use an unused ID)
CT_NAME="sleep-system"          # Container name
CT_IP="10.0.0.121/24"          # Static IP (or use dhcp)
CT_GW="10.0.0.1"               # Gateway
CT_STORAGE="local-lvm"          # Storage for rootfs
CT_MEMORY=1024                  # Memory in MB
CT_CORES=2                      # CPU cores
CT_DISK=16                      # Root disk size in GB
AUDIO_MOUNT="/mnt/sleep-audio"  # Audio storage mount point

echo "=============================================="
echo "🌙 Sleep System LXC Setup"
echo "=============================================="
echo "Container ID: $CTID"
echo "Name: $CT_NAME"
echo "IP: $CT_IP"
echo ""

# Check if template exists, download if not
TEMPLATE="debian-12-standard_12.2-1_amd64.tar.zst"
if [ ! -f "/var/lib/vz/template/cache/$TEMPLATE" ]; then
    echo "📥 Downloading Debian 12 template..."
    pveam update
    pveam download local $TEMPLATE
fi

# Create the container
echo "📦 Creating LXC container..."
pct create $CTID local:vztmpl/$TEMPLATE \
    --hostname $CT_NAME \
    --memory $CT_MEMORY \
    --cores $CT_CORES \
    --net0 name=eth0,bridge=vmbr0,ip=$CT_IP,gw=$CT_GW \
    --storage $CT_STORAGE \
    --rootfs ${CT_STORAGE}:${CT_DISK} \
    --features nesting=1 \
    --unprivileged 1 \
    --start 0

# Create audio storage directory on host if needed
if [ ! -d "$AUDIO_MOUNT" ]; then
    echo "📁 Creating audio storage directory..."
    mkdir -p $AUDIO_MOUNT
    chmod 777 $AUDIO_MOUNT
fi

# Add mount point for audio storage (optional - comment out if not needed)
# pct set $CTID -mp0 $AUDIO_MOUNT,mp=/mnt/sleep-audio

echo "✅ Container created!"
echo ""
echo "Starting container..."
pct start $CTID

# Wait for container to boot
sleep 5

echo "📦 Installing dependencies inside container..."
pct exec $CTID -- bash -c "apt update && apt upgrade -y"
pct exec $CTID -- bash -c "apt install -y curl git postgresql postgresql-contrib"

# Install Node.js 20
pct exec $CTID -- bash -c "curl -fsSL https://deb.nodesource.com/setup_20.x | bash -"
pct exec $CTID -- bash -c "apt install -y nodejs"

# Setup PostgreSQL
echo "🗄️ Setting up PostgreSQL..."
pct exec $CTID -- bash -c "sudo -u postgres psql -c \"CREATE USER sleep_user WITH PASSWORD 'sleeppass123';\""
pct exec $CTID -- bash -c "sudo -u postgres psql -c \"CREATE DATABASE sleep_db OWNER sleep_user;\""

# Create app directory
pct exec $CTID -- bash -c "mkdir -p /opt/sleep-system"

echo ""
echo "=============================================="
echo "✅ LXC Container Ready!"
echo "=============================================="
echo ""
echo "Next steps:"
echo "1. Copy the backend code to the container:"
echo "   scp -r backend/* root@${CT_IP%/*}:/opt/sleep-system/"
echo ""
echo "2. SSH into container and complete setup:"
echo "   ssh root@${CT_IP%/*}"
echo "   cd /opt/sleep-system"
echo "   npm install"
echo "   cp .env.example .env"
echo "   # Edit .env with your settings"
echo "   npm start"
echo ""
echo "Container IP: ${CT_IP%/*}"
echo "API will be at: http://${CT_IP%/*}:3001"
echo ""
