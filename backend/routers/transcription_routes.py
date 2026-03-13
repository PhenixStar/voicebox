"""Transcription routes with optional speaker diarization.

Endpoints for transcribing uploaded audio/video files or URLs
using faster-whisper, with optional pyannote speaker diarization.
"""

import asyncio
import logging
import os
import tempfile
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from ..models import DiarizedTranscriptionResponse
from ..utils.audio_processing import (
    convert_to_mono_wav,
    extract_audio_from_url,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/transcribe", tags=["transcription"])

# Maximum upload size: 500MB
MAX_FILE_SIZE = 500 * 1024 * 1024

ALLOWED_EXTENSIONS = {
    ".mp4", ".webm", ".mkv", ".mp3", ".wav",
    ".ogg", ".flac", ".m4a", ".avi",
}

VALID_MODEL_SIZES = {"tiny", "base", "small", "medium", "large-v3"}


# ---------------------------------------------------------------------------
# Core helpers
# ---------------------------------------------------------------------------

async def _transcribe_full(
    audio_path: str,
    language: str = "auto",
    model_size: str = "base",
) -> dict:
    """Transcribe entire audio file, returning segments with timestamps."""
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        raise HTTPException(
            status_code=503,
            detail="faster-whisper is not installed",
        )

    if model_size not in VALID_MODEL_SIZES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid model_size: {model_size}. "
                   f"Choose from: {', '.join(sorted(VALID_MODEL_SIZES))}",
        )

    def _run():
        model = WhisperModel(model_size, device="cpu", compute_type="int8")
        lang = language if language not in ("auto", None, "") else None
        segments, info = model.transcribe(
            audio_path, language=lang, beam_size=5, word_timestamps=False,
        )
        result_segments = []
        full_text_parts = []
        for seg in segments:
            result_segments.append({
                "start": round(seg.start, 2),
                "end": round(seg.end, 2),
                "text": seg.text.strip(),
            })
            full_text_parts.append(seg.text.strip())
        return {
            "segments": result_segments,
            "text": " ".join(full_text_parts),
            "language": info.language,
            "duration": round(info.duration, 2),
        }

    return await asyncio.to_thread(_run)


async def _diarize_segments(
    audio_path: str,
    segments: list,
) -> tuple[list, list]:
    """Add speaker labels to segments using pyannote. Graceful fallback."""
    try:
        from pyannote.audio import Pipeline  # noqa: F401
    except ImportError:
        logger.warning(
            "pyannote-audio not installed -- returning segments without speaker labels"
        )
        return segments, []

    hf_token = os.environ.get("HF_TOKEN") or os.environ.get("HUGGINGFACE_TOKEN")
    if not hf_token:
        logger.warning("No HuggingFace token -- skipping diarization")
        return segments, []

    def _run():
        from pyannote.audio import Pipeline as _Pipeline

        pipeline = _Pipeline.from_pretrained(
            "pyannote/speaker-diarization-3.1",
            use_auth_token=hf_token,
        )
        diarization = pipeline(audio_path)

        speakers_seen: set[str] = set()
        labeled = []
        for seg in segments:
            mid = (seg["start"] + seg["end"]) / 2
            speaker = None
            for turn, _, spk in diarization.itertracks(yield_label=True):
                if turn.start <= mid <= turn.end:
                    speaker = spk
                    break
            if speaker:
                speakers_seen.add(speaker)
            labeled.append({**seg, "speaker": speaker})

        return labeled, sorted(speakers_seen)

    return await asyncio.to_thread(_run)


# ---------------------------------------------------------------------------
# Shared pipeline
# ---------------------------------------------------------------------------

async def _run_transcription_pipeline(
    input_path: str,
    language: str,
    diarize: bool,
    model_size: str,
) -> DiarizedTranscriptionResponse:
    """Convert to WAV, transcribe, optionally diarize."""
    with tempfile.TemporaryDirectory(prefix="voicebox_transcribe_") as tmpdir:
        wav_path = os.path.join(tmpdir, "audio.wav")
        convert_to_mono_wav(input_path, wav_path)

        result = await _transcribe_full(wav_path, language, model_size)
        segments = result["segments"]
        speakers: list[str] = []

        if diarize:
            segments, speakers = await _diarize_segments(wav_path, segments)

        return DiarizedTranscriptionResponse(
            text=result["text"],
            duration=result["duration"],
            language=result["language"],
            segments=segments,
            speakers=speakers,
        )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/file", response_model=DiarizedTranscriptionResponse)
async def transcribe_file(
    file: UploadFile = File(...),
    language: str = Form(default="auto"),
    diarize: bool = Form(default=False),
    model_size: str = Form(default="base"),
):
    """Transcribe an uploaded audio/video file with optional speaker diarization."""
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {ext}. "
                   f"Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )

    with tempfile.TemporaryDirectory(prefix="voicebox_upload_") as tmpdir:
        upload_path = os.path.join(tmpdir, f"upload{ext}")
        content = await file.read()
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(status_code=413, detail="File too large (500MB max)")
        with open(upload_path, "wb") as f:
            f.write(content)

        return await _run_transcription_pipeline(
            upload_path, language, diarize, model_size,
        )


@router.post("/url", response_model=DiarizedTranscriptionResponse)
async def transcribe_url(
    url: str = Form(...),
    language: str = Form(default="auto"),
    diarize: bool = Form(default=False),
    model_size: str = Form(default="base"),
):
    """Transcribe audio/video from a URL with optional speaker diarization.

    Downloads via yt-dlp, converts to WAV, transcribes with faster-whisper.
    """
    with tempfile.TemporaryDirectory(prefix="voicebox_url_") as tmpdir:
        raw_path = os.path.join(tmpdir, "raw.%(ext)s")
        extract_audio_from_url(url, raw_path)

        downloaded = list(Path(tmpdir).glob("raw.*"))
        if not downloaded:
            raise HTTPException(
                status_code=400,
                detail="Download produced no audio file",
            )

        return await _run_transcription_pipeline(
            str(downloaded[0]), language, diarize, model_size,
        )
