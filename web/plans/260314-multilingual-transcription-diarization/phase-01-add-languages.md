# Phase 01 — Add Arabic + Tagalog to Language Lists

## Overview
- **Priority**: Critical
- **Status**: Pending
- **Effort**: XS (30 min)

## Key Insights
- Backend validation uses Pydantic regex `pattern="^(zh|en|ja|ko|de|fr|ru|pt|es|it)$"` in 3 places
- Frontend has `SUPPORTED_LANGUAGES` object in `languages.ts`
- TranscriptionRequest has separate narrower regex `"^(en|zh)$"` — must widen
- Arabic: ISO 639-1 = `ar`, faster-whisper supports Arabic STT natively
- Tagalog/Filipino: ISO 639-1 = `fil` (Filipino) — faster-whisper supports `tl` for Tagalog
- ElevenLabs v2 cloud supports both languages for TTS; local Qwen/Kokoro do not (Phase 04 addresses local)

## Related Code Files
- **Modify**: `backend/models.py` (lines 14, 71, 138)
- **Modify**: `app/src/lib/constants/languages.ts`

## Implementation Steps

1. Add `ar` and `fil` to the regex pattern in `VoiceProfileCreate.language`
2. Add `ar` and `fil` to the regex pattern in `GenerationRequest.language`
3. Widen `TranscriptionRequest.language` regex to support all languages
4. Add Arabic + Filipino entries to `SUPPORTED_LANGUAGES` in `languages.ts`

## Success Criteria
- [x] Backend accepts `ar` and `fil` for profile creation, generation, and transcription
- [x] Frontend dropdown shows Arabic and Filipino options
- [x] Existing 10 languages unaffected
