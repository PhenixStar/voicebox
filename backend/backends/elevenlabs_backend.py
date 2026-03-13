"""
ElevenLabs TTS backend — Cloud API fallback for voice generation.

Uses the ElevenLabs REST API (v1). Supports built-in voices and
voice cloning via uploaded samples. Output: configurable (default 24kHz mp3→wav).
Requires ELEVENLABS_API_KEY environment variable.
"""

from typing import Optional, List, Tuple
import asyncio
import os
import io
import numpy as np

ELEVENLABS_API_KEY = os.environ.get("ELEVENLABS_API_KEY", "")
ELEVENLABS_BASE_URL = "https://api.elevenlabs.io/v1"

# Default built-in voices (name -> voice_id)
BUILTIN_VOICES = {
    "rachel": "21m00Tcm4TlvDq8ikWAM",
    "drew": "29vD33N1CtxCmqQRPOHJ",
    "clyde": "2EiwWnXFnvU5JabPnv8n",
    "paul": "5Q0t7uMcjvnagumLfvZi",
    "domi": "AZnzlk1XvdvUeBnXmlld",
    "dave": "CYw3kZ02Hs0563khs1Fj",
    "fin": "D38z5RcWu1voky8WS1ja",
    "sarah": "EXAVITQu4vr4xnSDxMaL",
    "antoni": "ErXwobaYiN019PkySvjV",
    "thomas": "GBv7mTt0atIp3Br8iCZE",
    "charlie": "IKne3meq5aSn9XLyUdCD",
    "emily": "LcfcDJNUP1GQjkzn1xUU",
    "elli": "MF3mGyEYCl7XYWbV9V6O",
    "callum": "N2lVS1w4EtoT3dr4eOWO",
    "patrick": "ODq5zmih8GrVes37Dizd",
    "harry": "SOYHLrjzK2X1ezoPC6cr",
    "liam": "TX3LPaxmHKxFdv7VOQHJ",
    "dorothy": "ThT5KcBeYPX3keUQqHPh",
    "josh": "TxGEqnHWrfWFTfGW9XjX",
    "arnold": "VR6AewLTigWG4xSOukaG",
    "charlotte": "XB0fDUnXU5powFXDhCwa",
    "alice": "Xb7hH8MSUJpSbSDYk0k2",
    "matilda": "XrExE9yKIg1WjnnlVkGX",
    "james": "ZQe5CZNOzWyzPSCn5a3c",
    "jessica": "cgSgspJ2msm6clMCkdW9",
    "lily": "pFZP5JQG7iQjIQuC4Bku",
    "michael": "flq6f7yk4E4fJM5XTYuZ",
    "george": "JBFqnCBsd6RMkjVDRZzb",
    "brian": "nPczCjzI2devNBz1zQrb",
    "nicole": "piTKgcLEGmPE4e6mEKli",
}


class ElevenLabsTTSBackend:
    """ElevenLabs cloud TTS backend (API-based, no GPU needed)."""

    SAMPLE_RATE = 24000

    def __init__(self):
        self._api_key = ELEVENLABS_API_KEY
        self._cloned_voices: dict[str, str] = {}  # profile_id -> el_voice_id

    def is_loaded(self) -> bool:
        return bool(self._api_key)

    async def load_model(self, model_size: str = "v2") -> None:
        """No-op for cloud API."""
        if not self._api_key:
            raise ValueError("ELEVENLABS_API_KEY not set")

    load_model_async = load_model

    def unload_model(self) -> None:
        """No-op for cloud API."""
        pass

    def get_available_voices(self) -> list[str]:
        return list(BUILTIN_VOICES.keys())

    def _headers(self) -> dict:
        return {
            "xi-api-key": self._api_key,
            "Content-Type": "application/json",
        }

    async def generate(
        self,
        text: str,
        voice_prompt: dict,
        language: str = "en",
        seed: Optional[int] = None,
        instruct: Optional[str] = None,
    ) -> Tuple[np.ndarray, int]:
        """Generate audio via ElevenLabs API.

        voice_prompt should contain either:
          {"voice_name": "rachel"} for built-in voices, or
          {"voice_id": "abc123"} for cloned voices.
        """
        voice_name = voice_prompt.get("voice_name", "")
        voice_id = voice_prompt.get("voice_id", "")

        if not voice_id and voice_name:
            voice_id = BUILTIN_VOICES.get(voice_name.lower(), "")
            if not voice_id:
                raise ValueError(
                    f"Unknown ElevenLabs voice: {voice_name}. "
                    f"Available: {', '.join(BUILTIN_VOICES.keys())}"
                )

        if not voice_id:
            voice_id = BUILTIN_VOICES["rachel"]

        return await asyncio.to_thread(
            self._generate_sync, text, voice_id, language
        )

    def _generate_sync(
        self, text: str, voice_id: str, language: str
    ) -> Tuple[np.ndarray, int]:
        import httpx
        import soundfile as sf

        url = f"{ELEVENLABS_BASE_URL}/text-to-speech/{voice_id}"
        payload = {
            "text": text,
            "model_id": "eleven_multilingual_v2",
            "voice_settings": {
                "stability": 0.5,
                "similarity_boost": 0.75,
                "style": 0.0,
                "use_speaker_boost": True,
            },
        }

        response = httpx.post(
            url,
            json=payload,
            params={"output_format": "pcm_24000"},
            headers=self._headers(),
            timeout=60.0,
        )

        if response.status_code != 200:
            raise ValueError(
                f"ElevenLabs API error {response.status_code}: "
                f"{response.text[:200]}"
            )

        # pcm_24000 returns raw 16-bit PCM at 24kHz
        audio_bytes = response.content
        audio = np.frombuffer(audio_bytes, dtype=np.int16).astype(np.float32)
        audio /= 32768.0  # normalize to [-1, 1]

        return audio, self.SAMPLE_RATE

    async def generate_quick(
        self,
        text: str,
        voice_name: str = "rachel",
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

    # Voice cloning stubs (for TTSBackend protocol compatibility)
    async def create_voice_prompt(
        self,
        audio_path: str,
        reference_text: str,
        use_cache: bool = True,
    ) -> Tuple[dict, bool]:
        return {}, False

    async def combine_voice_prompts(
        self,
        audio_paths: List[str],
        reference_texts: List[str],
    ) -> Tuple[np.ndarray, str]:
        return np.array([]), ""

    async def clone_voice_from_samples(
        self,
        name: str,
        sample_paths: list[str],
        description: str = "",
    ) -> str:
        """Clone a voice using ElevenLabs Instant Voice Cloning.

        Returns the ElevenLabs voice_id for use in generation.
        """
        import httpx

        url = f"{ELEVENLABS_BASE_URL}/voices/add"
        files = []
        for i, path in enumerate(sample_paths):
            files.append(
                ("files", (f"sample_{i}.wav", open(path, "rb"), "audio/wav"))
            )

        data = {"name": name, "description": description or f"Cloned: {name}"}

        response = httpx.post(
            url,
            data=data,
            files=files,
            headers={"xi-api-key": self._api_key},
            timeout=60.0,
        )

        # Close file handles
        for _, (_, fh, _) in files:
            fh.close()

        if response.status_code != 200:
            raise ValueError(
                f"ElevenLabs clone error {response.status_code}: "
                f"{response.text[:200]}"
            )

        result = response.json()
        voice_id = result["voice_id"]
        self._cloned_voices[name] = voice_id
        return voice_id
