"""
REST API v1 — authenticated, versioned endpoints.

Wraps existing internal endpoints under /api/v1/ with bearer token auth.
Frontend continues using unprefixed routes (same-origin, no auth needed).
External integrations use /api/v1/* with Authorization header.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models as api_models
from ..database import get_db, VoiceProfile, ProfileSample
from ..middleware.auth import verify_api_key

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1",
    tags=["api-v1"],
    dependencies=[Depends(verify_api_key)],
)


# --- Health (no auth override — but it's fine, auth is on the router) ---

@router.get("/health")
async def api_health():
    """Health check (auth still required for v1 consistency)."""
    from ..routers.health import health
    return await health()


# --- Models ---

@router.get("/models")
async def api_list_models():
    """List all models with their status."""
    from ..routers.model_management import get_model_status
    return await get_model_status()


# --- Voices ---

@router.get("/voices")
async def api_list_all_voices():
    """List all available voices across all backends."""
    from ..routers.generation import get_builtin_voices
    result = {}
    # Collect voices from all known built-in voice models
    for model_name in ("kokoro-82M", "kugelaudio-7B", "elevenlabs-v2"):
        try:
            data = await get_builtin_voices(model_name)
            if data and "voices" in data:
                result[model_name] = data["voices"]
        except Exception:
            pass
    return {"voices": result}


@router.get("/voices/{model_name}")
async def api_model_voices(model_name: str):
    """List voices for a specific model."""
    from ..routers.generation import get_builtin_voices
    return await get_builtin_voices(model_name)


# --- Profiles ---

@router.get("/profiles")
async def api_list_profiles(db: Session = Depends(get_db)):
    """List all voice profiles."""
    profiles = db.query(VoiceProfile).order_by(VoiceProfile.created_at.desc()).all()
    return [
        {
            "id": p.id,
            "name": p.name,
            "description": p.description,
            "language": p.language,
            "created_at": p.created_at.isoformat() if p.created_at else None,
            "updated_at": p.updated_at.isoformat() if p.updated_at else None,
        }
        for p in profiles
    ]


@router.get("/profiles/{profile_id}")
async def api_get_profile(profile_id: str, db: Session = Depends(get_db)):
    """Get a specific voice profile with its samples."""
    profile = db.query(VoiceProfile).filter(VoiceProfile.id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    samples = db.query(ProfileSample).filter(ProfileSample.profile_id == profile_id).all()
    return {
        "id": profile.id,
        "name": profile.name,
        "description": profile.description,
        "language": profile.language,
        "created_at": profile.created_at.isoformat() if profile.created_at else None,
        "samples": [
            {"id": s.id, "reference_text": s.reference_text}
            for s in samples
        ],
    }


@router.post("/profiles")
async def api_create_profile(data: api_models.VoiceProfileCreate, db: Session = Depends(get_db)):
    """Create a new voice profile."""
    from ..routers.profile_routes import create_profile
    return await create_profile(data, db)


# --- Generation ---

@router.post("/generate")
async def api_generate(
    data: api_models.GenerationRequest,
    db: Session = Depends(get_db),
):
    """Generate speech from text. Returns generation metadata with audio URL."""
    from ..routers.generation import generate_speech
    return await generate_speech(data, db)


# --- Generations (History) ---

@router.get("/generations/{generation_id}")
async def api_get_generation(generation_id: str, db: Session = Depends(get_db)):
    """Get generation metadata and audio URL."""
    from ..routers.history_routes import get_generation
    return await get_generation(generation_id, db)


