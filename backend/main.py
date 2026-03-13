"""
FastAPI application for voicebox backend.

Handles voice cloning, generation history, and server mode.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import argparse
import asyncio
import os
import torch
from pathlib import Path

from . import database, tts, transcribe, config, __version__
from .platform_detect import get_backend_type
from .utils.progress import get_progress_manager

from .routers import (
    health,
    generation,
    history_routes,
    model_management,
    profile_routes,
    channel_routes,
    story_routes,
    task_routes,
    settings_routes,
    api_v1,
    video_import,
    transcription_routes,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup and shutdown logic."""
    # Startup
    print("voicebox API starting up...")
    database.init_db()
    print(f"Database initialized at {database._db_path}")

    # Seed default settings
    db = database.SessionLocal()
    try:
        settings_routes.seed_defaults(db)
        print("Settings defaults seeded")
    finally:
        db.close()
    backend_type = get_backend_type()
    print(f"Backend: {backend_type.upper()}")
    print(f"GPU available: {_get_gpu_status()}")

    try:
        progress_manager = get_progress_manager()
        progress_manager._set_main_loop(asyncio.get_running_loop())
        print("Progress manager initialized with event loop")
    except Exception as e:
        print(f"Warning: Could not initialize progress manager event loop: {e}")

    try:
        from .utils.tasks import get_task_manager
        get_task_manager().set_main_loop(asyncio.get_running_loop())
        print("Task manager initialized with event loop")
    except Exception as e:
        print(f"Warning: Could not initialize task manager event loop: {e}")

    try:
        from huggingface_hub import constants as hf_constants
        cache_dir = Path(hf_constants.HF_HUB_CACHE)
        cache_dir.mkdir(parents=True, exist_ok=True)
        print(f"HuggingFace cache directory: {cache_dir}")
    except Exception as e:
        print(f"Warning: Could not create HuggingFace cache directory: {e}")
        print("Model downloads may fail. Please ensure the directory exists and has write permissions.")

    yield

    # Shutdown
    print("voicebox API shutting down...")
    tts.unload_tts_model()
    transcribe.unload_whisper_model()


app = FastAPI(
    title="voicebox API",
    description="Production-quality Qwen3-TTS voice cloning API",
    version=__version__,
    lifespan=lifespan,
)

# CORS middleware
_allowed_origins = os.environ.get(
    "ALLOWED_ORIGINS",
    "http://localhost:1420,http://127.0.0.1:1420,tauri://localhost,http://localhost:5173,http://localhost:8080"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router)
app.include_router(profile_routes.router)
app.include_router(channel_routes.router)
app.include_router(generation.router)
app.include_router(history_routes.router)
app.include_router(story_routes.router)
app.include_router(model_management.router)
app.include_router(task_routes.router)
app.include_router(settings_routes.router)
app.include_router(video_import.router)
app.include_router(transcription_routes.router)
app.include_router(api_v1.router)


def _get_gpu_status() -> str:
    """Get GPU availability status."""
    backend_type = get_backend_type()
    if torch.cuda.is_available():
        return f"CUDA ({torch.cuda.get_device_name(0)})"
    elif hasattr(torch.backends, 'mps') and torch.backends.mps.is_available():
        return "MPS (Apple Silicon)"
    elif backend_type == "mlx":
        return "Metal (Apple Silicon via MLX)"
    return "None (CPU only)"


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="voicebox backend server")
    parser.add_argument(
        "--host",
        type=str,
        default="127.0.0.1",
        help="Host to bind to (use 0.0.0.0 for remote access)",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=8000,
        help="Port to bind to",
    )
    parser.add_argument(
        "--data-dir",
        type=str,
        default=None,
        help="Data directory for database, profiles, and generated audio",
    )
    args = parser.parse_args()

    # Set data directory if provided
    if args.data_dir:
        config.set_data_dir(args.data_dir)

    uvicorn.run(
        "backend.main:app",
        host=args.host,
        port=args.port,
        reload=False,  # Disable reload in production
    )
