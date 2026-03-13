### Backend Feature Delivered -- Transcription with Speaker Diarization (2026-03-14)

**Stack Detected**   : Python 3.x, FastAPI, faster-whisper, pyannote-audio (optional)
**Files Added**      :
- `backend/utils/audio_processing.py` (117 lines) -- shared ffmpeg/yt-dlp utilities
- `backend/routers/transcription_routes.py` (219 lines) -- transcription endpoints

**Files Modified**   :
- `backend/models.py` -- appended `TranscriptionSegment` + `DiarizedTranscriptionResponse`
- `backend/routers/video_import.py` -- refactored to import shared utilities (DRY)
- `backend/main.py` -- registered `transcription_routes` router

**Key Endpoints/APIs**

| Method | Path | Purpose |
|--------|------|---------|
| POST | /transcribe/file | Upload audio/video file, transcribe with optional diarization |
| POST | /transcribe/url | Provide URL, download via yt-dlp, transcribe with optional diarization |

**Parameters (both endpoints)**
- `language: str = "auto"` -- language code or auto-detect
- `diarize: bool = False` -- enable pyannote speaker diarization
- `model_size: str = "base"` -- whisper model: tiny, base, small, medium, large-v3

**Design Notes**
- Extracted `extract_audio_from_url`, `convert_to_mono_wav`, `get_audio_duration` into `backend/utils/audio_processing.py` shared by both `video_import.py` and `transcription_routes.py` (DRY)
- `video_import.py` refactored: removed duplicate ffmpeg/yt-dlp code, now imports from shared module
- Diarization gracefully falls back: missing pyannote or HF token -> segments returned without speaker labels, no error
- Full audio transcribed (no clipping), unlike video_import which clips to 15-30s
- File upload capped at 500MB; URL download capped at 500MB via yt-dlp flag
- model_size validated against whitelist before loading

**Validation**
- All 5 files pass `py_compile`
- Container imports verified: models + utils load correctly
- Backend restarted and health check passed
- Both endpoints visible in OpenAPI schema at /docs
