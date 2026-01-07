#!/usr/bin/env python3
"""
Sleep System - Raspberry Pi Audio Capture Agent
Captures audio from USB microphone and sends to server for processing.
"""

import os
import sys
import time
import wave
import queue
import threading
import logging
import requests
from datetime import datetime
from pathlib import Path

import pyaudio
import yaml

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Load configuration
CONFIG_PATH = Path(__file__).parent / 'config.yaml'

def load_config():
    """Load configuration from YAML file."""
    if CONFIG_PATH.exists():
        with open(CONFIG_PATH, 'r') as f:
            return yaml.safe_load(f)
    return {
        'server_url': 'http://192.168.1.100:3001',
        'pi_id': 'bedroom-pi',
        'audio': {
            'sample_rate': 16000,
            'channels': 1,
            'chunk_size': 1024,
            'format': 'paInt16',
            'chunk_duration_seconds': 60,
            'device_index': None
        },
        'buffer': {
            'max_files': 100,
            'retry_interval': 30
        }
    }

config = load_config()

# Audio settings
SAMPLE_RATE = config['audio']['sample_rate']
CHANNELS = config['audio']['channels']
CHUNK_SIZE = config['audio']['chunk_size']
CHUNK_DURATION = config['audio']['chunk_duration_seconds']
DEVICE_INDEX = config['audio'].get('device_index')

# Server settings
SERVER_URL = config['server_url']
PI_ID = config['pi_id']

# Buffer directory for network resilience
BUFFER_DIR = Path(__file__).parent / 'audio_buffer'
BUFFER_DIR.mkdir(exist_ok=True)


class AudioCapture:
    """Handles continuous audio capture from USB microphone."""
    
    def __init__(self):
        self.audio = pyaudio.PyAudio()
        self.stream = None
        self.is_recording = False
        self.audio_queue = queue.Queue()
        
    def find_usb_mic(self):
        """Find USB microphone device index."""
        logger.info("Searching for USB microphone...")
        
        for i in range(self.audio.get_device_count()):
            info = self.audio.get_device_info_by_index(i)
            name = info['name'].lower()
            
            # Look for USB audio devices
            if info['maxInputChannels'] > 0 and ('usb' in name or 'mic' in name):
                logger.info(f"Found USB mic: {info['name']} (index {i})")
                return i
        
        # Fall back to default input
        try:
            default = self.audio.get_default_input_device_info()
            logger.info(f"Using default input: {default['name']}")
            return default['index']
        except:
            logger.error("No input device found!")
            return None
    
    def start(self):
        """Start audio capture."""
        device_index = DEVICE_INDEX or self.find_usb_mic()
        
        if device_index is None:
            raise RuntimeError("No audio input device available")
        
        self.stream = self.audio.open(
            format=pyaudio.paInt16,
            channels=CHANNELS,
            rate=SAMPLE_RATE,
            input=True,
            input_device_index=device_index,
            frames_per_buffer=CHUNK_SIZE,
            stream_callback=self._audio_callback
        )
        
        self.is_recording = True
        self.stream.start_stream()
        logger.info(f"🎤 Audio capture started (device {device_index})")
    
    def _audio_callback(self, in_data, frame_count, time_info, status):
        """Callback for audio stream."""
        if status:
            logger.warning(f"Audio status: {status}")
        self.audio_queue.put(in_data)
        return (None, pyaudio.paContinue)
    
    def stop(self):
        """Stop audio capture."""
        self.is_recording = False
        if self.stream:
            self.stream.stop_stream()
            self.stream.close()
        self.audio.terminate()
        logger.info("Audio capture stopped")
    
    def get_audio_data(self, duration_seconds):
        """Collect audio data for specified duration."""
        frames = []
        frames_needed = int(SAMPLE_RATE / CHUNK_SIZE * duration_seconds)
        
        while len(frames) < frames_needed and self.is_recording:
            try:
                data = self.audio_queue.get(timeout=1)
                frames.append(data)
            except queue.Empty:
                continue
        
        return b''.join(frames)
    
    def calculate_audio_level(self, audio_data):
        """Calculate RMS audio level for visualization."""
        import struct
        
        # Unpack audio data
        count = len(audio_data) // 2
        shorts = struct.unpack(f'{count}h', audio_data)
        
        # Calculate RMS
        sum_squares = sum(s ** 2 for s in shorts)
        rms = (sum_squares / count) ** 0.5
        
        # Normalize to 0-100 scale
        level = min(100, (rms / 32768) * 100 * 5)
        return round(level, 2)


class AudioTransmitter:
    """Handles sending audio chunks to the server."""
    
    def __init__(self):
        self.session_id = None
        
    def send_chunk(self, audio_data, audio_level):
        """Send audio chunk to server."""
        timestamp = datetime.now().isoformat()
        filename = f"audio_{datetime.now().strftime('%Y%m%d_%H%M%S')}.wav"
        filepath = BUFFER_DIR / filename
        
        # Save to buffer first (for resilience)
        self._save_wav(filepath, audio_data)
        
        try:
            # Send to server
            with open(filepath, 'rb') as f:
                response = requests.post(
                    f"{SERVER_URL}/api/audio/upload",
                    files={'audio': (filename, f, 'audio/wav')},
                    data={
                        'piId': PI_ID,
                        'sessionId': self.session_id or '',
                        'timestamp': timestamp,
                        'audioLevel': str(audio_level)
                    },
                    timeout=30
                )
            
            if response.status_code == 200:
                result = response.json()
                self.session_id = result.get('sessionId', self.session_id)
                logger.info(f"✅ Sent: {filename} (level: {audio_level})")
                
                # Remove from buffer after successful send
                filepath.unlink(missing_ok=True)
                return True
            else:
                logger.error(f"Server error: {response.status_code}")
                return False
                
        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Network error: {e}")
            logger.info(f"Buffered locally: {filename}")
            return False
    
    def _save_wav(self, filepath, audio_data):
        """Save audio data as WAV file."""
        with wave.open(str(filepath), 'wb') as wf:
            wf.setnchannels(CHANNELS)
            wf.setsampwidth(2)  # 16-bit
            wf.setframerate(SAMPLE_RATE)
            wf.writeframes(audio_data)
    
    def retry_buffered(self):
        """Retry sending buffered audio files."""
        buffered_files = sorted(BUFFER_DIR.glob('*.wav'))
        
        for filepath in buffered_files[:10]:  # Send up to 10 at a time
            try:
                with open(filepath, 'rb') as f:
                    response = requests.post(
                        f"{SERVER_URL}/api/audio/upload",
                        files={'audio': (filepath.name, f, 'audio/wav')},
                        data={'piId': PI_ID},
                        timeout=30
                    )
                
                if response.status_code == 200:
                    filepath.unlink(missing_ok=True)
                    logger.info(f"✅ Retry sent: {filepath.name}")
            except:
                break  # Stop if still offline


def main():
    """Main entry point."""
    logger.info("=" * 50)
    logger.info("🌙 Sleep System Audio Agent Starting")
    logger.info(f"Server: {SERVER_URL}")
    logger.info(f"Pi ID: {PI_ID}")
    logger.info(f"Chunk duration: {CHUNK_DURATION}s")
    logger.info("=" * 50)
    
    capture = AudioCapture()
    transmitter = AudioTransmitter()
    
    try:
        capture.start()
        
        while True:
            # Capture audio chunk
            audio_data = capture.get_audio_data(CHUNK_DURATION)
            
            if audio_data:
                # Calculate audio level for visualization
                audio_level = capture.calculate_audio_level(audio_data)
                
                # Send to server
                transmitter.send_chunk(audio_data, audio_level)
                
                # Periodically retry buffered files
                if len(list(BUFFER_DIR.glob('*.wav'))) > 0:
                    transmitter.retry_buffered()
                    
    except KeyboardInterrupt:
        logger.info("\n🛑 Stopping audio capture...")
    finally:
        capture.stop()


if __name__ == '__main__':
    main()
