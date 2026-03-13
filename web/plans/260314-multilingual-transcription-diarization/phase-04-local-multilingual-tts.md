# Phase 04 — Local Multilingual TTS Integration

## Overview
- **Priority**: Medium
- **Status**: Pending (research phase)
- **Effort**: L (16h)

## Key Insights — Local TTS Options for Arabic + Tagalog

### Research Results (from researcher agent)

| Model | Arabic | Tagalog | VRAM | Quality | Voice Clone | License |
|-------|--------|---------|------|---------|-------------|---------|
| MMS-TTS (Meta) | YES | YES | <1GB | Low-Med | No | CC-BY-NC-4.0 |
| XTTS v2 (Coqui/Idiap) | YES | No | 2-4GB | High | Yes (6s clip) | CPML |
| Chatterbox Multi (Resemble) | YES | No | 7-16GB | High | Yes + emotion | MIT |
| Fish Speech S2 | YES | Untested | 12-24GB | SOTA | Yes | Apache 2.0 |
| Piper TTS | YES (ar_JO) | No | CPU only | Med | No | MIT |
| ArTST/SpeechT5 | YES (MSA) | No | <1GB | Good (MOS>4) | No | MIT |
| Bark | No | No | 5GB | - | - | MIT |

**Key insight:** No single model covers both Arabic AND Tagalog at high quality. MMS-TTS is the only model with both, but quality is low-medium (robotic/monotone).

## Recommended Strategy

**Approach B — Quality split (best bang for VRAM on V100-32GB):**
1. **MMS-TTS** for Tagalog (only option) + fallback Arabic — `facebook/mms-tts-tgl`, `facebook/mms-tts-ara`
2. **Chatterbox Multi** for high-quality Arabic (MIT license, voice cloning, 23 languages) — optional upgrade

**Why not XTTS v2?** Coqui shut down Dec 2025; Idiap fork maintenance uncertain.
**Why not Fish Speech S2?** 12-24GB VRAM conflicts with Qwen 1.7B (4.6GB).

Phase 04 focuses on MMS-TTS integration first (covers both target languages, <1GB VRAM).

## Architecture

```
backend/backends/mms_tts_backend.py  → new TTSBackend implementation
  - load_model(language_code) → downloads/caches MMS model for that language
  - generate(text, language) → audio array
  - No voice cloning (built-in voices only)
  - Model auto-downloads from HuggingFace per language (~100MB each)
```

## Implementation Steps

1. Create `mms_tts_backend.py` implementing TTSBackend protocol
2. Register in `backend/backends/__init__.py` as `get_tts_backend("mms")`
3. Add to `model_registry.py`: `mms-tts-ara`, `mms-tts-tgl` entries
4. Add model cards to frontend ModelsTab
5. Test Arabic and Tagalog generation
6. Document: MMS models generate single-speaker audio (no cloning), explain to user

## Risk Assessment
- MMS quality is moderate — not as good as Qwen or ElevenLabs
- No voice cloning with MMS — only built-in single speaker
- Model download per language required (~100MB, auto on first use)
- VRAM: minimal (~200MB), can coexist with Qwen
