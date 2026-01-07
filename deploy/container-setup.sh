#!/bin/bash
# =============================================================================
# Sleep System - Container Setup (Run inside the LXC container)
# =============================================================================

set -e

echo "=============================================="
echo "🌙 Sleep System - Container Setup"
echo "=============================================="

# Navigate to app directory
cd /opt/sleep-system

# Install Node.js dependencies
echo "📦 Installing Node.js dependencies..."
npm install --production

# Setup environment file
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cp .env.example .env
    
    # Generate random API keys
    API_KEY=$(openssl rand -hex 32)
    PI_KEY=$(openssl rand -hex 16)
    
    # Update .env with generated keys
    sed -i "s/your-secure-api-key-here/$API_KEY/" .env
    sed -i "s/your-pi-upload-key-here/$PI_KEY/" .env
    sed -i "s/sleep_pass/sleeppass123/" .env
    sed -i "s/localhost/127.0.0.1/" .env
    
    echo ""
    echo "🔑 Generated API Keys (save these!):"
    echo "   API_KEY: $API_KEY"
    echo "   PI_API_KEY: $PI_KEY"
    echo ""
fi

# Create audio storage directory
echo "📁 Creating audio storage directory..."
mkdir -p /mnt/sleep-audio
chmod 755 /mnt/sleep-audio

# Run database migrations
echo "🗄️ Running database migrations..."
PGPASSWORD=sleeppass123 psql -U sleep_user -d sleep_db -f database/migrations/001_initial_schema.sql || true

# Install systemd service
echo "⚙️ Installing systemd service..."
cp deploy/sleep-api.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable sleep-api

# Start the service
echo "🚀 Starting Sleep API..."
systemctl start sleep-api

# Check status
sleep 2
if systemctl is-active --quiet sleep-api; then
    echo ""
    echo "=============================================="
    echo "✅ Sleep System is running!"
    echo "=============================================="
    echo ""
    echo "API: http://$(hostname -I | awk '{print $1}'):3001"
    echo ""
    echo "Test with: curl http://localhost:3001/api/ping"
    echo ""
    echo "View logs: journalctl -u sleep-api -f"
    echo ""
else
    echo "❌ Service failed to start. Check logs:"
    journalctl -u sleep-api -n 20
fi
