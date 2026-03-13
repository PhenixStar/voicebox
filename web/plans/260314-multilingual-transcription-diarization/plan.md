# Multilingual Support + Transcription Tab with Speaker Diarization

## Context

Voicebox (voice.nulled.ai) has 5 TTS backends but only supports 10 languages (zh, en, ja, ko, de, fr, ru, pt, es, it). User wants Arabic + Tagalog/Filipino support with local models, plus a dedicated Transcription tab with multi-speaker diarization from audio/video files.

## Phases

| Phase | Title | Priority | Status | Effort |
|-------|-------|----------|--------|--------|
| 01 | [Add Arabic + Tagalog to Language Lists](phase-01-add-languages.md) | Critical | Done | XS (30m) |
| 02 | [Transcription Backend — Diarization API](phase-02-transcription-backend.md) | High | Done | M (6h) |
| 03 | [Transcription Tab — Frontend](phase-03-transcription-frontend.md) | High | Done | M (8h) |
| 04 | [Local Multilingual TTS Integration](phase-04-local-multilingual-tts.md) | Medium | Pending | L (16h) |

## Dependencies

```
Phase 01 → independent (regex + dropdown changes)
Phase 02 → independent (new backend endpoints)
Phase 03 → after Phase 02 (frontend consumes diarization API)
Phase 04 → after Phase 01 (needs language codes registered first)
```

## Key Files

- Language constants: `app/src/lib/constants/languages.ts`
- Backend models: `backend/models.py` (3 regex patterns)
- STT backend: `backend/backends/__init__.py`, `backend/transcribe.py`
- Video import: `backend/routers/video_import.py` (has faster-whisper already)
- Router: `app/src/router.tsx`
- Navigation: `app/src/components/TopNav.tsx`, `app/src/components/BottomNav.tsx`
