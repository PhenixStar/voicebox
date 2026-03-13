<p align="center">
  <img src=".github/assets/icon-dark.webp" alt="The Voice" width="120" height="120" />
</p>

<h1 align="center">The Voice</h1>

<p align="center">
  <strong>Modded voice synthesis studio powered by multi-model TTS.</strong><br/>
  Clone voices. Generate speech. Multiple model backends.<br/>
  Running locally or via Docker with NVIDIA GPU acceleration.
</p>

<p align="center">
  <a href="https://voice.nulled.ai">Live Demo</a> &bull;
  <a href="#features">Features</a> &bull;
  <a href="#docker-deployment">Docker</a> &bull;
  <a href="#api">API</a>
</p>

<br/>

## What is The Voice?

A modded fork of [Voicebox](https://github.com/jamiepine/voicebox) with extended multi-model TTS support, Docker/NVIDIA GPU deployment, and a redesigned dark theme.

**Key differences from upstream:**

- **Multi-model support** — Kokoro 82M, Qwen TTS (0.6B/1.7B), KugelAudio 7B
- **Docker + NVIDIA CUDA** — One-command GPU-accelerated deployment
- **Cloudflare Tunnel** — Expose securely to the internet
- **Red + black dark theme** — Redesigned UI with "The Voice" branding
- **Web-first deployment** — nginx SPA routing with FastAPI backend proxy
- **faster-whisper STT** — Speech-to-text transcription support

---

## Features

### Multi-Model TTS Engine

| Model | Size | Speed | Quality | Use Case |
|-------|------|-------|---------|----------|
| **Kokoro 82M** | 82M params | ~2s | Good | Fast drafts, testing |
| **Qwen TTS 1.7B** | 1.7B params | ~30s | Excellent | Voice cloning, production |
| **KugelAudio 7B** | 7B params | ~60s | Best | High-fidelity output |

### Voice Cloning

- Upload a few seconds of audio to create a voice profile
- Multi-sample support for higher quality cloning
- Import/export profiles for sharing and backup

### Stories Editor

- Multi-track timeline for composing multi-voice narratives
- Inline audio editing with trim and split
- Auto-playback with synchronized playhead

### Speech-to-Text

- Powered by faster-whisper (CTranslate2)
- Automatic transcription of uploaded audio
- Multiple language support

---

## Docker Deployment

### Prerequisites

- Docker with NVIDIA Container Toolkit
- NVIDIA GPU with CUDA support
- Cloudflare Tunnel token (optional, for public access)

### Quick Start

```bash
# Clone the repo
git clone https://github.com/PhenixStar/voicebox.git
cd voicebox

# Copy environment template
cp .env.example .env
# Edit .env with your CF_TUNNEL_TOKEN (optional)

# Build and run
docker compose up -d --build

# Access at http://localhost:8080
```

### Docker Architecture

```
nginx (:80)
  ├── Static frontend (React SPA)
  ├── /api/* → FastAPI backend (:8000)
  └── SPA fallback → index.html

FastAPI (:8000)
  ├── Model management (download, load, delete)
  ├── TTS generation (Kokoro, Qwen, KugelAudio)
  ├── Voice profiles (CRUD, samples)
  ├── Transcription (faster-whisper)
  └── SQLite database (/data/)
```

### Volumes

| Volume | Container Path | Purpose |
|--------|---------------|---------|
| `voicebox-models` | `/home/models` | Downloaded TTS/STT models |
| `voicebox-data` | `/data` | SQLite database, generated audio |

---

## API

The backend exposes a REST API at port 8000 (proxied through nginx on port 80).

```bash
# Health check
curl http://localhost:8080/health

# List models
curl http://localhost:8080/models/status

# Generate speech
curl -X POST http://localhost:8080/generate \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello world", "voice": "af_heart", "model_size": "82M"}'

# List voice profiles
curl http://localhost:8080/profiles

# Transcribe audio
curl -X POST http://localhost:8080/transcribe \
  -F "file=@audio.wav"
```

Full API docs available at `http://localhost:8080/docs` when running.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React, TypeScript, Tailwind CSS v4, TanStack Router |
| State | Zustand, React Query |
| Backend | FastAPI (Python) |
| TTS Models | Kokoro, Qwen TTS, KugelAudio (PyTorch + CUDA) |
| STT | faster-whisper (CTranslate2) |
| Database | SQLite |
| Deployment | Docker, nginx, supervisord, Cloudflare Tunnel |
| GPU | NVIDIA CUDA 12.8 runtime |

---

## Development

### Local Development (without Docker)

```bash
# Install frontend dependencies
bun install

# Install backend dependencies
cd backend && pip install -r requirements.txt && cd ..

# Start backend
cd backend && uvicorn main:app --host 0.0.0.0 --port 8000

# Start frontend (separate terminal)
cd web && bun run dev
```

### Project Structure

```
voicebox/
├── app/              # Shared React frontend components
├── web/              # Web deployment (Vite)
├── tauri/            # Desktop app (Tauri + Rust)
├── backend/          # Python FastAPI server
│   ├── backends/     # Model backends (Kokoro, Qwen, KugelAudio)
│   ├── routers/      # API route modules
│   └── main.py       # App entry point
└── landing/          # Marketing website (upstream)
```

---

## Credits

Based on [Voicebox](https://github.com/jamiepine/voicebox) by [Jamie Pine](https://github.com/jamiepine).

---

## License

MIT License — see [LICENSE](LICENSE) for details.
