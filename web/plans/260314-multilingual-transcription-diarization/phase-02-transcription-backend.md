# Phase 02 — Transcription Backend with Speaker Diarization

## Overview
- **Priority**: High
- **Status**: Pending
- **Effort**: M (6h)

## Key Insights
- `faster-whisper` already installed in container (used by `video_import.py`)
- Speaker diarization requires `pyannote-audio` (HuggingFace token needed) or `speechbrain`
- `pyannote-audio` is state-of-art but requires HF token + ~500MB model download
- Alternative: `whisperx` bundles whisper + diarization (pyannote) in one library
- For CPU-friendly path: use NeMo MSDD or simple energy-based VAD segmentation
- **Recommended**: `whisperx` — wraps faster-whisper + pyannote diarization, widely used

## Architecture

```
POST /transcribe/file   → upload audio/video → ffmpeg prep → whisperx transcribe+diarize
POST /transcribe/url    → yt-dlp download → ffmpeg prep → whisperx transcribe+diarize

Response:
{
  "text": "full transcript",
  "duration": 123.4,
  "language": "en",
  "segments": [
    {"start": 0.0, "end": 2.5, "text": "Hello there", "speaker": "SPEAKER_00"},
    {"start": 2.8, "end": 5.1, "text": "Hi, how are you?", "speaker": "SPEAKER_01"},
    ...
  ],
  "speakers": ["SPEAKER_00", "SPEAKER_01"]
}
```

## Related Code Files
- **Create**: `backend/routers/transcription_routes.py`
- **Modify**: `backend/main.py` (register router)
- **Modify**: `backend/requirements.txt` (add whisperx or pyannote-audio)
- **Reference**: `backend/routers/video_import.py` (reuse ffmpeg helpers)

## Implementation Steps

1. Create `transcription_routes.py` with POST `/transcribe/file` and `/transcribe/url`
2. Implement `_transcribe_with_diarization()` using faster-whisper + optional pyannote
3. Fallback: if pyannote not available, return segments without speaker labels
4. Reuse `_extract_audio_from_url` and `_prepare_clip` from `video_import.py` (extract to shared util)
5. Add Pydantic response models: `TranscriptionSegment`, `DiarizedTranscriptionResponse`
6. Register router in `main.py`

## Risk Assessment
- pyannote-audio requires HuggingFace token for model access
- Diarization adds ~2-5s per minute of audio on CPU
- GPU memory: diarization model ~500MB VRAM — may conflict with loaded TTS model
- **Mitigation**: Make diarization optional (`diarize: bool = False` parameter)
