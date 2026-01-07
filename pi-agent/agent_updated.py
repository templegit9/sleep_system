#!/usr/bin/env python3
"""
HomeMic Node Agent - With Sleep Mode Support

Supports two modes:
- homemic: Original transcription mode (10-minute clips)
- sleep: Sleep tracking mode (1-minute clips to sleep server)

Usage:
    python agent.py [--mode homemic|sleep] [--server URL] [--name NAME]
    
Example:
    python agent.py --mode sleep --server http://10.0.0.135:3001
"""
import argparse
import logging
import signal
import sys
import time
import json
import os
from pathlib import Path

from config import (
    SERVER_URL, NODE_NAME, NODE_LOCATION,
    HEARTBEAT_INTERVAL, DATA_DIR, CONFIG_FILE, LOG_FILE,
    LOCAL_STORAGE_DIR, BATCH_DURATION,
    # Sleep mode config
    AGENT_MODE, SLEEP_SERVER_URL, SLEEP_STORAGE_DIR, SLEEP_BATCH_DURATION
)
from audio_capture import AudioCapture, BatchRecorder
from server_client import ServerClient
from batch_uploader import BatchUploader

# Import sleep mode components
try:
    from sleep_mode import SleepUploader
    SLEEP_MODE_AVAILABLE = True
except ImportError:
    SLEEP_MODE_AVAILABLE = False
    logging.warning("Sleep mode not available - sleep_mode.py not found")

# Ensure directories exist
Path(DATA_DIR).mkdir(parents=True, exist_ok=True)
Path(LOCAL_STORAGE_DIR).mkdir(parents=True, exist_ok=True)

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(LOG_FILE) if os.path.exists(DATA_DIR) else logging.NullHandler()
    ]
)
logger = logging.getLogger(__name__)


class HomeMicAgent:
    """
    Multi-mode node agent.
    - HomeMic mode: Records 10-minute clips for transcription
    - Sleep mode: Records 1-minute clips for sleep tracking
    """
    
    def __init__(
        self,
        server_url: str = SERVER_URL,
        node_name: str = NODE_NAME,
        node_location: str = NODE_LOCATION,
        mode: str = AGENT_MODE
    ):
        self.server_url = server_url
        self.node_name = node_name
        self.node_location = node_location
        self.mode = mode
        
        # Configure based on mode
        if self.mode == 'sleep':
            self.storage_dir = SLEEP_STORAGE_DIR
            self.clip_duration = SLEEP_BATCH_DURATION
            Path(SLEEP_STORAGE_DIR).mkdir(parents=True, exist_ok=True)
        else:
            self.storage_dir = LOCAL_STORAGE_DIR
            self.clip_duration = BATCH_DURATION
        
        # Components (initialized based on mode)
        self.client = None
        self.recorder = None
        self.uploader = None
        
        # State
        self.is_running = False
        self.is_muted = False
        self.last_heartbeat = 0
        
    def setup_homemic_mode(self):
        """Setup components for HomeMic transcription mode"""
        self.client = ServerClient(self.server_url)
        self.recorder = BatchRecorder(
            storage_dir=self.storage_dir,
            clip_duration=self.clip_duration
        )
        self.uploader = BatchUploader(
            server_url=self.server_url,
            storage_dir=self.storage_dir
        )
        
    def setup_sleep_mode(self):
        """Setup components for Sleep tracking mode"""
        if not SLEEP_MODE_AVAILABLE:
            raise RuntimeError("Sleep mode not available - install sleep_mode.py")
        
        # No registration needed for sleep mode
        self.client = None
        
        # Use shorter clips for sleep mode
        self.recorder = BatchRecorder(
            storage_dir=self.storage_dir,
            clip_duration=self.clip_duration
        )
        
        # Use sleep uploader
        self.uploader = SleepUploader(
            server_url=self.server_url,
            storage_dir=self.storage_dir
        )
        
    def load_config(self):
        """Load saved configuration (node ID, etc.)"""
        if self.mode != 'homemic':
            return
            
        if os.path.exists(CONFIG_FILE):
            try:
                with open(CONFIG_FILE, 'r') as f:
                    config = json.load(f)
                    if self.client:
                        self.client.node_id = config.get('node_id')
                    logger.info(f"Loaded saved node ID: {config.get('node_id')}")
            except Exception as e:
                logger.warning(f"Failed to load config: {e}")
    
    def save_config(self):
        """Save configuration"""
        if self.mode != 'homemic' or not self.client:
            return
            
        try:
            config = {
                'node_id': self.client.node_id,
                'server_url': self.server_url,
                'node_name': self.node_name,
                'node_location': self.node_location
            }
            with open(CONFIG_FILE, 'w') as f:
                json.dump(config, f, indent=2)
            logger.info("Configuration saved")
        except Exception as e:
            logger.error(f"Failed to save config: {e}")
    
    def register(self) -> bool:
        """Register node with server (HomeMic mode only)"""
        if self.mode != 'homemic' or not self.client:
            return True  # Sleep mode doesn't need registration
        
        # Check server health
        if not self.client.health_check():
            logger.error("Server unreachable")
            return False
        
        # Register if no saved node ID
        if not self.client.node_id:
            node_id = self.client.register_node(self.node_name, self.node_location)
            if not node_id:
                logger.error("Failed to register with server")
                return False
            self.save_config()
        else:
            # Verify existing registration with heartbeat
            if not self.client.send_heartbeat():
                logger.warning("Heartbeat failed, re-registering...")
                self.client.node_id = None
                node_id = self.client.register_node(self.node_name, self.node_location)
                if not node_id:
                    return False
                self.save_config()
        
        return True
    
    def send_heartbeat(self):
        """Send periodic heartbeat (HomeMic mode only)"""
        if self.mode != 'homemic' or not self.client:
            return
            
        now = time.time()
        if now - self.last_heartbeat >= HEARTBEAT_INTERVAL:
            self.client.send_heartbeat()
            self.last_heartbeat = now
            
            # Check privacy/mute status
            self.is_muted = self.client.get_privacy_status()
            if self.is_muted:
                logger.info("Node is currently muted")
    
    def handle_audio_level(self, rms: float):
        """Send audio level for real-time visualization"""
        if self.mode == 'homemic' and self.client:
            self.client.send_audio_level(rms)
        elif self.mode == 'sleep' and self.uploader:
            self.uploader.set_audio_level(rms)
    
    def handle_clip_complete(self, clip_path: str):
        """Called when a new clip is finished recording"""
        logger.info(f"New clip ready: {clip_path}")
    
    def handle_upload_complete(self, filename: str, result: dict):
        """Called when upload succeeds"""
        if self.mode == 'sleep':
            logger.info(f"🌙 Sleep clip processed: {filename}")
        else:
            status = result.get('status', 'unknown')
            if status == 'transcribed':
                text = result.get('text', '')[:100]
                logger.info(f"Transcribed [{filename}]: {text}...")
            else:
                logger.info(f"Upload complete: {filename} (status: {status})")
    
    def run(self):
        """Main run loop"""
        # Setup mode-specific components
        if self.mode == 'sleep':
            self.setup_sleep_mode()
            mode_emoji = "🌙"
            mode_name = "Sleep Tracking"
        else:
            self.setup_homemic_mode()
            mode_emoji = "🎤"
            mode_name = "HomeMic Transcription"
        
        logger.info("=" * 60)
        logger.info(f"{mode_emoji} HomeMic Node Agent ({mode_name} Mode)")
        logger.info("=" * 60)
        logger.info(f"Server: {self.server_url}")
        logger.info(f"Mode: {self.mode}")
        logger.info(f"Clip duration: {self.clip_duration} seconds")
        logger.info(f"Storage: {self.storage_dir}")
        
        if self.mode == 'homemic':
            logger.info(f"Node: {self.node_name} ({self.node_location})")
            
            # Load saved config
            self.load_config()
            
            # Register with server
            if not self.register():
                logger.error("Failed to register with server. Will retry in offline mode.")
            else:
                logger.info(f"Registered with node ID: {self.client.node_id}")
        
        # Setup callbacks
        self.recorder.on_audio_level = self.handle_audio_level
        self.recorder.on_clip_complete = self.handle_clip_complete
        self.uploader.on_upload_complete = self.handle_upload_complete
        
        # Start uploader
        if self.mode == 'homemic' and self.client and self.client.node_id:
            self.uploader.start(self.client.node_id)
        elif self.mode == 'sleep':
            self.uploader.start()
        
        # Start recorder
        try:
            self.recorder.start()
        except Exception as e:
            logger.error(f"Failed to start audio recording: {e}")
            return
        
        self.is_running = True
        logger.info(f"{mode_emoji} Agent running in {self.mode} mode.")
        logger.info("Press Ctrl+C to stop.")
        
        # Main loop
        try:
            while self.is_running:
                self.send_heartbeat()
                
                # Log status periodically
                if int(time.time()) % 60 == 0:
                    pending = self.uploader.get_pending_count()
                    logger.info(
                        f"Status: Clips recorded: {self.recorder.clips_recorded}, "
                        f"Uploaded: {self.uploader.clips_uploaded}, "
                        f"Pending: {pending}"
                    )
                    self.uploader.cleanup_uploaded(keep_days=0)
                
                time.sleep(1)
                
        except KeyboardInterrupt:
            logger.info("Interrupted by user")
        finally:
            self.stop()
    
    def stop(self):
        """Stop the agent"""
        self.is_running = False
        if self.recorder:
            self.recorder.stop()
        if self.uploader:
            self.uploader.stop()
        
        mode_emoji = "🌙" if self.mode == 'sleep' else "🎤"
        logger.info("=" * 60)
        logger.info(f"{mode_emoji} Agent stopped.")
        if self.recorder:
            logger.info(f"Clips recorded: {self.recorder.clips_recorded}")
        if self.uploader:
            logger.info(f"Clips uploaded: {self.uploader.clips_uploaded}")
            logger.info(f"Pending uploads: {self.uploader.get_pending_count()}")
        logger.info("=" * 60)


def main():
    parser = argparse.ArgumentParser(
        description='HomeMic Node Agent - Multi-Mode (HomeMic + Sleep Tracking)'
    )
    parser.add_argument('--mode', '-m', default=AGENT_MODE, choices=['homemic', 'sleep'],
                        help=f'Agent mode: homemic (transcription) or sleep (tracking) (default: {AGENT_MODE})')
    parser.add_argument('--server', '-s', default=None,
                        help='Server URL (defaults based on mode)')
    parser.add_argument('--name', '-n', default=NODE_NAME,
                        help=f'Node name (default: {NODE_NAME})')
    parser.add_argument('--location', '-l', default=NODE_LOCATION,
                        help=f'Node location (default: {NODE_LOCATION})')
    parser.add_argument('--list-devices', action='store_true',
                        help='List available audio devices and exit')
    
    args = parser.parse_args()
    
    # List devices mode
    if args.list_devices:
        capture = AudioCapture()
        print("Available audio input devices:")
        for device in capture.list_devices():
            default = " (default)" if device.get('default') else ""
            print(f"  [{device['index']}] {device['name']} "
                  f"({device['channels']}ch, {device['sample_rate']}Hz){default}")
        return
    
    # Determine server URL based on mode
    if args.server:
        server_url = args.server
    elif args.mode == 'sleep':
        server_url = SLEEP_SERVER_URL
    else:
        server_url = SERVER_URL
    
    # Create and run agent
    agent = HomeMicAgent(
        server_url=server_url,
        node_name=args.name,
        node_location=args.location,
        mode=args.mode
    )
    
    # Handle signals
    def signal_handler(sig, frame):
        agent.stop()
        sys.exit(0)
    
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    agent.run()


if __name__ == "__main__":
    main()
