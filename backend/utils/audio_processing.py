"""Shared audio processing utilities for download and conversion.

Extracted from video_import.py to be reused by transcription_routes.py.
"""

import os
import subprocess
from pathlib import Path

from fastapi import HTTPException


def check_yt_dlp() -> str:
    """Return yt-dlp binary path or raise 503."""
    for path in ("/usr/local/bin/yt-dlp", "/usr/bin/yt-dlp"):
        if os.path.isfile(path):
            return path
    raise HTTPException(
        status_code=503,
        detail="yt-dlp is not installed. Run: pip install yt-dlp",
    )


def extract_audio_from_url(url: str, output_path: str) -> str:
    """Download and extract audio from a URL using yt-dlp.

    Args:
        url: Media URL (YouTube, direct link, etc.)
        output_path: yt-dlp output template (may contain %(ext)s)

    Returns:
        The output_path argument (yt-dlp resolves the template on disk).
    """
    yt_dlp = check_yt_dlp()
    try:
        subprocess.run(
            [
                yt_dlp, "-x", "--audio-format", "wav",
                "--audio-quality", "0",
                "--no-playlist",
                "--max-filesize", "500m",
                "-o", output_path,
                url,
            ],
            capture_output=True, check=True, timeout=600,
        )
    except subprocess.TimeoutExpired:
        raise HTTPException(
            status_code=408,
            detail="Download timed out (10 min limit)",
        )
    except subprocess.CalledProcessError as e:
        stderr = e.stderr.decode()[:500] if e.stderr else "Unknown error"
        raise HTTPException(
            status_code=400,
            detail=f"Failed to download: {stderr}",
        )
    return output_path


def convert_to_mono_wav(
    input_path: str,
    output_path: str,
    start_s: float = 0,
    duration_s: float | None = None,
    sample_rate: int = 24000,
) -> float:
    """Convert audio/video to mono WAV using ffmpeg. Returns actual duration.

    Args:
        input_path: Source media file.
        output_path: Destination WAV path.
        start_s: Seek offset in seconds.
        duration_s: Max duration (None = full file).
        sample_rate: Target sample rate.

    Returns:
        Actual duration of the output file in seconds.
    """
    cmd = [
        "ffmpeg", "-y", "-i", input_path,
        "-ss", str(start_s),
    ]
    if duration_s is not None:
        cmd += ["-t", str(duration_s)]
    cmd += [
        "-ar", str(sample_rate), "-ac", "1",
        "-acodec", "pcm_s16le",
        output_path,
    ]
    try:
        subprocess.run(cmd, capture_output=True, check=True, timeout=300)
    except subprocess.CalledProcessError as e:
        stderr = e.stderr.decode()[:300] if e.stderr else ""
        raise HTTPException(
            status_code=400,
            detail=f"Audio processing failed: {stderr}",
        )

    return get_audio_duration(output_path, fallback=duration_s or 0)


def get_audio_duration(path: str, fallback: float = 0) -> float:
    """Get duration of an audio file via ffprobe."""
    try:
        result = subprocess.run(
            [
                "ffprobe", "-v", "error",
                "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1",
                path,
            ],
            capture_output=True, check=True, timeout=30,
        )
        return float(result.stdout.decode().strip())
    except Exception:
        return fallback
