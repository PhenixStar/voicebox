# Phase 05 — Settings Page Expansion

## Overview
- **Priority:** High
- **Status:** Pending
- **Effort:** M (8h)

## Key Insights

**Current settings page** (`ServerTab.tsx`) has only:
1. Server Connection URL (disabled when app works via same-origin)
2. Keep server running checkbox (Tauri only)
3. Theme dropdown (dark/light)
4. About section (GPU info, author credit)

**User requests:**
- Server IP should be editable even when "offline" (currently disabled by same-origin setup)
- Footer with app version and author credit (currently in About card)
- API configuration (ElevenLabs API key, default model, audio format)
- Security settings (API key for Voicebox itself)
- Profile defaults
- Missing configuration variables

## Requirements

### Functional
- Settings persist in SQLite via backend API (not just localStorage)
- Sensitive values (API keys) masked in UI, encrypted at rest
- Settings page organized into logical sections with clear headings
- Footer with version + credit visible on all pages

### Sections Needed
1. **Server** — URL, connection status
2. **Appearance** — Theme, (future: accent color)
3. **API Keys** — ElevenLabs key, Voicebox API key
4. **Generation Defaults** — Default model, language, audio format
5. **About / Footer** — Version, GPU info, credits

## Related Code Files

### Create
- `repo/modded/backend/routers/settings_routes.py` — CRUD API for settings
- `repo/modded/backend/db/settings.py` — Settings table + queries
- `repo/modded/app/src/lib/api/settings.ts` — Frontend API client methods
- `repo/modded/app/src/components/ServerTab/ApiKeysCard.tsx` — API keys config
- `repo/modded/app/src/components/ServerTab/GenerationDefaultsCard.tsx` — Default model/language
- `repo/modded/app/src/components/Footer.tsx` — Global footer component

### Modify
- `repo/modded/app/src/components/ServerTab/ServerTab.tsx` — Add new sections
- `repo/modded/app/src/router.tsx` — Add Footer to root layout
- `repo/modded/backend/server.py` — Register settings router
- `repo/modded/backend/db/init.py` — Add settings table creation

## Implementation Steps

### Backend

1. **Create `settings` table in SQLite:**
   ```sql
   CREATE TABLE IF NOT EXISTS settings (
     key TEXT PRIMARY KEY,
     value TEXT NOT NULL,
     encrypted INTEGER DEFAULT 0,
     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );
   ```

2. **Create settings router with endpoints:**
   ```
   GET  /settings          — List all settings (mask encrypted values)
   GET  /settings/{key}    — Get single setting
   PUT  /settings/{key}    — Update setting
   DELETE /settings/{key}  — Reset to default
   ```

3. **Encrypt sensitive settings:**
   Use `cryptography.fernet` with server-side key derived from a secret.
   Settings with `encrypted=1` are stored encrypted and returned masked (`sk-****`) in GET.

4. **Seed defaults from env vars:**
   On startup, read env vars (`ELEVENLABS_API_KEY`, etc.) and insert as defaults if not already in DB.

### Frontend

5. **API Keys card:**
   - ElevenLabs API key input (password field, show/hide toggle)
   - Save button that PUTs to `/settings/elevenlabs_api_key`
   - Status indicator (key set / not set)

6. **Generation Defaults card:**
   - Default model dropdown (populated from `/models/status`)
   - Default language dropdown
   - Default audio format (wav, mp3, ogg)

7. **Footer component:**
   ```tsx
   <footer className="border-t border-border px-4 py-2 flex items-center justify-between text-xs text-muted-foreground">
     <span>The Voice v0.2.0</span>
     <span>Created by <a href="...">phenix</a></span>
   </footer>
   ```
   Add to `RootLayout` in `router.tsx`.

8. **Move About info** from settings card to footer.

## Todo List
- [ ] Create `settings` SQLite table
- [ ] Create settings CRUD router
- [ ] Implement encryption for sensitive values
- [ ] Seed defaults from env vars
- [ ] Create ApiKeysCard component
- [ ] Create GenerationDefaultsCard component
- [ ] Create Footer component
- [ ] Add Footer to root layout
- [ ] Wire frontend API calls for settings
- [ ] Test save/load/mask cycle
- [ ] Hot-deploy backend + frontend

## Success Criteria
- All settings persist across container restarts (stored in SQLite)
- API keys are encrypted at rest and masked in UI
- Footer visible on every page with version + credit
- Server URL editable regardless of connection state
- Default model/language applied to new generations

## Security Considerations
- API keys encrypted with Fernet at rest
- GET endpoint NEVER returns full key values — always masked
- Settings API should be protected by auth (Phase 07) when deployed

## Risk Assessment
- **Low:** Adding a simple key-value settings table is straightforward
- **Medium:** Fernet encryption requires a stable server secret — must persist across container restarts (store in mounted volume or env var)
