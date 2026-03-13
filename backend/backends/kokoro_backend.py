"""
Kokoro TTS backend — lightweight 82M parameter TTS model.

Uses the kokoro pip package with KPipeline for text-to-speech.
Voices are pre-built .pt files (no voice cloning). Output: 24kHz.
"""

from typing import Optional, List, Tuple
import asyncio
import numpy as np
from pathlib import Path

from . import TTSBackend


class KokoroTTSBackend:
    """Kokoro TTS backend using KPipeline (StyleTTS2 + ISTFTNet)."""

    SAMPLE_RATE = 24000
    # Container path where voice/ is mounted
    MODEL_DIR = Path("/home/models/kokoro")

    def __init__(self):
        self.pipeline = None
        self.model_size = "82M"
        self._available_voices: list[str] = []

    def is_loaded(self) -> bool:
        return self.pipeline is not None

    def _get_model_path(self, model_size: str) -> str:
        """Return the local model directory path."""
        return str(self.MODEL_DIR)

    # ------------------------------------------------------------------
    # Model lifecycle
    # ------------------------------------------------------------------

    async def load_model(self, model_size: str = "82M") -> None:
        """Load Kokoro model into memory."""
        if self.pipeline is not None:
            return
        await asyncio.to_thread(self._load_model_sync)

    load_model_async = load_model  # alias for consistency

    def _load_model_sync(self) -> None:
        try:
            from kokoro import KPipeline

            print("[Kokoro] Loading pipeline (lang_code='a') ...")
            self.pipeline = KPipeline(lang_code="a")
            self._scan_voices()
            print(f"[Kokoro] Loaded. {len(self._available_voices)} voices available.")
        except Exception as e:
            print(f"[Kokoro] Error loading model: {e}")
            raise

    def unload_model(self) -> None:
        if self.pipeline is not None:
            del self.pipeline
            self.pipeline = None
            self._available_voices = []
            print("[Kokoro] Model unloaded.")

    # ------------------------------------------------------------------
    # Voice helpers
    # ------------------------------------------------------------------

    def _scan_voices(self) -> None:
        """Discover available .pt voice files on disk."""
        voices_dir = self.MODEL_DIR / "voices"
        if voices_dir.exists():
            self._available_voices = sorted(
                p.stem for p in voices_dir.glob("*.pt")
            )

    def get_available_voices(self) -> list[str]:
        if not self._available_voices:
            self._scan_voices()
        return self._available_voices

    # ------------------------------------------------------------------
    # TTSBackend protocol — voice cloning stubs (Kokoro uses built-in voices)
    # ------------------------------------------------------------------

    async def create_voice_prompt(
        self,
        audio_path: str,
        reference_text: str,
        use_cache: bool = True,
    ) -> Tuple[dict, bool]:
        """Kokoro has no voice cloning — return empty prompt."""
        return {}, False

    async def combine_voice_prompts(
        self,
        audio_paths: List[str],
        reference_texts: List[str],
    ) -> Tuple[np.ndarray, str]:
        """Not applicable for Kokoro."""
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
        """Generate audio using Kokoro built-in voices.

        ``voice_prompt`` should contain ``{"voice_name": "<name>"}`` when
        called from the updated generate endpoint. Falls back to "af_heart".
        """
        await self.load_model()

        voice_name = voice_prompt.get("voice_name", "af_heart")

        def _generate_sync() -> Tuple[np.ndarray, int]:
            import torch

            if seed is not None:
                torch.manual_seed(seed)

            # Map language codes to Kokoro lang_code
            lang_map = {
                "en": "a", "zh": "z", "ja": "j", "ko": "a",
                "de": "a", "fr": "f", "ru": "a", "pt": "p",
                "es": "e", "it": "i",
            }
            lang_code = lang_map.get(language, "a")

            # Re-create pipeline if language changed
            if self.pipeline is not None and getattr(self.pipeline, "lang_code", "a") != lang_code:
                from kokoro import KPipeline
                self.pipeline = KPipeline(lang_code=lang_code)

            # Kokoro yields segments — concatenate them
            segments: list[np.ndarray] = []
            for _gs, _ps, audio_segment in self.pipeline(
                text, voice=voice_name, speed=1.0
            ):
                if audio_segment is not None:
                    segments.append(audio_segment)

            if not segments:
                raise ValueError("[Kokoro] No audio segments produced.")

            audio = np.concatenate(segments)
            return audio, self.SAMPLE_RATE

        return await asyncio.to_thread(_generate_sync)

    # ------------------------------------------------------------------
    # Quick generate (non-voice-cloning path)
    # ------------------------------------------------------------------

    async def generate_quick(
        self,
        text: str,
        voice_name: str = "af_heart",
        language: str = "en",
        speed: float = 1.0,
        seed: Optional[int] = None,
    ) -> Tuple[np.ndarray, int]:
        """Simplified generation with built-in voice — no profile needed."""
        return await self.generate(
            text=text,
            voice_prompt={"voice_name": voice_name},
            language=language,
            seed=seed,
        )
