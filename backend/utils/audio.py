"""
Audio processing utilities.
"""

import numpy as np
import soundfile as sf
import librosa
from typing import Tuple, Optional


def normalize_audio(
    audio: np.ndarray,
    target_db: float = -20.0,
    peak_limit: float = 0.85,
) -> np.ndarray:
    """
    Normalize audio to target loudness with peak limiting.
    
    Args:
        audio: Input audio array
        target_db: Target RMS level in dB
        peak_limit: Peak limit (0.0-1.0)
        
    Returns:
        Normalized audio array
    """
    # Convert to float32
    audio = audio.astype(np.float32)
    
    # Calculate current RMS
    rms = np.sqrt(np.mean(audio**2))
    
    # Calculate target RMS
    target_rms = 10**(target_db / 20)
    
    # Apply gain
    if rms > 0:
        gain = target_rms / rms
        audio = audio * gain
    
    # Peak limiting
    audio = np.clip(audio, -peak_limit, peak_limit)
    
    return audio


def load_audio(
    path: str,
    sample_rate: int = 24000,
    mono: bool = True,
) -> Tuple[np.ndarray, int]:
    """
    Load audio file with normalization.
    
    Args:
        path: Path to audio file
        sample_rate: Target sample rate
        mono: Convert to mono
        
    Returns:
        Tuple of (audio_array, sample_rate)
    """
    audio, sr = librosa.load(path, sr=sample_rate, mono=mono)
    return audio, sr


def save_audio(
    audio: np.ndarray,
    path: str,
    sample_rate: int = 24000,
) -> None:
    """
    Save audio file.
    
    Args:
        audio: Audio array
        path: Output path
        sample_rate: Sample rate
    """
    sf.write(path, audio, sample_rate)


def compute_audio_quality(audio: np.ndarray, sr: int) -> dict:
    """
    Compute quality metrics for uploaded audio sample.

    Returns dict with: duration_s, rms_db, peak_db, snr_estimate_db,
    silence_ratio, quality (good/fair/poor).
    """
    duration = len(audio) / sr
    rms = np.sqrt(np.mean(audio**2))
    rms_db = 20 * np.log10(rms) if rms > 0 else -100.0
    peak = float(np.abs(audio).max())
    peak_db = 20 * np.log10(peak) if peak > 0 else -100.0

    # Silence detection: frames below -40dB RMS
    frame_len = int(0.025 * sr)  # 25ms frames
    silence_threshold = 10 ** (-40 / 20)
    n_frames = max(1, len(audio) // frame_len)
    silent_frames = 0
    for i in range(n_frames):
        frame = audio[i * frame_len : (i + 1) * frame_len]
        if np.sqrt(np.mean(frame**2)) < silence_threshold:
            silent_frames += 1
    silence_ratio = silent_frames / n_frames

    # Simple SNR estimate: ratio of speech RMS to silence-floor RMS
    snr_db = None
    if silence_ratio > 0.05 and silence_ratio < 0.95:
        speech_rms_vals = []
        silence_rms_vals = []
        for i in range(n_frames):
            frame = audio[i * frame_len : (i + 1) * frame_len]
            frms = np.sqrt(np.mean(frame**2))
            if frms < silence_threshold:
                silence_rms_vals.append(frms)
            else:
                speech_rms_vals.append(frms)
        if speech_rms_vals and silence_rms_vals:
            avg_speech = np.mean(speech_rms_vals)
            avg_noise = np.mean(silence_rms_vals)
            if avg_noise > 0:
                snr_db = round(20 * np.log10(avg_speech / avg_noise), 1)

    # Quality rating
    quality = "good"
    if rms_db < -35 or silence_ratio > 0.5 or (snr_db is not None and snr_db < 8):
        quality = "poor"
    elif rms_db < -28 or silence_ratio > 0.3 or (snr_db is not None and snr_db < 15):
        quality = "fair"

    return {
        "duration_s": round(duration, 2),
        "rms_db": round(rms_db, 1),
        "peak_db": round(peak_db, 1),
        "snr_estimate_db": snr_db,
        "silence_ratio": round(silence_ratio, 3),
        "quality": quality,
    }


def validate_reference_audio(
    audio_path: str,
    min_duration: float = 2.0,
    max_duration: float = 30.0,
    min_rms: float = 0.01,
) -> Tuple[bool, Optional[str]]:
    """
    Validate reference audio for voice cloning.
    
    Args:
        audio_path: Path to audio file
        min_duration: Minimum duration in seconds
        max_duration: Maximum duration in seconds
        min_rms: Minimum RMS level
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    try:
        audio, sr = load_audio(audio_path)
        duration = len(audio) / sr
        
        if duration < min_duration:
            return False, f"Audio too short (minimum {min_duration} seconds)"
        if duration > max_duration:
            return False, f"Audio too long (maximum {max_duration} seconds)"
        
        rms = np.sqrt(np.mean(audio**2))
        if rms < min_rms:
            return False, "Audio is too quiet or silent"
        
        if np.abs(audio).max() > 0.99:
            return False, "Audio is clipping (reduce input gain)"
        
        return True, None
    except Exception as e:
        return False, f"Error validating audio: {str(e)}"
