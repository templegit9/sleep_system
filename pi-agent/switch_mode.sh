#!/bin/bash
# Switch between HomeMic and Sleep mode

MODE=$1

if [ "$MODE" = "sleep" ]; then
    echo "🌙 Switching to SLEEP mode..."
    sudo systemctl stop homemic-node
    export AGENT_MODE=sleep
    export SLEEP_SERVER="http://10.0.0.135:3001"
    cd ~/homemic-node/node
    source venv/bin/activate
    python agent_with_sleep.py --mode sleep
    
elif [ "$MODE" = "homemic" ]; then
    echo "🎤 Switching to HOMEMIC mode..."
    pkill -f 'agent_with_sleep.py' 2>/dev/null
    sudo systemctl start homemic-node
    echo "HomeMic service started"
    
else
    echo "Usage: ./switch_mode.sh [sleep|homemic]"
    echo "  sleep   - Start sleep tracking mode"
    echo "  homemic - Return to HomeMic transcription mode"
fi
