"""
Settings CRUD API router.

Stores app configuration in SQLite. Sensitive values (API keys) are
encrypted at rest with Fernet and returned masked in GET responses.
"""

import os
import logging
from datetime import datetime
from typing import Optional

from cryptography.fernet import Fernet
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import Setting, get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/settings", tags=["settings"])

# --- Encryption helpers ---

_fernet: Optional[Fernet] = None

# Keys that hold secrets — stored encrypted, returned masked
SENSITIVE_KEYS = {"elevenlabs_api_key", "voicebox_api_key"}

# Default values seeded on first run
DEFAULT_SETTINGS = {
    "default_model": "qwen-tts-1.7B",
    "default_language": "en",
    "default_audio_format": "wav",
    "elevenlabs_api_key": "",
    "voicebox_api_key": "",
}


def _get_fernet() -> Fernet:
    """Lazy-init Fernet cipher from VOICEBOX_SECRET env var."""
    global _fernet
    if _fernet is None:
        secret = os.environ.get("VOICEBOX_SECRET")
        if not secret:
            # Generate a deterministic key from a fallback (not ideal, but
            # avoids crashing when env var is missing).
            secret = Fernet.generate_key().decode()
            os.environ["VOICEBOX_SECRET"] = secret
            logger.warning(
                "VOICEBOX_SECRET not set — generated ephemeral key. "
                "Settings encryption will NOT survive container restarts."
            )
        # Ensure it's a valid Fernet key (url-safe base64, 32 bytes)
        try:
            _fernet = Fernet(secret.encode() if isinstance(secret, str) else secret)
        except Exception:
            _fernet = Fernet(Fernet.generate_key())
            logger.warning("Invalid VOICEBOX_SECRET — using ephemeral key.")
    return _fernet


def _encrypt(value: str) -> str:
    return _get_fernet().encrypt(value.encode()).decode()


def _decrypt(token: str) -> str:
    try:
        return _get_fernet().decrypt(token.encode()).decode()
    except Exception:
        return ""


def _mask(value: str) -> str:
    """Return masked version of a secret value."""
    if not value or len(value) < 6:
        return "****" if value else ""
    return value[:3] + "*" * (len(value) - 6) + value[-3:]


# --- Pydantic models ---


class SettingResponse(BaseModel):
    key: str
    value: str
    encrypted: bool
    updated_at: Optional[str] = None


class SettingUpdate(BaseModel):
    value: str


# --- Seed defaults ---


def seed_defaults(db: Session) -> None:
    """Insert default settings if they don't exist yet.

    Also pulls values from environment variables when available.
    """
    env_overrides = {
        "elevenlabs_api_key": os.environ.get("ELEVENLABS_API_KEY", ""),
    }

    for key, default_value in DEFAULT_SETTINGS.items():
        existing = db.query(Setting).filter(Setting.key == key).first()
        if existing is None:
            raw = env_overrides.get(key, default_value)
            is_sensitive = key in SENSITIVE_KEYS
            stored = _encrypt(raw) if (is_sensitive and raw) else raw
            db.add(Setting(
                key=key,
                value=stored,
                encrypted=is_sensitive,
                updated_at=datetime.utcnow(),
            ))
    db.commit()


# --- Endpoints ---


@router.get("", response_model=list[SettingResponse])
def list_settings(db: Session = Depends(get_db)):
    """Return all settings. Encrypted values are masked."""
    rows = db.query(Setting).all()
    results = []
    for row in rows:
        val = _mask(_decrypt(row.value)) if row.encrypted and row.value else row.value
        results.append(SettingResponse(
            key=row.key,
            value=val,
            encrypted=row.encrypted,
            updated_at=row.updated_at.isoformat() if row.updated_at else None,
        ))
    return results


@router.get("/{key}", response_model=SettingResponse)
def get_setting(key: str, db: Session = Depends(get_db)):
    row = db.query(Setting).filter(Setting.key == key).first()
    if not row:
        raise HTTPException(status_code=404, detail=f"Setting '{key}' not found")
    val = _mask(_decrypt(row.value)) if row.encrypted and row.value else row.value
    return SettingResponse(
        key=row.key,
        value=val,
        encrypted=row.encrypted,
        updated_at=row.updated_at.isoformat() if row.updated_at else None,
    )


@router.put("/{key}", response_model=SettingResponse)
def update_setting(key: str, body: SettingUpdate, db: Session = Depends(get_db)):
    row = db.query(Setting).filter(Setting.key == key).first()
    if not row:
        # Auto-create if missing
        is_sensitive = key in SENSITIVE_KEYS
        stored = _encrypt(body.value) if (is_sensitive and body.value) else body.value
        row = Setting(
            key=key,
            value=stored,
            encrypted=is_sensitive,
            updated_at=datetime.utcnow(),
        )
        db.add(row)
    else:
        stored = _encrypt(body.value) if (row.encrypted and body.value) else body.value
        row.value = stored
        row.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(row)

    val = _mask(_decrypt(row.value)) if row.encrypted and row.value else row.value
    return SettingResponse(
        key=row.key,
        value=val,
        encrypted=row.encrypted,
        updated_at=row.updated_at.isoformat() if row.updated_at else None,
    )


@router.delete("/{key}")
def delete_setting(key: str, db: Session = Depends(get_db)):
    row = db.query(Setting).filter(Setting.key == key).first()
    if not row:
        raise HTTPException(status_code=404, detail=f"Setting '{key}' not found")
    # Reset to default instead of deleting
    default = DEFAULT_SETTINGS.get(key, "")
    is_sensitive = key in SENSITIVE_KEYS
    row.value = _encrypt(default) if (is_sensitive and default) else default
    row.updated_at = datetime.utcnow()
    db.commit()
    return {"message": f"Setting '{key}' reset to default"}
