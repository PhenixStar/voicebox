"""
Backend abstraction layer for TTS and STT.

Provides a unified interface for MLX and PyTorch backends.
"""

from typing import Protocol, Optional, Tuple, List
from typing_extensions import runtime_checkable
import numpy as np

from ..platform_detect import get_backend_type


@runtime_checkable
class TTSBackend(Protocol):
    """Protocol for TTS backend implementations."""
    
    async def load_model(self, model_size: str) -> None:
        """Load TTS model."""
        ...
    
    async def create_voice_prompt(
        self,
        audio_path: str,
        reference_text: str,
        use_cache: bool = True,
    ) -> Tuple[dict, bool]:
        """
        Create voice prompt from reference audio.
        
        Returns:
            Tuple of (voice_prompt_dict, was_cached)
        """
        ...
    
    async def combine_voice_prompts(
        self,
        audio_paths: List[str],
        reference_texts: List[str],
    ) -> Tuple[np.ndarray, str]:
        """
        Combine multiple voice prompts.
        
        Returns:
            Tuple of (combined_audio_array, combined_text)
        """
        ...
    
    async def generate(
        self,
        text: str,
        voice_prompt: dict,
        language: str = "en",
        seed: Optional[int] = None,
        instruct: Optional[str] = None,
    ) -> Tuple[np.ndarray, int]:
        """
        Generate audio from text.
        
        Returns:
            Tuple of (audio_array, sample_rate)
        """
        ...
    
    def unload_model(self) -> None:
        """Unload model to free memory."""
        ...
    
    def is_loaded(self) -> bool:
        """Check if model is loaded."""
        ...
    
    def _get_model_path(self, model_size: str) -> str:
        """
        Get model path for a given size.
        
        Returns:
            Model path or HuggingFace Hub ID
        """
        ...


@runtime_checkable
class STTBackend(Protocol):
    """Protocol for STT (Speech-to-Text) backend implementations."""
    
    async def load_model(self, model_size: str) -> None:
        """Load STT model."""
        ...
    
    async def transcribe(
        self,
        audio_path: str,
        language: Optional[str] = None,
    ) -> str:
        """
        Transcribe audio to text.
        
        Returns:
            Transcribed text
        """
        ...
    
    def unload_model(self) -> None:
        """Unload model to free memory."""
        ...
    
    def is_loaded(self) -> bool:
        """Check if model is loaded."""
        ...


# Global backend instances — keyed by backend_type
_tts_backends: dict[str, TTSBackend] = {}
_stt_backend: Optional[STTBackend] = None


def get_tts_backend(backend_type_override: Optional[str] = None) -> TTSBackend:
    """
    Get or create TTS backend instance.

    Args:
        backend_type_override: Explicit backend type ("qwen", "kokoro",
            "kugelaudio"). If None, returns the default Qwen/MLX backend.

    Returns:
        TTS backend instance
    """
    # Resolve the key
    if backend_type_override is None:
        platform = get_backend_type()
        key = "mlx" if platform == "mlx" else "qwen"
    else:
        key = backend_type_override

    if key not in _tts_backends:
        if key == "mlx":
            from .mlx_backend import MLXTTSBackend
            _tts_backends[key] = MLXTTSBackend()
        elif key == "kokoro":
            from .kokoro_backend import KokoroTTSBackend
            _tts_backends[key] = KokoroTTSBackend()
        elif key == "kugelaudio":
            from .kugelaudio_backend import KugelAudioTTSBackend
            _tts_backends[key] = KugelAudioTTSBackend()
        else:
            # Default: PyTorch Qwen backend
            from .pytorch_backend import PyTorchTTSBackend
            _tts_backends[key] = PyTorchTTSBackend()

    return _tts_backends[key]


def get_stt_backend() -> STTBackend:
    """
    Get or create STT backend instance based on platform.

    Returns:
        STT backend instance (MLX or PyTorch)
    """
    global _stt_backend

    if _stt_backend is None:
        backend_type = get_backend_type()

        if backend_type == "mlx":
            from .mlx_backend import MLXSTTBackend
            _stt_backend = MLXSTTBackend()
        else:
            from .pytorch_backend import PyTorchSTTBackend
            _stt_backend = PyTorchSTTBackend()

    return _stt_backend


def reset_backends():
    """Reset all backend instances (useful for testing)."""
    global _stt_backend
    _tts_backends.clear()
    _stt_backend = None
