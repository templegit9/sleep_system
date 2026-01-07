"""
HomeMic Node Agent - Sleep Mode Extension
Adds sleep tracking capabilities to the existing HomeMic agent.
"""
import os
import time
import threading
import requests
import logging
import struct
from pathlib import Path
from typing import Optional, Callable, Dict, Any
from datetime import datetime

logger = logging.getLogger(__name__)


class SleepModeClient:
    """Client for communicating with Sleep Tracking Server"""
    
    def __init__(self, server_url: str):
        self.server_url = server_url.rstrip('/')
        self.session = requests.Session()
        self.session_id: Optional[str] = None
        self.pi_id = os.environ.get('SLEEP_PI_ID', 'bedroom-pi')
        
    def start_session(self) -> Optional[str]:
        """Start a new sleep session"""
        try:
            response = self.session.post(
                f"{self.server_url}/api/sessions/start",
                timeout=10
            )
            if response.status_code == 200:
                data = response.json()
                self.session_id = data.get('id')
                logger.info(f"🌙 Sleep session started: {self.session_id}")
                return self.session_id
        except Exception as e:
            logger.error(f"Failed to start sleep session: {e}")
        return None
    
    def end_session(self) -> bool:
        """End the current sleep session"""
        if not self.session_id:
            return False
        
        try:
            response = self.session.post(
                f"{self.server_url}/api/sessions/{self.session_id}/end",
                timeout=10
            )
            if response.status_code == 200:
                # Calculate efficiency score
                self.session.post(
                    f"{self.server_url}/api/sessions/{self.session_id}/calculate-score",
                    timeout=10
                )
                logger.info("🌅 Sleep session ended")
                self.session_id = None
                return True
        except Exception as e:
            logger.error(f"Failed to end sleep session: {e}")
        return False
    
    def upload_audio(self, file_path: Path, audio_level: float = 0) -> bool:
        """Upload audio chunk to sleep server"""
        try:
            with open(file_path, 'rb') as f:
                response = self.session.post(
                    f"{self.server_url}/api/audio/upload",
                    files={'audio': (file_path.name, f, 'audio/wav')},
                    data={
                        'piId': self.pi_id,
                        'sessionId': self.session_id or '',
                        'timestamp': datetime.now().isoformat(),
                        'audioLevel': str(audio_level)
                    },
                    timeout=120
                )
            
            if response.status_code == 200:
                result = response.json()
                # Store session ID if returned
                if not self.session_id:
                    self.session_id = result.get('sessionId')
                return True
            else:
                logger.warning(f"Sleep upload failed: {response.status_code}")
                return False
                
        except Exception as e:
            logger.error(f"Sleep upload error: {e}")
            return False
    
    def send_audio_level(self, level: float):
        """Send real-time audio level for visualization"""
        # This is handled on the upload, no separate endpoint needed
        pass


class SleepUploader:
    """Uploader that sends audio to Sleep Tracking Server instead of HomeMic"""
    
    def __init__(
        self,
        server_url: str,
        storage_dir: str,
    ):
        self.client = SleepModeClient(server_url)
        self.storage_dir = Path(storage_dir)
        self.is_running = False
        self._thread: Optional[threading.Thread] = None
        
        # Callbacks
        self.on_upload_complete: Optional[Callable[[str, Dict], None]] = None
        
        # Stats
        self.clips_uploaded = 0
        self.last_audio_level = 0.0
        
    def start(self, node_id: str = None):
        """Start the sleep uploader"""
        if self.is_running:
            return
        
        # Start a sleep session
        self.client.start_session()
        
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        self.is_running = True
        self._thread = threading.Thread(target=self._upload_loop, daemon=True)
        self._thread.start()
        logger.info(f"🌙 Sleep uploader started, session: {self.client.session_id}")
    
    def stop(self):
        """Stop the uploader and end sleep session"""
        self.is_running = False
        self.client.end_session()
        if self._thread:
            self._thread.join(timeout=5.0)
        logger.info(f"Sleep uploader stopped. Uploaded: {self.clips_uploaded}")
    
    def set_audio_level(self, level: float):
        """Track the latest audio level for uploads"""
        self.last_audio_level = level
    
    def _upload_loop(self):
        """Main upload loop"""
        while self.is_running:
            try:
                wav_files = list(self.storage_dir.glob("*.wav"))
                
                for wav_file in wav_files:
                    if not self.is_running:
                        break
                    
                    # Skip files being recorded or already uploaded
                    if wav_file.with_suffix('.recording').exists():
                        continue
                    if wav_file.with_suffix('.uploaded').exists():
                        continue
                    
                    # Calculate audio level from file
                    audio_level = self._calculate_audio_level(wav_file)
                    
                    # Upload to sleep server
                    if self.client.upload_audio(wav_file, audio_level):
                        self.clips_uploaded += 1
                        wav_file.with_suffix('.uploaded').touch()
                        logger.info(f"🌙 Sleep clip uploaded: {wav_file.name}")
                        
                        if self.on_upload_complete:
                            self.on_upload_complete(wav_file.name, {'status': 'uploaded'})
                
                time.sleep(5)
                
            except Exception as e:
                logger.error(f"Sleep upload loop error: {e}")
                time.sleep(10)
    
    def _calculate_audio_level(self, wav_file: Path) -> float:
        """Calculate average RMS level from WAV file"""
        try:
            import wave
            with wave.open(str(wav_file), 'rb') as wf:
                frames = wf.readframes(wf.getnframes())
                if wf.getsampwidth() == 2:
                    count = len(frames) // 2
                    shorts = struct.unpack(f'{count}h', frames)
                    # Sample only portion for speed
                    sample = shorts[::100] if len(shorts) > 1000 else shorts
                    sum_squares = sum(s ** 2 for s in sample)
                    rms = (sum_squares / len(sample)) ** 0.5
                    # Normalize to 0-100
                    return min(100, (rms / 32768) * 100 * 5)
        except Exception as e:
            logger.debug(f"Could not calculate audio level: {e}")
        return 0.0
    
    def get_pending_count(self) -> int:
        """Get number of pending uploads"""
        if not self.storage_dir.exists():
            return 0
        
        pending = 0
        for wav_file in self.storage_dir.glob("*.wav"):
            if not wav_file.with_suffix('.uploaded').exists():
                if not wav_file.with_suffix('.recording').exists():
                    pending += 1
        return pending
    
    def cleanup_uploaded(self, keep_days: int = 0):
        """Clean up uploaded files"""
        if not self.storage_dir.exists():
            return
        
        for uploaded_marker in self.storage_dir.glob("*.uploaded"):
            wav_file = uploaded_marker.with_suffix('.wav')
            if wav_file.exists():
                wav_file.unlink()
            uploaded_marker.unlink()
