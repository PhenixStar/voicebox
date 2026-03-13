# Phase 09 — MVP Features: ElevenLabs Parity

## Overview
- **Priority:** Low (implement after infrastructure phases)
- **Status:** Pending
- **Effort:** L (30h total across sub-features)
- **Depends on:** Phase 07

## Key Insights

ElevenLabs' key features that Voicebox should match for MVP:
1. Emotion/instruct presets (backend already supports `instruct` param)
2. Audio export formats (mp3, ogg, flac via ffmpeg)
3. SSE progress for long generations
4. Voice cloning from video/URL (yt-dlp pipeline)

## Sub-Features

### 9A — Emotion / Instruct Presets (6h)

**Backend:** Already supports `instruct` parameter in Qwen TTS.
**Frontend:** Add preset buttons above the instruct textarea:

```
[Happy] [Sad] [Angry] [Whisper] [Excited] [Calm] [Narrator]
```

Each maps to a preset string:
- Happy → "Speak with warmth, joy, and a smile in your voice"
- Whisper → "Speak in a soft whisper, barely audible"
- Narrator → "Speak with a deep, authoritative narrator tone"

For ElevenLabs backend, expose `stability` and `similarity_boost` sliders.

**Files:** `GenerationForm.tsx`, `useGenerationForm.ts`

### 9B — Audio Export Formats (4h)

**Backend:** Add `format` query param to generate endpoint. Use ffmpeg subprocess:
```python
if format != "wav":
    subprocess.run(["ffmpeg", "-i", wav_path, "-y", output_path])
```

Support: wav (default), mp3, ogg, flac.

**Frontend:** Format dropdown in GenerationForm + download button with format picker in history.

**Files:** `generation.py`, `GenerationForm.tsx`, `HistoryPage.tsx`

### 9C — SSE Progress for Generations (8h)

KugelAudio takes ~60s, Qwen ~30s. Users see a spinner with no feedback.

**Backend:** SSE endpoint `/generate/stream` that sends progress events:
```json
{"status": "processing", "step": "tokenizing", "progress": 25}
{"status": "processing", "step": "generating", "progress": 75}
{"status": "complete", "audio_path": "/audio/xxx.wav"}
```

**Frontend:** EventSource subscription with progress bar in GenerationForm.

**Files:** `generation.py`, `GenerationForm.tsx`, new progress utilities

### 9D — Voice Cloning from Video/URL (12h)

Accept YouTube URL or video file → extract audio → auto-transcribe → create profile.

**Pipeline:**
1. `yt-dlp -x --audio-format wav URL`
2. `ffmpeg -i input.wav -ss START -t DURATION -ar 24000 -ac 1 clip.wav`
3. Transcribe with faster-whisper
4. Create profile + upload sample via existing API

**Backend:** New endpoint `POST /profiles/from-video` with URL or file upload.
**Frontend:** New "Import from Video" button in Voices tab.

**Files:** New `video_import.py` router, `VoicesTab.tsx`

## Todo List
- [ ] 9A: Add emotion preset buttons to GenerationForm
- [ ] 9A: Map presets to instruct strings
- [ ] 9A: Add ElevenLabs voice settings sliders
- [ ] 9B: Add `format` param to generate endpoint
- [ ] 9B: Add ffmpeg conversion subprocess
- [ ] 9B: Add format picker to frontend
- [ ] 9C: Create SSE progress endpoint
- [ ] 9C: Wire EventSource in frontend
- [ ] 9C: Add progress bar UI
- [ ] 9D: Add yt-dlp + ffmpeg extraction pipeline
- [ ] 9D: Create auto-transcription flow
- [ ] 9D: Create "Import from Video" UI

## Success Criteria
- Emotion presets change generation output noticeably
- MP3/OGG/FLAC downloads work correctly
- Progress bar updates during long generations
- Video URL produces a usable voice profile

## Risk Assessment
- **9C:** Requires model-level progress hooks which may not exist in all backends
- **9D:** YouTube ToS compliance — position as "import from file" primarily
- **VRAM:** Model switching for whisper transcription + TTS generation needs careful orchestration
