"""
HomeMic Node Agent Configuration - Updated with Sleep Mode Support
"""
import os

# ============================================
# MODE CONFIGURATION
# ============================================
# Set to 'homemic' for transcription mode, 'sleep' for sleep tracking mode
AGENT_MODE = os.environ.get("AGENT_MODE", "homemic")  # 'homemic' or 'sleep'

# ============================================
# HomeMic Server Configuration (Transcription Mode)
# ============================================
SERVER_URL = os.environ.get("HOMEMIC_SERVER", "http://10.0.0.135:8420")
NODE_ID = os.environ.get("HOMEMIC_NODE_ID", "")  # Set after registration
NODE_NAME = os.environ.get("HOMEMIC_NODE_NAME", "Living Room")
NODE_LOCATION = os.environ.get("HOMEMIC_LOCATION", "Living Room")

# ============================================
# Sleep Server Configuration (Sleep Mode)
# ============================================
SLEEP_SERVER_URL = os.environ.get("SLEEP_SERVER", "http://10.0.0.135:3001")
SLEEP_PI_ID = os.environ.get("SLEEP_PI_ID", "bedroom-pi")

# ============================================
# Audio Configuration
# ============================================
SAMPLE_RATE = 48000  # USB mic native rate
CHANNELS = 1  # Mono
SILENCE_THRESHOLD = 500  # RMS threshold for silence detection

# ============================================
# Batch Recording Configuration
# ============================================
# For HomeMic transcription
BATCH_DURATION = 600  # 10 minutes in seconds

# For Sleep mode - shorter clips for more responsive data
SLEEP_BATCH_DURATION = int(os.environ.get("SLEEP_BATCH_DURATION", "60"))  # 1 minute

BATCH_OVERLAP = 0
MIN_AUDIO_LEVEL = 100

# ============================================
# Storage Configuration
# ============================================
LOCAL_STORAGE_DIR = os.environ.get(
    "HOMEMIC_STORAGE_DIR",
    os.path.expanduser("~/.homemic/clips")
)

# Sleep mode uses separate storage to avoid conflicts
SLEEP_STORAGE_DIR = os.environ.get(
    "SLEEP_STORAGE_DIR",
    os.path.expanduser("~/.homemic/sleep-clips")
)

UPLOAD_RETRY_COUNT = 3
UPLOAD_RETRY_DELAY = 10

# ============================================
# Network Configuration
# ============================================
HEARTBEAT_INTERVAL = 30
RETRY_DELAY = 5
MAX_RETRIES = 3

# ============================================
# Paths
# ============================================
DATA_DIR = os.path.expanduser("~/.homemic")
LOG_FILE = os.path.join(DATA_DIR, "node.log")
CONFIG_FILE = os.path.join(DATA_DIR, "config.json")

# VAD Configuration
VAD_AGGRESSIVENESS = 2
