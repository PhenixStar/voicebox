"""Speech generation routes."""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
import uuid
import asyncio
from datetime import datetime
from pathlib import Path

from .. import models, profiles, history, tts, config
from ..database import get_db
from ..utils.tasks import get_task_manager

router = APIRouter(tags=["generation"])


@router.post("/generate", response_model=models.GenerationResponse)
async def generate_speech(
    data: models.GenerationRequest,
    db: Session = Depends(get_db),
):
    """Generate speech from text using a voice profile or built-in voice.

    Routing logic:
    - ``model_name`` in {kokoro-82M, kugelaudio-7B} -> use built-in voice
      (requires ``voice_name``; ``profile_id`` optional).
    - Otherwise -> Qwen voice-cloning path (requires ``profile_id``).
    """
    from ..backends import get_tts_backend as _get_tts_backend

    task_manager = get_task_manager()
    generation_id = str(uuid.uuid4())

    # Resolve which backend to use
    model_name = data.model_name
    builtin_voice_backends = {
        "kokoro-82M": "kokoro",
        "kugelaudio-7B": "kugelaudio",
    }
    use_builtin_voice = model_name in builtin_voice_backends

    try:
        task_manager.start_generation(
            task_id=generation_id,
            profile_id=data.profile_id or "built-in",
            text=data.text,
        )

        # Path A: Built-in voice models (Kokoro / KugelAudio)
        if use_builtin_voice:
            voice_name = data.voice_name
            if not voice_name:
                raise HTTPException(
                    status_code=400,
                    detail=f"voice_name is required for {model_name}",
                )

            backend = _get_tts_backend(builtin_voice_backends[model_name])
            await backend.load_model()

            audio, sample_rate = await backend.generate(
                text=data.text,
                voice_prompt={"voice_name": voice_name},
                language=data.language,
                seed=data.seed,
                instruct=data.instruct,
            )

        # Path B: Qwen voice-cloning (original behaviour)
        else:
            if not data.profile_id:
                raise HTTPException(
                    status_code=400,
                    detail="profile_id is required for Qwen TTS voice cloning",
                )

            profile = await profiles.get_profile(data.profile_id, db)
            if not profile:
                raise HTTPException(status_code=404, detail="Profile not found")

            voice_prompt = await profiles.create_voice_prompt_for_profile(
                data.profile_id, db,
            )

            tts_model = tts.get_tts_model()
            model_size = data.model_size or "1.7B"

            # Auto-download if model not cached
            model_path = tts_model._get_model_path(model_size)
            if model_path.startswith("Qwen/"):
                from huggingface_hub import constants as hf_constants
                repo_cache = Path(hf_constants.HF_HUB_CACHE) / (
                    "models--" + model_path.replace("/", "--")
                )
                if not repo_cache.exists():
                    dl_model_name = f"qwen-tts-{model_size}"

                    async def download_model_background():
                        try:
                            await tts_model.load_model_async(model_size)
                            task_manager.complete_download(dl_model_name)
                        except Exception as e:
                            task_manager.error_download(dl_model_name, str(e))

                    task_manager.start_download(dl_model_name)
                    asyncio.create_task(download_model_background())

                    task_manager.complete_generation(generation_id)
                    return JSONResponse(
                        status_code=202,
                        content={
                            "message": f"Model {model_size} is being downloaded. Please wait and try again.",
                            "model_name": dl_model_name,
                            "downloading": True,
                        },
                    )

            await tts_model.load_model_async(model_size)
            audio, sample_rate = await tts_model.generate(
                data.text, voice_prompt, data.language, data.seed, data.instruct,
            )

        # Common: save audio + record history
        duration = len(audio) / sample_rate
        audio_path = config.get_generations_dir() / f"{generation_id}.wav"

        from ..utils.audio import save_audio
        save_audio(audio, str(audio_path), sample_rate)

        # Record in history only when a real profile is used (FK constraint)
        if data.profile_id:
            generation = await history.create_generation(
                profile_id=data.profile_id,
                text=data.text,
                language=data.language,
                audio_path=str(audio_path),
                duration=duration,
                seed=data.seed,
                db=db,
                instruct=data.instruct,
            )
        else:
            # Built-in voice generation -- return a synthetic response
            generation = models.GenerationResponse(
                id=generation_id,
                profile_id="built-in",
                text=data.text,
                language=data.language,
                audio_path=str(audio_path),
                duration=duration,
                seed=data.seed,
                instruct=data.instruct,
                created_at=datetime.now(),
            )

        task_manager.complete_generation(generation_id)
        return generation

    except ValueError as e:
        task_manager.error_generation(generation_id, str(e))
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        task_manager.error_generation(generation_id, str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/voices/{model_name}")
async def get_builtin_voices(model_name: str):
    """List available built-in voices for Kokoro / KugelAudio."""
    from ..backends import get_tts_backend as _get_tts_backend

    backend_map = {"kokoro-82M": "kokoro", "kugelaudio-7B": "kugelaudio"}
    if model_name not in backend_map:
        raise HTTPException(status_code=400, detail=f"No built-in voices for {model_name}")

    backend = _get_tts_backend(backend_map[model_name])
    voices = backend.get_available_voices()
    return {"model_name": model_name, "voices": voices}
