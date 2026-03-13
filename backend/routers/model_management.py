"""Model management routes (download, delete, status, cache)."""

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
import asyncio
from pathlib import Path

from .. import models, tts, transcribe
from ..platform_detect import get_backend_type
from ..model_registry import get_model_configs, get_model_config_by_name
from ..utils.progress import get_progress_manager
from ..utils.tasks import get_task_manager
from ..utils.cache import clear_voice_prompt_cache

router = APIRouter(tags=["models"])


@router.post("/models/load")
async def load_model(model_size: str = "1.7B"):
    """Manually load TTS model."""
    try:
        tts_model = tts.get_tts_model()
        await tts_model.load_model_async(model_size)
        return {"message": f"Model {model_size} loaded successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/models/unload")
async def unload_model():
    """Unload TTS model to free memory."""
    try:
        tts.unload_tts_model()
        return {"message": "Model unloaded successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/models/progress/{model_name}")
async def get_model_progress(model_name: str):
    """Get model download progress via Server-Sent Events."""
    progress_manager = get_progress_manager()

    async def event_generator():
        """Generate SSE events for progress updates."""
        async for event in progress_manager.subscribe(model_name):
            yield event

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/models/status", response_model=models.ModelStatusListResponse)
async def get_model_status():
    """Get status of all available models."""
    from huggingface_hub import constants as hf_constants

    backend_type = get_backend_type()
    task_manager = get_task_manager()

    active_download_names = {task.model_name for task in task_manager.get_active_downloads()}

    try:
        from huggingface_hub import scan_cache_dir
        use_scan_cache = True
    except ImportError:
        use_scan_cache = False

    def check_tts_loaded(model_size: str):
        """Check if TTS model is loaded with specific size."""
        try:
            tts_model = tts.get_tts_model()
            return tts_model.is_loaded() and getattr(tts_model, 'model_size', None) == model_size
        except Exception:
            return False

    def check_whisper_loaded(model_size: str):
        """Check if Whisper model is loaded with specific size."""
        try:
            whisper_model = transcribe.get_whisper_model()
            return whisper_model.is_loaded() and getattr(whisper_model, 'model_size', None) == model_size
        except Exception:
            return False

    def check_kokoro_loaded():
        """Check if Kokoro model is loaded."""
        try:
            from ..backends import get_tts_backend
            backend = get_tts_backend("kokoro")
            return backend.is_loaded()
        except Exception:
            return False

    def check_kugelaudio_loaded():
        """Check if KugelAudio model is loaded."""
        try:
            from ..backends import get_tts_backend
            backend = get_tts_backend("kugelaudio")
            return backend.is_loaded()
        except Exception:
            return False

    def check_local_model_exists(local_path: str, weight_file: str) -> bool:
        """Check if a local (non-HF) model directory has its weight file."""
        return Path(local_path).joinpath(weight_file).exists()

    # Build model configs with check_loaded closures from registry
    model_cfg_list = get_model_configs()

    # Map model_name -> check_loaded callable
    loaded_checks = {
        "qwen-tts-1.7B": lambda: check_tts_loaded("1.7B"),
        "qwen-tts-0.6B": lambda: check_tts_loaded("0.6B"),
        "whisper-base": lambda: check_whisper_loaded("base"),
        "whisper-small": lambda: check_whisper_loaded("small"),
        "whisper-medium": lambda: check_whisper_loaded("medium"),
        "whisper-large": lambda: check_whisper_loaded("large"),
        "kokoro-82M": check_kokoro_loaded,
        "kugelaudio-7B": check_kugelaudio_loaded,
    }

    # Build repo -> model_name mapping for HF models
    model_to_repo = {
        cfg["model_name"]: cfg["hf_repo_id"]
        for cfg in model_cfg_list if cfg.get("hf_repo_id")
    }
    active_download_repos = {model_to_repo.get(name) for name in active_download_names if name in model_to_repo}

    # Get HuggingFace cache info
    cache_info = None
    if use_scan_cache:
        try:
            cache_info = scan_cache_dir()
        except Exception:
            pass

    statuses = []

    for cfg in model_cfg_list:
        try:
            downloaded = False
            size_mb = None
            loaded = False
            is_local = cfg.get("is_local", False)
            is_cloud = cfg.get("is_cloud", False)

            # Cloud models: always "downloaded" (API-based)
            if is_cloud:
                import os
                api_key = os.environ.get("ELEVENLABS_API_KEY", "")
                statuses.append(models.ModelStatus(
                    model_name=cfg["model_name"],
                    display_name=cfg["display_name"],
                    downloaded=bool(api_key),
                    downloading=False,
                    size_mb=None,
                    loaded=bool(api_key),
                    backend_type=cfg.get("backend_type"),
                    model_type=cfg.get("model_type", "tts"),
                    is_local=False,
                    is_cloud=True,
                ))
                continue

            # Local models: check weight file on disk
            if is_local:
                local_path = cfg.get("local_path", "")
                weight_file = cfg.get("local_weight_file", "")
                downloaded = check_local_model_exists(local_path, weight_file)
                if downloaded:
                    try:
                        model_dir = Path(local_path)
                        total_size = sum(
                            f.stat().st_size for f in model_dir.rglob("*")
                            if f.is_file()
                        )
                        size_mb = total_size / (1024 * 1024)
                    except Exception:
                        pass

                try:
                    check_fn = loaded_checks.get(cfg["model_name"])
                    loaded = check_fn() if check_fn else False
                except Exception:
                    loaded = False

                statuses.append(models.ModelStatus(
                    model_name=cfg["model_name"],
                    display_name=cfg["display_name"],
                    downloaded=downloaded,
                    downloading=False,
                    size_mb=size_mb,
                    loaded=loaded,
                    backend_type=cfg.get("backend_type"),
                    model_type=cfg.get("model_type", "tts"),
                    is_local=True,
                ))
                continue

            # HF models: check cache
            if cache_info:
                repo_id = cfg["hf_repo_id"]
                for repo in cache_info.repos:
                    if repo.repo_id == repo_id:
                        has_model_weights = False
                        for rev in repo.revisions:
                            for f in rev.files:
                                fname = f.file_name.lower()
                                if fname.endswith(('.safetensors', '.bin', '.pt', '.pth', '.npz')):
                                    has_model_weights = True
                                    break
                            if has_model_weights:
                                break

                        has_incomplete = False
                        try:
                            cache_dir = hf_constants.HF_HUB_CACHE
                            blobs_dir = Path(cache_dir) / ("models--" + repo_id.replace("/", "--")) / "blobs"
                            if blobs_dir.exists():
                                has_incomplete = any(blobs_dir.glob("*.incomplete"))
                        except Exception:
                            pass

                        if has_model_weights and not has_incomplete:
                            downloaded = True
                            try:
                                total_size = sum(revision.size_on_disk for revision in repo.revisions)
                                size_mb = total_size / (1024 * 1024)
                            except Exception:
                                pass
                        break

            # Fallback: check cache directory directly
            if not downloaded:
                try:
                    cache_dir = hf_constants.HF_HUB_CACHE
                    repo_cache = Path(cache_dir) / ("models--" + cfg["hf_repo_id"].replace("/", "--"))

                    if repo_cache.exists():
                        blobs_dir = repo_cache / "blobs"
                        has_incomplete = blobs_dir.exists() and any(blobs_dir.glob("*.incomplete"))

                        if not has_incomplete:
                            snapshots_dir = repo_cache / "snapshots"
                            has_model_files = False
                            if snapshots_dir.exists():
                                has_model_files = (
                                    any(snapshots_dir.rglob("*.bin")) or
                                    any(snapshots_dir.rglob("*.safetensors")) or
                                    any(snapshots_dir.rglob("*.pt")) or
                                    any(snapshots_dir.rglob("*.pth")) or
                                    any(snapshots_dir.rglob("*.npz"))
                                )

                            if has_model_files:
                                downloaded = True
                                try:
                                    total_size = sum(
                                        f.stat().st_size for f in repo_cache.rglob("*")
                                        if f.is_file() and not f.name.endswith('.incomplete')
                                    )
                                    size_mb = total_size / (1024 * 1024)
                                except Exception:
                                    pass
                except Exception:
                    pass

            # Check if loaded in memory
            try:
                check_fn = loaded_checks.get(cfg["model_name"])
                loaded = check_fn() if check_fn else False
            except Exception:
                loaded = False

            # Check if currently downloading
            is_downloading = cfg["hf_repo_id"] in active_download_repos

            if is_downloading:
                downloaded = False
                size_mb = None

            statuses.append(models.ModelStatus(
                model_name=cfg["model_name"],
                display_name=cfg["display_name"],
                downloaded=downloaded,
                downloading=is_downloading,
                size_mb=size_mb,
                loaded=loaded,
                backend_type=cfg.get("backend_type"),
                model_type=cfg.get("model_type"),
                is_local=False,
            ))
        except Exception:
            try:
                check_fn = loaded_checks.get(cfg["model_name"])
                loaded = check_fn() if check_fn else False
            except Exception:
                loaded = False

            is_downloading = (cfg.get("hf_repo_id") or "") in active_download_repos

            statuses.append(models.ModelStatus(
                model_name=cfg["model_name"],
                display_name=cfg["display_name"],
                downloaded=False,
                downloading=is_downloading,
                size_mb=None,
                loaded=loaded,
                backend_type=cfg.get("backend_type"),
                model_type=cfg.get("model_type"),
                is_local=cfg.get("is_local", False),
            ))

    return models.ModelStatusListResponse(models=statuses)


@router.post("/models/download")
async def trigger_model_download(request: models.ModelDownloadRequest):
    """Trigger download of a specific model."""
    task_manager = get_task_manager()
    progress_manager = get_progress_manager()

    # Local models: no download needed -- just load into memory
    from ..backends import get_tts_backend as _get_tts_backend
    local_models = {"kokoro-82M", "kugelaudio-7B"}
    if request.model_name in local_models:
        backend_map = {"kokoro-82M": "kokoro", "kugelaudio-7B": "kugelaudio"}
        backend = _get_tts_backend(backend_map[request.model_name])
        if backend.is_loaded():
            return {"message": f"Model {request.model_name} already loaded"}
        try:
            await backend.load_model()
            return {"message": f"Model {request.model_name} loaded successfully"}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to load {request.model_name}: {e}")

    download_configs = {
        "qwen-tts-1.7B": {
            "model_size": "1.7B",
            "load_func": lambda: tts.get_tts_model().load_model("1.7B"),
        },
        "qwen-tts-0.6B": {
            "model_size": "0.6B",
            "load_func": lambda: tts.get_tts_model().load_model("0.6B"),
        },
        "whisper-base": {
            "model_size": "base",
            "load_func": lambda: transcribe.get_whisper_model().load_model("base"),
        },
        "whisper-small": {
            "model_size": "small",
            "load_func": lambda: transcribe.get_whisper_model().load_model("small"),
        },
        "whisper-medium": {
            "model_size": "medium",
            "load_func": lambda: transcribe.get_whisper_model().load_model("medium"),
        },
        "whisper-large": {
            "model_size": "large",
            "load_func": lambda: transcribe.get_whisper_model().load_model("large"),
        },
    }

    if request.model_name not in download_configs:
        raise HTTPException(status_code=400, detail=f"Unknown model: {request.model_name}")

    dl_cfg = download_configs[request.model_name]

    async def download_in_background():
        """Download model in background without blocking the HTTP request."""
        try:
            result = dl_cfg["load_func"]()
            if asyncio.iscoroutine(result):
                await result
            task_manager.complete_download(request.model_name)
        except Exception as e:
            task_manager.error_download(request.model_name, str(e))

    task_manager.start_download(request.model_name)

    # Seed initial progress so SSE has data immediately
    progress_manager.update_progress(
        model_name=request.model_name,
        current=0,
        total=0,
        filename="Connecting to HuggingFace...",
        status="downloading",
    )

    asyncio.create_task(download_in_background())

    return {"message": f"Model {request.model_name} download started"}


@router.delete("/models/{model_name}")
async def delete_model(model_name: str):
    """Delete a downloaded model from the HuggingFace cache.

    Local models (Kokoro, KugelAudio) can only be unloaded, not deleted.
    """
    import shutil
    from huggingface_hub import constants as hf_constants

    # Cloud models: nothing to delete on disk
    cloud_models = {"elevenlabs-v2"}
    if model_name in cloud_models:
        return {"message": f"Model {model_name} is a cloud API — nothing to delete"}

    # Local models: unload from GPU but don't delete files
    local_models = {"kokoro-82M": "kokoro", "kugelaudio-7B": "kugelaudio"}
    if model_name in local_models:
        from ..backends import get_tts_backend as _get_tts_backend
        backend = _get_tts_backend(local_models[model_name])
        if backend.is_loaded():
            backend.unload_model()
            return {"message": f"Model {model_name} unloaded (local model files preserved)"}
        return {"message": f"Model {model_name} was not loaded"}

    # Look up config from the registry
    cfg = get_model_config_by_name(model_name)
    if not cfg or not cfg.get("hf_repo_id"):
        raise HTTPException(status_code=400, detail=f"Unknown model: {model_name}")

    hf_repo_id = cfg["hf_repo_id"]

    try:
        # Unload if currently loaded
        if cfg["model_type"] == "tts":
            tts_model = tts.get_tts_model()
            if tts_model.is_loaded() and tts_model.model_size == cfg["model_size"]:
                tts.unload_tts_model()
        elif cfg["model_type"] == "whisper":
            whisper_model = transcribe.get_whisper_model()
            if whisper_model.is_loaded() and whisper_model.model_size == cfg["model_size"]:
                transcribe.unload_whisper_model()

        cache_dir = hf_constants.HF_HUB_CACHE
        repo_cache_dir = Path(cache_dir) / ("models--" + hf_repo_id.replace("/", "--"))

        if not repo_cache_dir.exists():
            raise HTTPException(status_code=404, detail=f"Model {model_name} not found in cache")

        try:
            shutil.rmtree(repo_cache_dir)
        except OSError as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to delete model cache directory: {str(e)}"
            )

        return {"message": f"Model {model_name} deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete model: {str(e)}")


@router.post("/cache/clear")
async def clear_cache():
    """Clear all voice prompt caches (memory and disk)."""
    try:
        deleted_count = clear_voice_prompt_cache()
        return {
            "message": "Voice prompt cache cleared successfully",
            "files_deleted": deleted_count,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to clear cache: {str(e)}")
