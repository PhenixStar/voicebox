"""History, transcription, audio serving, and export routes."""

from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional
import asyncio
import tempfile
import io
from pathlib import Path

from .. import models, history, export_import, transcribe, config
from ..database import get_db, Generation as DBGeneration, VoiceProfile as DBVoiceProfile
from ..utils.tasks import get_task_manager

router = APIRouter(tags=["history"])


@router.get("/history", response_model=models.HistoryListResponse)
async def list_history(
    profile_id: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    """List generation history with optional filters."""
    query = models.HistoryQuery(
        profile_id=profile_id,
        search=search,
        limit=limit,
        offset=offset,
    )
    return await history.list_generations(query, db)


@router.get("/history/stats")
async def get_stats(db: Session = Depends(get_db)):
    """Get generation statistics."""
    return await history.get_generation_stats(db)


@router.post("/history/import")
async def import_generation(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Import a generation from a ZIP archive."""
    MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB

    content_length = file.size
    if content_length and content_length > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size is {MAX_FILE_SIZE / (1024 * 1024):.0f}MB"
        )

    chunks = []
    total = 0
    while chunk := await file.read(64 * 1024):
        total += len(chunk)
        if total > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=413,
                detail=f"File too large. Maximum size is {MAX_FILE_SIZE / (1024 * 1024):.0f}MB"
            )
        chunks.append(chunk)
    content = b"".join(chunks)

    try:
        result = await export_import.import_generation_from_zip(content, db)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/history/{generation_id}", response_model=models.HistoryResponse)
async def get_generation(
    generation_id: str,
    db: Session = Depends(get_db),
):
    """Get a generation by ID."""
    result = db.query(
        DBGeneration,
        DBVoiceProfile.name.label('profile_name')
    ).join(
        DBVoiceProfile,
        DBGeneration.profile_id == DBVoiceProfile.id
    ).filter(
        DBGeneration.id == generation_id
    ).first()

    if not result:
        raise HTTPException(status_code=404, detail="Generation not found")

    gen, profile_name = result
    return models.HistoryResponse(
        id=gen.id,
        profile_id=gen.profile_id,
        profile_name=profile_name,
        text=gen.text,
        language=gen.language,
        audio_path=gen.audio_path,
        duration=gen.duration,
        seed=gen.seed,
        instruct=gen.instruct,
        created_at=gen.created_at,
    )


@router.delete("/history/{generation_id}")
async def delete_generation(
    generation_id: str,
    db: Session = Depends(get_db),
):
    """Delete a generation."""
    success = await history.delete_generation(generation_id, db)
    if not success:
        raise HTTPException(status_code=404, detail="Generation not found")
    return {"message": "Generation deleted successfully"}


@router.get("/history/{generation_id}/export")
async def export_generation(
    generation_id: str,
    db: Session = Depends(get_db),
):
    """Export a generation as a ZIP archive."""
    try:
        generation = db.query(DBGeneration).filter_by(id=generation_id).first()
        if not generation:
            raise HTTPException(status_code=404, detail="Generation not found")

        zip_bytes = export_import.export_generation_to_zip(generation_id, db)

        safe_text = "".join(c for c in generation.text[:30] if c.isalnum() or c in (' ', '-', '_')).strip()
        if not safe_text:
            safe_text = "generation"
        filename = f"generation-{safe_text}.voicebox.zip"

        return StreamingResponse(
            io.BytesIO(zip_bytes),
            media_type="application/zip",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"'
            }
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/history/{generation_id}/export-audio")
async def export_generation_audio(
    generation_id: str,
    db: Session = Depends(get_db),
):
    """Export only the audio file from a generation."""
    generation = db.query(DBGeneration).filter_by(id=generation_id).first()
    if not generation:
        raise HTTPException(status_code=404, detail="Generation not found")

    audio_path = Path(generation.audio_path)
    if not audio_path.exists():
        raise HTTPException(status_code=404, detail="Audio file not found")

    safe_text = "".join(c for c in generation.text[:30] if c.isalnum() or c in (' ', '-', '_')).strip()
    if not safe_text:
        safe_text = "generation"
    filename = f"{safe_text}.wav"

    return FileResponse(
        audio_path,
        media_type="audio/wav",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )


# -- Transcription endpoint --

@router.post("/transcribe", response_model=models.TranscriptionResponse)
async def transcribe_audio(
    file: UploadFile = File(...),
    language: Optional[str] = Form(None),
):
    """Transcribe audio file to text."""
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        from ..utils.audio import load_audio
        audio, sr = load_audio(tmp_path)
        duration = len(audio) / sr

        whisper_model = transcribe.get_whisper_model()

        # Check if faster-whisper model is downloaded
        model_size = whisper_model.model_size
        fw_size = whisper_model.WHISPER_MODEL_MAP.get(model_size, model_size)
        repo_name = f"Systran/faster-whisper-{fw_size}"

        from huggingface_hub import constants as hf_constants
        repo_cache = Path(hf_constants.HF_HUB_CACHE) / ("models--" + repo_name.replace("/", "--"))
        if not repo_cache.exists():
            progress_model_name = f"whisper-{model_size}"

            async def download_whisper_background():
                try:
                    await whisper_model.load_model_async(model_size)
                except Exception as e:
                    get_task_manager().error_download(progress_model_name, str(e))

            get_task_manager().start_download(progress_model_name)
            asyncio.create_task(download_whisper_background())

            return JSONResponse(
                status_code=202,
                content={
                    "message": f"Whisper model {model_size} is being downloaded. Please wait and try again.",
                    "model_name": progress_model_name,
                    "downloading": True
                }
            )

        text = await whisper_model.transcribe(tmp_path, language)

        return models.TranscriptionResponse(
            text=text,
            duration=duration,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        Path(tmp_path).unlink(missing_ok=True)


# -- File serving endpoints --

@router.get("/audio/{generation_id}")
async def get_audio(generation_id: str, db: Session = Depends(get_db)):
    """Serve generated audio file.

    Checks DB first, then falls back to filesystem for built-in voice
    generations that aren't stored in history.
    """
    generation = await history.get_generation(generation_id, db)
    if generation:
        audio_path = Path(generation.audio_path)
    else:
        # Fallback: built-in voice generations skip DB but save to disk
        audio_path = config.get_generations_dir() / f"{generation_id}.wav"

    if not audio_path.exists():
        raise HTTPException(status_code=404, detail="Audio file not found")

    return FileResponse(
        audio_path,
        media_type="audio/wav",
        filename=f"generation_{generation_id}.wav",
    )


@router.get("/samples/{sample_id}")
async def get_sample_audio(sample_id: str, db: Session = Depends(get_db)):
    """Serve profile sample audio file."""
    from ..database import ProfileSample as DBProfileSample

    sample = db.query(DBProfileSample).filter_by(id=sample_id).first()
    if not sample:
        raise HTTPException(status_code=404, detail="Sample not found")

    audio_path = Path(sample.audio_path)
    if not audio_path.exists():
        raise HTTPException(status_code=404, detail="Audio file not found")

    return FileResponse(
        audio_path,
        media_type="audio/wav",
        filename=f"sample_{sample_id}.wav",
    )
