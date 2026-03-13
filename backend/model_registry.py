"""Centralized model configuration registry.

Single source of truth for model configs used by status, download,
and delete endpoints.  Avoids the 3x duplication that previously
lived in main.py.
"""

from .platform_detect import get_backend_type


def get_model_configs() -> list[dict]:
    """Return the canonical list of model configurations.

    Each entry contains at least:
      model_name, display_name, hf_repo_id, model_size, model_type

    Local-only models add: local_path, local_weight_file, backend_type, is_local.
    """
    backend_type = get_backend_type()

    if backend_type == "mlx":
        tts_1_7b_id = "mlx-community/Qwen3-TTS-12Hz-1.7B-Base-bf16"
        tts_0_6b_id = "mlx-community/Qwen3-TTS-12Hz-0.6B-Base-bf16"
    else:
        tts_1_7b_id = "Qwen/Qwen3-TTS-12Hz-1.7B-Base"
        tts_0_6b_id = "Qwen/Qwen3-TTS-12Hz-0.6B-Base"

    return [
        {
            "model_name": "qwen-tts-1.7B",
            "display_name": "Qwen TTS 1.7B",
            "hf_repo_id": tts_1_7b_id,
            "model_size": "1.7B",
            "model_type": "tts",
        },
        {
            "model_name": "qwen-tts-0.6B",
            "display_name": "Qwen TTS 0.6B",
            "hf_repo_id": tts_0_6b_id,
            "model_size": "0.6B",
            "model_type": "tts",
        },
        {
            "model_name": "whisper-base",
            "display_name": "Whisper Base",
            "hf_repo_id": "Systran/faster-whisper-base",
            "model_size": "base",
            "model_type": "whisper",
        },
        {
            "model_name": "whisper-small",
            "display_name": "Whisper Small",
            "hf_repo_id": "Systran/faster-whisper-small",
            "model_size": "small",
            "model_type": "whisper",
        },
        {
            "model_name": "whisper-medium",
            "display_name": "Whisper Medium",
            "hf_repo_id": "Systran/faster-whisper-medium",
            "model_size": "medium",
            "model_type": "whisper",
        },
        {
            "model_name": "whisper-large",
            "display_name": "Whisper Large v3",
            "hf_repo_id": "Systran/faster-whisper-large-v3",
            "model_size": "large",
            "model_type": "whisper",
        },
        {
            "model_name": "kokoro-82M",
            "display_name": "Kokoro 82M",
            "hf_repo_id": None,
            "local_path": "/home/models/kokoro",
            "local_weight_file": "kokoro-v1_0.pth",
            "model_size": "82M",
            "backend_type": "kokoro",
            "model_type": "tts",
            "is_local": True,
        },
        {
            "model_name": "kugelaudio-7B",
            "display_name": "KugelAudio 7B",
            "hf_repo_id": None,
            "local_path": "/home/models/kugelaudio",
            "local_weight_file": "model-00001-of-00004.safetensors",
            "model_size": "7B",
            "backend_type": "kugelaudio",
            "model_type": "tts",
            "is_local": True,
        },
        {
            "model_name": "elevenlabs-v2",
            "display_name": "ElevenLabs v2",
            "hf_repo_id": None,
            "model_size": "cloud",
            "backend_type": "elevenlabs",
            "model_type": "tts",
            "is_local": False,
            "is_cloud": True,
        },
    ]


def get_model_config_by_name(model_name: str) -> dict | None:
    """Look up a model config by its model_name key."""
    for cfg in get_model_configs():
        if cfg["model_name"] == model_name:
            return cfg
    return None
