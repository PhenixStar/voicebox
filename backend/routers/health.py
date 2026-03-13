"""Health and server management routes."""

from fastapi import APIRouter, Request, HTTPException
import asyncio
import signal
import os
import torch
from pathlib import Path

from .. import models, tts, transcribe, config, database, __version__
from ..platform_detect import get_backend_type

router = APIRouter(tags=["health"])


@router.get("/")
async def root():
    """Root endpoint."""
    return {"message": "voicebox API", "version": __version__}


@router.post("/shutdown")
async def shutdown(request: Request):
    """Gracefully shutdown the server."""
    client_host = request.client.host if request.client else ""
    if client_host not in ("127.0.0.1", "::1", "localhost"):
        raise HTTPException(status_code=403, detail="Shutdown is only allowed from localhost")

    async def shutdown_async():
        await asyncio.sleep(0.1)
        os.kill(os.getpid(), signal.SIGTERM)

    asyncio.create_task(shutdown_async())
    return {"message": "Shutting down..."}


@router.get("/health", response_model=models.HealthResponse)
async def health():
    """Health check endpoint."""
    from huggingface_hub import constants as hf_constants

    tts_model = tts.get_tts_model()
    backend_type = get_backend_type()

    # Check for GPU availability (CUDA or MPS)
    has_cuda = torch.cuda.is_available()
    has_mps = hasattr(torch.backends, 'mps') and torch.backends.mps.is_available()
    gpu_available = has_cuda or has_mps

    gpu_type = None
    if has_cuda:
        gpu_type = f"CUDA ({torch.cuda.get_device_name(0)})"
    elif has_mps:
        gpu_type = "MPS (Apple Silicon)"
    elif backend_type == "mlx":
        gpu_type = "Metal (Apple Silicon via MLX)"

    vram_used = None
    if has_cuda:
        vram_used = torch.cuda.memory_allocated() / 1024 / 1024  # MB

    # Check if model is loaded
    model_loaded = False
    model_size = None
    try:
        if tts_model.is_loaded():
            model_loaded = True
            model_size = getattr(tts_model, '_current_model_size', None)
            if not model_size:
                model_size = getattr(tts_model, 'model_size', None)
    except Exception:
        model_loaded = False
        model_size = None

    # Check if default model is downloaded (cached)
    model_downloaded = None
    try:
        if backend_type == "mlx":
            default_model_id = "mlx-community/Qwen3-TTS-12Hz-1.7B-Base-bf16"
        else:
            default_model_id = "Qwen/Qwen3-TTS-12Hz-1.7B-Base"

        try:
            from huggingface_hub import scan_cache_dir
            cache_info = scan_cache_dir()
            for repo in cache_info.repos:
                if repo.repo_id == default_model_id:
                    model_downloaded = True
                    break
        except (ImportError, Exception):
            cache_dir = hf_constants.HF_HUB_CACHE
            repo_cache = Path(cache_dir) / ("models--" + default_model_id.replace("/", "--"))
            if repo_cache.exists():
                has_model_files = (
                    any(repo_cache.rglob("*.bin")) or
                    any(repo_cache.rglob("*.safetensors")) or
                    any(repo_cache.rglob("*.pt")) or
                    any(repo_cache.rglob("*.pth")) or
                    any(repo_cache.rglob("*.npz"))
                )
                model_downloaded = has_model_files
    except Exception:
        pass

    return models.HealthResponse(
        status="healthy",
        model_loaded=model_loaded,
        model_downloaded=model_downloaded,
        model_size=model_size,
        gpu_available=gpu_available,
        gpu_type=gpu_type,
        vram_used_mb=vram_used,
        backend_type=backend_type,
    )
