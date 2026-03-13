"""Task management routes."""

from fastapi import APIRouter
from datetime import datetime

from .. import models
from ..utils.progress import get_progress_manager
from ..utils.tasks import get_task_manager

router = APIRouter(tags=["tasks"])


@router.get("/tasks/active", response_model=models.ActiveTasksResponse)
async def get_active_tasks():
    """Return all currently active downloads and generations."""
    task_manager = get_task_manager()
    progress_manager = get_progress_manager()

    # Get active downloads from both task manager and progress manager
    active_downloads = []
    task_manager_downloads = task_manager.get_active_downloads()
    progress_active = progress_manager.get_all_active()

    # Combine data from both sources
    download_map = {task.model_name: task for task in task_manager_downloads}
    progress_map = {p["model_name"]: p for p in progress_active}

    all_model_names = set(download_map.keys()) | set(progress_map.keys())
    for model_name in all_model_names:
        task = download_map.get(model_name)
        progress = progress_map.get(model_name)

        if task:
            active_downloads.append(models.ActiveDownloadTask(
                model_name=model_name,
                status=task.status,
                started_at=task.started_at,
            ))
        elif progress:
            timestamp_str = progress.get("timestamp")
            if timestamp_str:
                try:
                    started_at = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
                except (ValueError, AttributeError):
                    started_at = datetime.utcnow()
            else:
                started_at = datetime.utcnow()

            active_downloads.append(models.ActiveDownloadTask(
                model_name=model_name,
                status=progress.get("status", "downloading"),
                started_at=started_at,
            ))

    # Get active generations
    active_generations = []
    for gen_task in task_manager.get_active_generations():
        active_generations.append(models.ActiveGenerationTask(
            task_id=gen_task.task_id,
            profile_id=gen_task.profile_id,
            text_preview=gen_task.text_preview,
            started_at=gen_task.started_at,
        ))

    return models.ActiveTasksResponse(
        downloads=active_downloads,
        generations=active_generations,
    )
