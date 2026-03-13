"""
Bearer token authentication for API v1 endpoints.

Reads the API key from the settings DB (voicebox_api_key) or falls back
to the VOICEBOX_API_KEY env var. If no key is configured, auth is disabled
(all requests pass through).
"""

import os
import secrets
import logging

from fastapi import Depends, HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from ..database import Setting, get_db

logger = logging.getLogger(__name__)

security = HTTPBearer(auto_error=False)


def _get_api_key(db: Session) -> str:
    """Retrieve the active API key from DB or env."""
    row = db.query(Setting).filter(Setting.key == "voicebox_api_key").first()
    if row and row.value and row.encrypted:
        # Decrypt it
        from ..routers.settings_routes import _decrypt
        decrypted = _decrypt(row.value)
        if decrypted:
            return decrypted
    # Fallback to env var
    return os.environ.get("VOICEBOX_API_KEY", "")


async def verify_api_key(
    credentials: HTTPAuthorizationCredentials | None = Security(security),
    db: Session = Depends(get_db),
) -> str | None:
    """Validate bearer token against stored API key.

    If no API key is configured, auth is disabled (pass-through).
    """
    api_key = _get_api_key(db)

    # No key configured — auth disabled
    if not api_key:
        return None

    if credentials is None:
        raise HTTPException(
            status_code=401,
            detail="Missing Authorization header. Use: Authorization: Bearer <api_key>",
        )

    if not secrets.compare_digest(credentials.credentials, api_key):
        raise HTTPException(status_code=401, detail="Invalid API key")

    return credentials.credentials
