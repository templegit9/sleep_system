#!/bin/bash
# =============================================================================
# Sleep System - Dashboard Deployment Helper
# Run this on your Proxmox host to add the dashboard to the existing container
# =============================================================================

CTID=121
API_URL="http://10.0.0.240:3001"
WS_URL="ws://10.0.0.240:3001"

echo "=============================================="
echo "🌙 Sleep System - Dashboard Deployment"
echo "=============================================="
echo ""

# Check container is running
if ! pct status $CTID | grep -q "running"; then
    echo "Starting container $CTID..."
    pct start $CTID
    sleep 3
fi

# Install dashboard dependencies
echo "📦 Installing dashboard dependencies..."
pct exec $CTID -- bash -c "cd /opt/sleep-system/dashboard && npm install"

# Create environment file for dashboard
echo "⚙️ Configuring dashboard..."
pct exec $CTID -- bash -c "cat > /opt/sleep-system/dashboard/.env.local << EOF
NEXT_PUBLIC_API_URL=$API_URL/api
NEXT_PUBLIC_WS_URL=$WS_URL/ws
EOF"

# Build the dashboard
echo "🔨 Building dashboard (this may take a few minutes)..."
pct exec $CTID -- bash -c "cd /opt/sleep-system/dashboard && npm run build"

# Create systemd service for dashboard
echo "⚙️ Setting up dashboard service..."
pct exec $CTID -- bash -c "cat > /etc/systemd/system/sleep-dashboard.service << EOF
[Unit]
Description=Sleep Efficiency Dashboard
After=network.target sleep-api.service

[Service]
Type=simple
WorkingDirectory=/opt/sleep-system/dashboard
Environment=PORT=3000
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF"

pct exec $CTID -- bash -c "systemctl daemon-reload && systemctl enable sleep-dashboard && systemctl start sleep-dashboard"

# Wait for service to start
sleep 5

# Get container IP
CT_IP=$(pct exec $CTID -- hostname -I 2>/dev/null | awk '{print $1}')

# Verify
echo ""
echo "=============================================="
echo "✅ Dashboard Deployed!"
echo "=============================================="
echo ""
echo "🌐 Dashboard: http://$CT_IP:3000"
echo "🌐 API:       http://$CT_IP:3001"
echo ""
echo "Open in browser: http://$CT_IP:3000"
echo ""
echo "View logs: pct exec $CTID -- journalctl -u sleep-dashboard -f"
echo "=============================================="
