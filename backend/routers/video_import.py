"""Video/URL voice import routes.

Extract audio from video files or URLs (YouTube, etc.),
auto-transcribe, and create a voice profile with samples.
"""

import asyncio
import logging
import os
import tempfile
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from .. import config, profiles, models
from ..database import get_db
from ..utils.audio_processing import extract_audio_from_url, convert_to_mono_wav

logger = logging.getLogger(__name__)
router = APIRouter(tags=["video-import"])

# Maximum file size: 200MB
MAX_FILE_SIZE = 200 * 1024 * 1024
# Max clip duration for voice samples (seconds)
MAX_CLIP_DURATION = 30
MIN_CLIP_DURATION = 3


async def _transcribe_audio(audio_path: str, language: str = "en") -> str:
    """Transcribe audio using faster-whisper."""
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        raise HTTPException(
            status_code=503,
            detail="faster-whisper is not installed",
        )

    def _run_transcription():
        model = WhisperModel("base", device="cpu", compute_type="int8")
        segments, _ = model.transcribe(
            audio_path,
            language=language if language != "auto" else None,
            beam_size=5,
        )
        return " ".join(seg.text.strip() for seg in segments)

    text = await asyncio.to_thread(_run_transcription)
    if not text or len(text.strip()) < 5:
        raise HTTPException(
            status_code=400,
            detail="Transcription produced no usable text. Ensure the audio has clear speech.",
        )
    return text.strip()


@router.post("/profiles/from-url")
async def import_profile_from_url(
    url: str = Form(...),
    name: str = Form(...),
    language: str = Form(default="en"),
    description: Optional[str] = Form(default=None),
    clip_start: float = Form(default=0, ge=0),
    clip_duration: float = Form(default=15, ge=MIN_CLIP_DURATION, le=MAX_CLIP_DURATION),
    db: Session = Depends(get_db),
):
    """Import a voice profile from a video/audio URL.

    Pipeline: download -> extract audio -> clip -> transcribe -> create profile + sample.
    """
    with tempfile.TemporaryDirectory(prefix="voicebox_import_") as tmpdir:
        # Step 1: Download audio
        raw_path = os.path.join(tmpdir, "raw.%(ext)s")
        extract_audio_from_url(url, raw_path)

        # Find the downloaded file (yt-dlp replaces %(ext)s)
        downloaded = list(Path(tmpdir).glob("raw.*"))
        if not downloaded:
            raise HTTPException(status_code=400, detail="Download produced no audio file")
        raw_audio = str(downloaded[0])

        # Step 2: Prepare clip (mono, 24kHz, trimmed)
        clip_path = os.path.join(tmpdir, "clip.wav")
        actual_duration = convert_to_mono_wav(
            raw_audio, clip_path, clip_start, clip_duration,
        )

        if actual_duration < MIN_CLIP_DURATION:
            raise HTTPException(
                status_code=400,
                detail=f"Clip too short ({actual_duration:.1f}s). Need at least {MIN_CLIP_DURATION}s.",
            )

        # Step 3: Transcribe
        transcript = await _transcribe_audio(clip_path, language)

        # Step 4: Create profile
        profile_data = models.VoiceProfileCreate(
            name=name,
            description=description or "Imported from URL",
            language=language,
        )
        profile = await profiles.create_profile(data=profile_data, db=db)

        # Step 5: Add sample (profiles module handles file copy + quality metrics)
        sample = await profiles.add_profile_sample(
            profile_id=profile.id,
            audio_path=clip_path,
            reference_text=transcript,
            db=db,
        )

        return {
            "profile_id": profile.id,
            "profile_name": profile.name,
            "sample_id": sample.id,
            "transcript": transcript,
            "clip_duration": actual_duration,
            "message": f"Profile '{name}' created with 1 sample ({actual_duration:.1f}s)",
        }


@router.post("/profiles/from-file")
async def import_profile_from_file(
    file: UploadFile = File(...),
    name: str = Form(...),
    language: str = Form(default="en"),
    description: Optional[str] = Form(default=None),
    clip_start: float = Form(default=0, ge=0),
    clip_duration: float = Form(default=15, ge=MIN_CLIP_DURATION, le=MAX_CLIP_DURATION),
    db: Session = Depends(get_db),
):
    """Import a voice profile from an uploaded video/audio file.

    Accepts: mp4, webm, mkv, mp3, wav, ogg, flac, m4a.
    """
    allowed_extensions = {".mp4", ".webm", ".mkv", ".mp3", ".wav", ".ogg", ".flac", ".m4a", ".avi"}
    ext = Path(file.filename or "").suffix.lower()
    if ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {ext}. Allowed: {', '.join(allowed_extensions)}",
        )

    with tempfile.TemporaryDirectory(prefix="voicebox_import_") as tmpdir:
        # Save uploaded file
        upload_path = os.path.join(tmpdir, f"upload{ext}")
        content = await file.read()
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(status_code=413, detail="File too large (200MB max)")
        with open(upload_path, "wb") as f:
            f.write(content)

        # Prepare clip
        clip_path = os.path.join(tmpdir, "clip.wav")
        actual_duration = convert_to_mono_wav(
            upload_path, clip_path, clip_start, clip_duration,
        )

        if actual_duration < MIN_CLIP_DURATION:
            raise HTTPException(
                status_code=400,
                detail=f"Clip too short ({actual_duration:.1f}s). Need at least {MIN_CLIP_DURATION}s.",
            )

        # Transcribe
        transcript = await _transcribe_audio(clip_path, language)

        # Create profile
        profile_data = models.VoiceProfileCreate(
            name=name,
            description=description or "Imported from file",
            language=language,
        )
        profile = await profiles.create_profile(data=profile_data, db=db)

        # Add sample (profiles module handles file copy + quality metrics)
        sample = await profiles.add_profile_sample(
            profile_id=profile.id,
            audio_path=clip_path,
            reference_text=transcript,
            db=db,
        )

        return {
            "profile_id": profile.id,
            "profile_name": profile.name,
            "sample_id": sample.id,
            "transcript": transcript,
            "clip_duration": actual_duration,
            "message": f"Profile '{name}' created with 1 sample ({actual_duration:.1f}s)",
        }
