# Phase 07 — REST API v1 + Authentication

## Overview
- **Priority:** Medium
- **Status:** Pending
- **Effort:** M (10h)
- **Depends on:** Phase 05 (settings for API key storage)

## Key Insights

**Current state:** FastAPI backend exposes all endpoints at root (`/profiles`, `/generate`, `/models/status`, etc.) with zero authentication. Anyone with the URL can generate audio, manage profiles, and delete models.

**Plan:**
1. Formalize existing endpoints under `/api/v1/` prefix
2. Add bearer token authentication middleware
3. Keep existing unprefixed routes for backward compatibility (frontend uses them via same-origin proxy)

## Architecture

### API Key Authentication
- Single `VOICEBOX_API_KEY` env var (or stored in settings DB from Phase 05)
- Bearer token in `Authorization: Bearer <key>` header
- Applied to `/api/v1/*` routes only (frontend uses cookie/same-origin, no auth needed)
- Rate limiting: 10 req/min for `/api/v1/generate`, 60 req/min for reads

### API v1 Surface

```
POST /api/v1/generate          — Generate speech (returns audio URL or audio bytes)
GET  /api/v1/voices             — List all voices across all backends
GET  /api/v1/models             — List models with status
GET  /api/v1/profiles           — List voice profiles
GET  /api/v1/profiles/{id}      — Get profile details
POST /api/v1/profiles           — Create profile
GET  /api/v1/generations/{id}   — Get generation metadata + audio URL
GET  /api/v1/health             — Health check (no auth required)
```

### Error Format
```json
{
  "error": "Descriptive error message",
  "code": "INVALID_MODEL",
  "status": 400
}
```

## Related Code Files

### Create
- `repo/modded/backend/middleware/auth.py` — Bearer token auth middleware
- `repo/modded/backend/middleware/rate_limit.py` — Rate limiting (slowapi)
- `repo/modded/backend/routers/api_v1.py` — Versioned API router with auth dependency

### Modify
- `repo/modded/backend/server.py` — Mount API v1 router
- `repo/modded/backend/requirements.txt` — Add `slowapi` dependency

## Implementation Steps

1. **Auth middleware:**
   ```python
   from fastapi import Depends, HTTPException, Security
   from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

   security = HTTPBearer()

   async def verify_api_key(
       credentials: HTTPAuthorizationCredentials = Security(security),
   ) -> str:
       api_key = get_setting("voicebox_api_key") or os.environ.get("VOICEBOX_API_KEY", "")
       if not api_key or credentials.credentials != api_key:
           raise HTTPException(status_code=401, detail="Invalid API key")
       return credentials.credentials
   ```

2. **Rate limiting with slowapi:**
   ```python
   from slowapi import Limiter
   from slowapi.util import get_remote_address

   limiter = Limiter(key_func=get_remote_address)

   @router.post("/generate")
   @limiter.limit("10/minute")
   async def api_generate(request: Request, ...):
   ```

3. **API v1 router** wraps existing endpoint logic but with auth dependency and consistent error format.

4. **OpenAPI docs** auto-generated at `/api/v1/docs` with auth scheme documented.

## Todo List
- [ ] Create auth middleware with bearer token validation
- [ ] Create rate limiting setup
- [ ] Create API v1 router with all endpoints
- [ ] Add consistent error response format
- [ ] Mount under `/api/v1/` in server.py
- [ ] Add `slowapi` to requirements.txt
- [ ] Test with curl using Authorization header
- [ ] Test rate limiting
- [ ] Update OpenAPI docs
- [ ] Hot-deploy backend

## Success Criteria
- `/api/v1/generate` requires valid bearer token
- Unauthenticated requests get 401
- Rate-limited requests get 429
- Existing frontend routes continue working without auth (same-origin)
- OpenAPI docs accessible at `/api/v1/docs`

## Security Considerations
- API key compared with constant-time comparison (`secrets.compare_digest`)
- Rate limiting prevents abuse
- Health endpoint remains public (no auth) for monitoring
- API key configurable via settings UI (Phase 05) or env var
