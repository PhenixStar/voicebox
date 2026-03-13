# Research Report: Arabic & Tagalog TTS/STT Model Survey

**Date:** 2026-03-14
**Scope:** Open-source TTS models supporting Arabic (ar) and Tagalog/Filipino (tl/fil), runnable on V100 32GB GPU with PyTorch. Plus STT and diarization.

---

## 1. Current Backend Gaps

| Backend | Arabic | Tagalog | Notes |
|---------|--------|---------|-------|
| Qwen3-TTS 1.7B/0.6B | NO | NO | zh,en,ja,ko,de,fr,ru,pt,es,it |
| Kokoro 82M | NO | NO | en,ja,zh,ko,fr,de,es,pt,it,hi |
| KugelAudio 7B | NO | NO | Same as Qwen |
| ElevenLabs v2 (cloud) | YES | YES | Requires API key, not local |

**Conclusion:** No local backend currently supports Arabic or Tagalog.

---

## 2. TTS Model Comparison Table

| Model | Arabic | Tagalog | Params | Disk Size | VRAM (inference) | Voice Clone | Quality (est.) | License | Install |
|-------|--------|---------|--------|-----------|------------------|-------------|----------------|---------|---------|
| **XTTS v2** (Coqui) | YES | NO | ~467M | ~2 GB | 2-4 GB (up to 6-8 rec.) | YES (6s clip) | HIGH (MOS ~4.0) | CPML | `pip install coqui-tts` |
| **Bark** (Suno) | NO (removed) | NO | ~800M+ | ~5 GB | 8-12 GB (full), 4-8 GB (small) | NO (prompt-based) | MEDIUM | MIT | `pip install suno-bark` |
| **MMS-TTS** (Meta) | YES (`mms-tts-ara`) | YES (`mms-tts-tgl`) | ~37M per lang | ~140 MB per lang | <1 GB | NO | LOW-MED (robotic, limited prosody) | CC-BY-NC-4.0 | `pip install transformers accelerate` |
| **Piper TTS** | YES (ar_JO kareem) | NO | ~15-30M | ~50-100 MB | CPU-only (ONNX) | NO | LOW-MED | MIT | `pip install piper-tts` |
| **Chatterbox Multi** (Resemble) | YES | NO | ~550M | ~2 GB | 6.8-16 GB | YES | HIGH | MIT | `pip install chatterbox-tts` |
| **Fish Speech S2** | YES | NO (unofficial) | 4B (time) / 400M (depth) | ~3-5 GB | 12 GB min, 24 GB rec. | YES (10s clip) | VERY HIGH (SOTA) | Apache 2.0 | `pip install -e .[cu129]` (from source) |
| **ArTST/SpeechT5** | YES (MSA) | NO | ~143M | ~270 MB (fp16) | <1 GB | NO (speaker embed) | MED-HIGH (MOS >4 on ClArTTS) | MIT | `pip install transformers` |
| **Parler-TTS Mini Multi** | NO | NO | ~880M | ~3.5 GB | ~4-6 GB | NO (text prompt) | MED-HIGH | Apache 2.0 | `pip install parler-tts` |
| **StyleTTS2 / DIA-Multi** | YES (via fork) | NO | ~150M | ~600 MB | ~2-4 GB | YES (ref audio) | HIGH (human-level en) | MIT | from source |

---

## 3. Detailed Analysis Per Model

### 3.1 XTTS v2 (Coqui)
- **Arabic:** YES, officially supported (language code `ar`)
- **Tagalog:** NO
- **Parameters:** ~467M (GPT-2 + HiFi-GAN decoder)
- **Disk:** ~2 GB (`model.pth` 1.87 GB + config/vocab/dvae)
- **VRAM:** 2-3 GB in use, 4 GB min recommended, 6-8 GB for comfortable inference
- **Voice cloning:** YES, from 6-second reference audio clip
- **Quality:** High quality, natural prosody, good Arabic output
- **Streaming:** YES, <200ms latency
- **Install:** `pip install coqui-tts` (maintained fork at `idiap/coqui-ai-TTS`)
- **Note:** Coqui AI company shut down Dec 2025; open-source repo maintained by community via Idiap
- **V100 fit:** Easily fits, plenty of headroom

### 3.2 Bark (Suno)
- **Arabic:** NOT officially supported (was listed early, then removed)
- **Tagalog:** NO
- **Parameters:** ~800M+ (4 sub-models: text encoder, coarse acoustic, fine acoustic, codec)
- **VRAM:** 12 GB (full), 8 GB (small), 2 GB (with CPU offloading)
- **Voice cloning:** No true cloning; prompt-based speaker selection from ~100 presets
- **Quality:** Medium; can produce music/laughter/sound effects but speech naturalness below XTTS
- **Install:** `pip install suno-bark` or via transformers `pip install transformers`
- **Verdict:** NOT SUITABLE -- no Arabic, no Tagalog

### 3.3 MMS-TTS (Meta Massively Multilingual Speech)
- **Arabic:** YES -- checkpoint `facebook/mms-tts-ara`
  - Requires `uroman` perl package for romanization preprocessing
- **Tagalog:** YES -- checkpoint `facebook/mms-tts-tgl`
  - Uses Roman alphabet natively, no extra preprocessing
- **Parameters:** ~37M per language (VITS architecture)
- **Disk:** ~140 MB per language checkpoint
- **VRAM:** <1 GB for inference (can run on CPU); scales with text length
- **Voice cloning:** NO -- single speaker per language, no reference audio support
- **Quality:** LOW-MEDIUM
  - Robotic/monotone compared to XTTS or Fish Speech
  - Limited training data (~32 hours per language from New Testament readings)
  - Arabic: struggles with language-specific symbols, numbers, special characters
  - Tagalog: basic but functional
  - Benchmarks show MMS underperforms dedicated models (MOS typically 2.5-3.5)
- **License:** CC-BY-NC-4.0 (non-commercial only!)
- **Install:**
  ```
  pip install transformers>=4.33 accelerate
  ```
- **Usage:**
  ```python
  from transformers import VitsModel, AutoTokenizer
  model = VitsModel.from_pretrained("facebook/mms-tts-tgl")
  tokenizer = AutoTokenizer.from_pretrained("facebook/mms-tts-tgl")
  inputs = tokenizer("kumusta ka", return_tensors="pt")
  output = model(**inputs).waveform
  ```
- **V100 fit:** Trivially fits; both Arabic + Tagalog models together < 300 MB VRAM
- **Verdict:** BEST OPTION for Tagalog TTS; only open-source model with dedicated Tagalog support. Arabic quality inferior to XTTS/Chatterbox but functional.

### 3.4 Piper TTS
- **Arabic:** YES -- `ar_JO` (Jordanian Arabic), voice "kareem" in low/medium quality
- **Tagalog:** NO
- **Parameters:** ~15-30M (VITS-based, ONNX optimized)
- **Disk:** ~50-100 MB per voice
- **VRAM:** Runs entirely on CPU (ONNX runtime), no GPU needed
- **Voice cloning:** NO
- **Quality:** LOW-MEDIUM; suitable for home automation / accessibility, not production media
- **Install:** `pip install piper-tts`
- **Note:** Development moved to `github.com/OHF-Voice/piper1-gpl`
- **V100 fit:** N/A (CPU only)
- **Verdict:** Lightweight Arabic option for low-resource environments, not suitable for high-quality use

### 3.5 Chatterbox Multilingual (Resemble AI)
- **Arabic:** YES (one of 23 supported languages)
- **Tagalog:** NO
- **Parameters:** ~550M
- **Disk:** ~2 GB
- **VRAM:** 6.8 GB typical, 8-16 GB recommended
- **Voice cloning:** YES (zero-shot from reference audio)
- **Quality:** HIGH; benchmarked favorably vs ElevenLabs in side-by-side evals
- **Emotion control:** YES, with exaggeration slider + paralinguistic tags [laugh], [cough]
- **License:** MIT (fully permissive)
- **Install:** `pip install chatterbox-tts`
- **Watermarking:** Embedded Perth neural watermarks in all output (cannot be disabled?)
- **V100 fit:** Easily fits (~7 GB VRAM)
- **Verdict:** Strong Arabic TTS option with voice cloning + MIT license. Missing Tagalog.

### 3.6 Fish Speech S2 (Fish Audio)
- **Arabic:** YES (confirmed in 1.4+, S2)
- **Tagalog:** NOT officially listed; may work via cross-lingual generalization (50 training languages)
- **Parameters:** 4B (time axis) / 400M (depth axis) -- asymmetric design
- **Disk:** ~3-5 GB weights (auto-downloaded on first run)
- **VRAM:** 12 GB minimum, 24 GB recommended for production
- **Voice cloning:** YES (10-second reference)
- **Quality:** VERY HIGH -- SOTA on Seed-TTS Eval, Audio Turing Test (0.515 posterior mean), EmergentTTS-Eval 81.88% win rate vs gpt-4o-mini-tts
- **Streaming:** YES, ultra-low latency
- **License:** Apache 2.0
- **Install:** From source: `git clone github.com/fishaudio/fish-speech && pip install -e .[cu129]`
  - Also Docker images available
  - SDK (API only): `pip install fish-audio-sdk`
- **V100 fit:** YES, 32 GB is sufficient. Performance: RTF ~1:15 on 12 GB GPU, faster on 32 GB.
- **Verdict:** Best quality Arabic TTS available. Tagalog support uncertain -- needs testing.

### 3.7 ArTST / SpeechT5 Arabic
- **Arabic:** YES (Modern Standard Arabic, Classical Arabic via ClArTTS)
- **Tagalog:** NO
- **Parameters:** ~143M (SpeechT5 architecture)
- **Disk:** ~270 MB (fp16)
- **VRAM:** <1 GB inference
- **Voice cloning:** Limited (speaker embeddings from x-vector, not true zero-shot cloning)
- **Quality:** MED-HIGH; MOS >4.0 on ClArTTS when pre-trained on Arabic data
- **License:** MIT
- **Install:** `pip install transformers`, model: `MBZUAI/speecht5_tts_clartts_ar`
- **Verdict:** Excellent lightweight Arabic-specific option for MSA. No Tagalog.

---

## 4. Recommendation Matrix

### For Arabic TTS (ranked by quality):
1. **Fish Speech S2** -- SOTA quality, voice cloning, Apache 2.0 (needs 12+ GB VRAM)
2. **Chatterbox Multilingual** -- High quality, voice cloning, MIT license (needs ~7 GB VRAM)
3. **XTTS v2** -- High quality, voice cloning, proven Arabic (needs ~4 GB VRAM)
4. **ArTST/SpeechT5** -- Good MSA quality, ultra-lightweight (<1 GB VRAM)
5. **MMS-TTS** -- Functional but robotic (CC-BY-NC license concern)

### For Tagalog TTS (ranked by quality):
1. **MMS-TTS** (`facebook/mms-tts-tgl`) -- ONLY dedicated open-source option (CC-BY-NC-4.0)
2. **Fish Speech S2** -- Might work via cross-lingual generalization (untested)
3. No other open-source models officially support Tagalog

### Combined Arabic + Tagalog Strategy:
**Option A (Simple):** Use **MMS-TTS** for both languages
- Pro: Single framework, both languages confirmed, tiny VRAM (<1 GB)
- Con: Lower quality, no voice cloning, CC-BY-NC license

**Option B (Quality-split):** Use **Chatterbox Multi** or **XTTS v2** for Arabic + **MMS-TTS** for Tagalog
- Pro: High-quality Arabic, functional Tagalog
- Con: Two separate backends to manage

**Option C (Best quality):** Use **Fish Speech S2** for Arabic + **MMS-TTS** for Tagalog
- Pro: SOTA Arabic quality with voice cloning
- Con: Heavy VRAM for Fish Speech (~12 GB), two backends

**Option D (All-in-one, experimental):** Use **Fish Speech S2** for both
- Pro: Single backend, potential cross-lingual Tagalog via 50-language training
- Con: Tagalog not officially supported, may produce poor results

---

## 5. V100 32GB VRAM Budget

All models fit comfortably on V100 32GB. Example concurrent load:

| Combination | VRAM Usage | Feasible? |
|-------------|-----------|-----------|
| Qwen3-TTS 1.7B + MMS-TTS (ar+tgl) | ~6 GB + <1 GB = ~7 GB | YES |
| Qwen3-TTS 1.7B + XTTS v2 + MMS-TTS tgl | ~6 + 4 + <1 = ~11 GB | YES |
| Qwen3-TTS 1.7B + Chatterbox Multi + MMS-TTS tgl | ~6 + 7 + <1 = ~14 GB | YES |
| Qwen3-TTS 1.7B + Fish Speech S2 + MMS-TTS tgl | ~6 + 12 + <1 = ~19 GB | YES (tight) |
| Qwen3-TTS 1.7B + faster-whisper large-v3 + pyannote | ~6 + 3 + 2 = ~11 GB | YES |

Note: These are concurrent estimates; with model unloading between uses, any combination works.

---

## 6. STT: faster-whisper Arabic & Tagalog Support

### Arabic STT
- **Supported:** YES
- **Whisper language code:** `ar`
- **WER on FLEURS (MSA):** ~4% (near human baseline for clean MSA)
- **Real-world/dialectal:** 15-25% WER; context injection reduces to ~12%
- **Diacritics handling:** Removing diacritics improves WER by ~10 points
- **Verdict:** Good quality for MSA; dialects need more work

### Tagalog STT
- **Supported:** YES
- **Whisper language code:** `tl` (sometimes `fil_ph`)
- **Quality assessment:** Functional but requires revision
  - American Archive assessment: "accurate at times, but still required revision most of the time"
  - Common errors: misspellings, word splitting/concatenation, consonant insertions
  - Code-switching (Tagalog/English common in Philippines) is challenging
- **Tip:** Explicitly specify `language="tl"` -- without it, Whisper often translates Tagalog to English
- **Verdict:** Usable for drafts; expect manual correction for Filipino code-switching scenarios

### faster-whisper Specifics
- faster-whisper uses same model weights as OpenAI Whisper via CTranslate2
- Same language support and accuracy characteristics
- Already installed in the app -- no additional setup needed
- Model sizes and VRAM: base (~150MB), small (~500MB), medium (~1.5GB), large-v3 (~3GB)

---

## 7. Speaker Diarization

### pyannote-audio (Recommended)

**Latest:** pyannote-audio 4.0.4 (Feb 2026) with `community-1` model

| Aspect | Details |
|--------|---------|
| **Model** | `pyannote/speaker-diarization-community-1` |
| **Architecture** | VBx clustering (replaces agglomerative from 3.1) |
| **DER** | ~11-19% on standard benchmarks |
| **VRAM** | 1.5-2 GB (v3.x), 6-10 GB (v4.0.3 -- known regression) |
| **License** | CC-BY-4.0 (free for all use) |
| **Install** | `pip install pyannote-audio>=4.0` |
| **Auth** | Requires HuggingFace token + accept model terms |
| **Input** | Mono 16kHz audio (auto-resamples) |

**Key improvements in community-1 over 3.1:**
- Better speaker assignment and counting
- Exclusive single-speaker mode (no overlapping conflicts)
- 40% faster training pipeline
- Better accuracy with noisy real-world audio

**Known issue:** v4.0.3 uses 6x more VRAM than 3.x (9.54 GB vs 1.59 GB peak on 72-min file). May be fixed in 4.0.4.

### Whisper + Diarization Integration

**Option A: WhisperX (easiest)**
```bash
pip install whisperx
```
- Combines faster-whisper + pyannote + word-level alignment (wav2vec2)
- Single API for transcription + diarization
- Requires HuggingFace token for pyannote models
- VRAM: 16 GB recommended (whisper large + pyannote concurrent)

**Option B: Manual integration**
- Run faster-whisper for transcription (get timestamped segments)
- Run pyannote for diarization (get speaker segments)
- Align by temporal intersection (match whisper segments to pyannote speaker labels by overlap)
- More control but more code

### Other Diarization Options
- **NVIDIA NeMo MSDD:** Good accuracy, heavier setup
- **SpeechBrain:** Research-focused, less production-ready
- **Kaldi x-vectors:** Older but proven
- **pyannote** is the clear community standard for 2026

---

## 8. Integration Architecture Notes

Current backend uses a `TTSBackend` Protocol (`/home/phenix/projects/apps/voice-sh/repo/modded/backend/backends/__init__.py`) with:
- `load_model(model_size)`, `generate(text, voice_prompt, language, seed, instruct)`, `unload_model()`, `is_loaded()`
- Backend registry in `get_tts_backend(backend_type_override)` supports keys: `mlx`, `qwen`, `kokoro`, `kugelaudio`, `elevenlabs`

New backends would need:
- A new `mms_backend.py` implementing `TTSBackend` protocol (for MMS-TTS)
- A new `chatterbox_backend.py` or `xtts_backend.py` (for Arabic high-quality)
- Registration in `get_tts_backend()` with new keys
- Model config entries in `model_registry.py`
- Frontend language selector updates

For diarization, a new `DiarizationBackend` protocol would be needed alongside the existing `STTBackend`.

---

## Unresolved Questions

1. **MMS-TTS Tagalog quality:** How natural does `facebook/mms-tts-tgl` actually sound? Needs hands-on testing with native speaker evaluation.
2. **Fish Speech S2 Tagalog:** Does cross-lingual generalization produce intelligible Tagalog? Needs testing.
3. **CC-BY-NC-4.0 license for MMS-TTS:** Is the app's use case commercial? If so, MMS-TTS cannot be used.
4. **Chatterbox watermarking:** Can the Perth watermark be disabled for self-hosted use, or is it baked into the model?
5. **pyannote 4.0 VRAM regression:** Is the 6x VRAM spike (9.54 GB) fixed in 4.0.4, or should we pin to 3.x?
6. **Coqui-TTS maintenance:** The Idiap fork (`coqui-tts`) -- how actively maintained is it in 2026? Risk of bitrot.
7. **Arabic dialect coverage:** Most models support MSA; dialectal Arabic (Egyptian, Gulf, Levantine) coverage is minimal across all open-source models.
