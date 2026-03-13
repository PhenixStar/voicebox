"""
KugelAudio TTS backend — 7B parameter AR+Diffusion TTS model.

Uses kugelaudio-open pip package. Supports 24 European languages,
built-in voices (default, warm, clear). Output: 24kHz.
Requires ~19GB VRAM (bfloat16 on CUDA).
"""

from typing import Optional, List, Tuple
import asyncio
import numpy as np
from pathlib import Path

from . import TTSBackend


class KugelAudioTTSBackend:
    """KugelAudio TTS backend (Qwen2.5-7B backbone, AR+Diffusion)."""

    SAMPLE_RATE = 24000
    # Container path where voice/ is mounted
    MODEL_DIR = Path("/home/models/kugelaudio")

    def __init__(self):
        self.model = None
        self.processor = None
        self.model_size = "7B"
        self.device = self._get_device()
        self._available_voices: list[str] = []

    @staticmethod
    def _get_device() -> str:
        import torch
        return "cuda" if torch.cuda.is_available() else "cpu"

    def is_loaded(self) -> bool:
        return self.model is not None

    def _get_model_path(self, model_size: str) -> str:
        return str(self.MODEL_DIR)

    # ------------------------------------------------------------------
    # Model lifecycle
    # ------------------------------------------------------------------

    async def load_model(self, model_size: str = "7B") -> None:
        if self.model is not None:
            return
        await asyncio.to_thread(self._load_model_sync)

    load_model_async = load_model  # alias

    def _load_model_sync(self) -> None:
        try:
            import torch
            from kugelaudio_open import (
                KugelAudioForConditionalGenerationInference,
                KugelAudioProcessor,
            )

            model_path = str(self.MODEL_DIR)
            print(f"[KugelAudio] Loading model from {model_path} on {self.device} ...")

            # Use device_map instead of .to() to avoid
            # "Cannot copy out of meta tensor" with lazy-loaded weights.
            try:
                self.model = KugelAudioForConditionalGenerationInference.from_pretrained(
                    model_path,
                    torch_dtype=torch.bfloat16,
                    device_map=self.device,
                )
            except TypeError:
                # Fallback: library may not support device_map —
                # disable meta-tensor loading so .to() works.
                self.model = KugelAudioForConditionalGenerationInference.from_pretrained(
                    model_path,
                    torch_dtype=torch.bfloat16,
                    low_cpu_mem_usage=False,
                ).to(self.device)
            self.model.eval()
            # Strip encoder weights to save VRAM (only decoders needed at inference)
            self.model.model.strip_encoders()

            self.processor = KugelAudioProcessor.from_pretrained(model_path)

            self._available_voices = self.processor.get_available_voices()
            print(f"[KugelAudio] Loaded. Voices: {self._available_voices}")

        except Exception as e:
            print(f"[KugelAudio] Error loading model: {e}")
            raise

    def unload_model(self) -> None:
        import torch

        if self.model is not None:
            del self.model
            del self.processor
            self.model = None
            self.processor = None
            self._available_voices = []
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
            print("[KugelAudio] Model unloaded.")

    # ------------------------------------------------------------------
    # Voice helpers
    # ------------------------------------------------------------------

    def get_available_voices(self) -> list[str]:
        if not self._available_voices and self.processor is not None:
            self._available_voices = self.processor.get_available_voices()
        return self._available_voices

    # ------------------------------------------------------------------
    # TTSBackend protocol — voice cloning stubs
    # ------------------------------------------------------------------

    async def create_voice_prompt(
        self,
        audio_path: str,
        reference_text: str,
        use_cache: bool = True,
    ) -> Tuple[dict, bool]:
        """KugelAudio uses built-in voices — return empty prompt."""
        return {}, False

    async def combine_voice_prompts(
        self,
        audio_paths: List[str],
        reference_texts: List[str],
    ) -> Tuple[np.ndarray, str]:
        return np.array([]), ""

    # ------------------------------------------------------------------
    # Generation
    # ------------------------------------------------------------------

    async def generate(
        self,
        text: str,
        voice_prompt: dict,
        language: str = "en",
        seed: Optional[int] = None,
        instruct: Optional[str] = None,
    ) -> Tuple[np.ndarray, int]:
        """Generate audio with KugelAudio built-in voices.

        ``voice_prompt`` should contain ``{"voice_name": "<name>"}``
        when called from the updated generate endpoint.
        Falls back to "default".
        """
        await self.load_model()

        voice_name = voice_prompt.get("voice_name", "default")

        def _generate_sync() -> Tuple[np.ndarray, int]:
            import torch

            if seed is not None:
                torch.manual_seed(seed)
                if torch.cuda.is_available():
                    torch.cuda.manual_seed(seed)

            inputs = self.processor(
                text=text, voice=voice_name, return_tensors="pt"
            )
            inputs = {
                k: v.to(self.device) if isinstance(v, torch.Tensor) else v
                for k, v in inputs.items()
            }

            with torch.no_grad():
                outputs = self.model.generate(**inputs, cfg_scale=3.0)

            audio = outputs.speech_outputs[0]
            # Convert torch tensor → numpy
            if isinstance(audio, torch.Tensor):
                audio = audio.cpu().float().numpy()

            return audio, self.SAMPLE_RATE

        return await asyncio.to_thread(_generate_sync)

    # ------------------------------------------------------------------
    # Quick generate (non-voice-cloning path)
    # ------------------------------------------------------------------

    async def generate_quick(
        self,
        text: str,
        voice_name: str = "default",
        language: str = "en",
        speed: float = 1.0,
        seed: Optional[int] = None,
    ) -> Tuple[np.ndarray, int]:
        """Simplified generation with built-in voice."""
        return await self.generate(
            text=text,
            voice_prompt={"voice_name": voice_name},
            language=language,
            seed=seed,
        )
