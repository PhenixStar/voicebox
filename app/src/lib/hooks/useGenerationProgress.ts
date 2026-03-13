import { useEffect, useRef, useState } from 'react';
import { useServerStore } from '@/stores/serverStore';

export interface GenerationProgress {
  task_id: string;
  step: string;      // queued | loading_model | generating | encoding | complete | error
  progress: number;  // 0-100
  error?: string;
}

const STEP_LABELS: Record<string, string> = {
  queued: 'Queued...',
  loading_model: 'Loading model...',
  generating: 'Generating audio...',
  encoding: 'Encoding...',
  complete: 'Complete',
  error: 'Error',
};

export function getStepLabel(step: string): string {
  return STEP_LABELS[step] || step;
}

/**
 * Subscribe to real-time generation progress via SSE.
 * Connects when `enabled` is true, disconnects on unmount or when disabled.
 */
export function useGenerationProgress(enabled: boolean) {
  const [progress, setProgress] = useState<GenerationProgress | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!enabled) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setProgress(null);
      return;
    }

    const serverUrl = useServerStore.getState().serverUrl;
    const es = new EventSource(`${serverUrl}/generate/progress`);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data: GenerationProgress = JSON.parse(event.data);
        setProgress(data);
      } catch {
        // Ignore parse errors (heartbeats, etc.)
      }
    };

    es.onerror = () => {
      // EventSource auto-reconnects; just clear stale progress
      setProgress(null);
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [enabled]);

  return progress;
}
