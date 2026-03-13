"""
Task tracking for active downloads and generations with SSE support.
"""

from typing import Optional, Dict, List
from datetime import datetime
from dataclasses import dataclass, field
import asyncio
import json
import logging
import threading

logger = logging.getLogger(__name__)


@dataclass
class DownloadTask:
    """Represents an active download task."""
    model_name: str
    status: str = "downloading"
    started_at: datetime = field(default_factory=datetime.utcnow)
    error: Optional[str] = None


@dataclass
class GenerationTask:
    """Represents an active generation task."""
    task_id: str
    profile_id: str
    text_preview: str
    step: str = "queued"  # queued, loading_model, generating, encoding, complete, error
    progress: int = 0     # 0-100
    started_at: datetime = field(default_factory=datetime.utcnow)
    error: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "task_id": self.task_id,
            "profile_id": self.profile_id,
            "text_preview": self.text_preview,
            "step": self.step,
            "progress": self.progress,
            "started_at": self.started_at.isoformat(),
            "error": self.error,
        }


class TaskManager:
    """Manages active downloads and generations with SSE progress."""

    def __init__(self):
        self._active_downloads: Dict[str, DownloadTask] = {}
        self._active_generations: Dict[str, GenerationTask] = {}
        self._gen_listeners: List[asyncio.Queue] = []
        self._lock = threading.Lock()
        self._main_loop: Optional[asyncio.AbstractEventLoop] = None

    def set_main_loop(self, loop: asyncio.AbstractEventLoop):
        self._main_loop = loop

    # -- Downloads --

    def start_download(self, model_name: str) -> None:
        self._active_downloads[model_name] = DownloadTask(
            model_name=model_name, status="downloading",
        )

    def complete_download(self, model_name: str) -> None:
        if model_name in self._active_downloads:
            del self._active_downloads[model_name]

    def error_download(self, model_name: str, error: str) -> None:
        if model_name in self._active_downloads:
            self._active_downloads[model_name].status = "error"
            self._active_downloads[model_name].error = error

    # -- Generations --

    def start_generation(self, task_id: str, profile_id: str, text: str) -> None:
        text_preview = text[:50] + "..." if len(text) > 50 else text
        with self._lock:
            self._active_generations[task_id] = GenerationTask(
                task_id=task_id,
                profile_id=profile_id,
                text_preview=text_preview,
                step="queued",
                progress=0,
            )
        self._notify_gen_listeners(task_id)

    def update_generation(self, task_id: str, step: str, progress: int) -> None:
        """Update generation step and progress (0-100)."""
        with self._lock:
            if task_id in self._active_generations:
                self._active_generations[task_id].step = step
                self._active_generations[task_id].progress = min(100, max(0, progress))
        self._notify_gen_listeners(task_id)

    def complete_generation(self, task_id: str) -> None:
        with self._lock:
            if task_id in self._active_generations:
                self._active_generations[task_id].step = "complete"
                self._active_generations[task_id].progress = 100
        self._notify_gen_listeners(task_id)
        with self._lock:
            self._active_generations.pop(task_id, None)

    def error_generation(self, task_id: str, error: str) -> None:
        with self._lock:
            if task_id in self._active_generations:
                self._active_generations[task_id].step = "error"
                self._active_generations[task_id].error = error
        self._notify_gen_listeners(task_id)
        with self._lock:
            self._active_generations.pop(task_id, None)

    # -- Queries --

    def get_active_downloads(self) -> List[DownloadTask]:
        return list(self._active_downloads.values())

    def get_active_generations(self) -> List[GenerationTask]:
        with self._lock:
            return list(self._active_generations.values())

    def get_generation(self, task_id: str) -> Optional[GenerationTask]:
        with self._lock:
            return self._active_generations.get(task_id)

    def is_download_active(self, model_name: str) -> bool:
        return model_name in self._active_downloads

    def is_generation_active(self, task_id: str) -> bool:
        with self._lock:
            return task_id in self._active_generations

    # -- SSE Listener Support --

    def _notify_gen_listeners(self, task_id: str):
        """Notify all SSE listeners about generation progress."""
        with self._lock:
            task = self._active_generations.get(task_id)
            data = task.to_dict() if task else {
                "task_id": task_id, "step": "complete", "progress": 100,
            }

        for queue in list(self._gen_listeners):
            try:
                try:
                    asyncio.get_running_loop()
                    queue.put_nowait(data)
                except RuntimeError:
                    if self._main_loop and self._main_loop.is_running():
                        self._main_loop.call_soon_threadsafe(
                            lambda q=queue, d=data: q.put_nowait(d) if not q.full() else None
                        )
            except asyncio.QueueFull:
                pass
            except Exception as e:
                logger.debug(f"Error notifying gen listener: {e}")

    async def subscribe_generation_progress(self):
        """SSE generator for generation progress events."""
        queue: asyncio.Queue = asyncio.Queue(maxsize=50)
        self._gen_listeners.append(queue)
        try:
            while True:
                try:
                    data = await asyncio.wait_for(queue.get(), timeout=2.0)
                    yield f"data: {json.dumps(data)}\n\n"
                    if data.get("step") in ("complete", "error"):
                        continue  # Keep listening for more generations
                except asyncio.TimeoutError:
                    yield ": heartbeat\n\n"
        finally:
            if queue in self._gen_listeners:
                self._gen_listeners.remove(queue)


# Global instance
_task_manager: Optional[TaskManager] = None


def get_task_manager() -> TaskManager:
    global _task_manager
    if _task_manager is None:
        _task_manager = TaskManager()
    return _task_manager
