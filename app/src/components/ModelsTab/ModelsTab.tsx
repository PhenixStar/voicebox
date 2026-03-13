import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Box, Download, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { useCallback, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { apiClient } from '@/lib/api/client';
import type { ModelStatus } from '@/lib/api/types';
import { useModelDownloadToast } from '@/lib/hooks/useModelDownloadToast';
import { usePlayerStore } from '@/stores/playerStore';
import { cn } from '@/lib/utils/cn';

export function ModelsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [downloadingModel, setDownloadingModel] = useState<string | null>(null);
  const [downloadingDisplayName, setDownloadingDisplayName] = useState<string | null>(null);
  const audioUrl = usePlayerStore((s) => s.audioUrl);
  const isPlayerVisible = !!audioUrl;

  const { data: modelStatus, isLoading } = useQuery({
    queryKey: ['modelStatus'],
    queryFn: () => apiClient.getModelStatus(),
    refetchInterval: 5000,
  });

  // Download completion handler
  const handleDownloadComplete = useCallback(() => {
    setDownloadingModel(null);
    setDownloadingDisplayName(null);
    queryClient.invalidateQueries({ queryKey: ['modelStatus'] });
  }, [queryClient]);

  const handleDownloadError = useCallback(() => {
    setDownloadingModel(null);
    setDownloadingDisplayName(null);
  }, []);

  // SSE progress toast for active download
  useModelDownloadToast({
    modelName: downloadingModel || '',
    displayName: downloadingDisplayName || '',
    enabled: !!downloadingModel && !!downloadingDisplayName,
    onComplete: handleDownloadComplete,
    onError: handleDownloadError,
  });

  // Delete confirmation state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [modelToDelete, setModelToDelete] = useState<{
    name: string;
    displayName: string;
    sizeMb?: number;
  } | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (modelName: string) => apiClient.deleteModel(modelName),
    onSuccess: () => {
      toast({ title: 'Model deleted', description: `${modelToDelete?.displayName || 'Model'} removed.` });
      setDeleteDialogOpen(false);
      setModelToDelete(null);
      queryClient.invalidateQueries({ queryKey: ['modelStatus'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
    },
  });

  const handleDownload = async (modelName: string) => {
    const model = modelStatus?.models.find((m) => m.model_name === modelName);
    const displayName = model?.display_name || modelName;
    try {
      await apiClient.triggerModelDownload(modelName);
      setDownloadingModel(modelName);
      setDownloadingDisplayName(displayName);
      queryClient.invalidateQueries({ queryKey: ['modelStatus'] });
    } catch (error) {
      toast({
        title: 'Download failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const openDeleteDialog = (model: ModelStatus) => {
    setModelToDelete({ name: model.model_name, displayName: model.display_name, sizeMb: model.size_mb });
    setDeleteDialogOpen(true);
  };

  // Group models by category
  const ttsModels =
    modelStatus?.models.filter(
      (m) =>
        m.model_name.startsWith('qwen-tts') ||
        m.model_name.startsWith('kokoro') ||
        m.model_name.startsWith('kugelaudio'),
    ) ?? [];
  const sttModels = modelStatus?.models.filter((m) => m.model_name.startsWith('whisper')) ?? [];

  return (
    <div className="h-full flex flex-col py-4 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0 mb-6">
        <div className="flex items-center gap-3">
          <Box className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-2xl font-bold">Models</h1>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => queryClient.invalidateQueries({ queryKey: ['modelStatus'] })}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className={cn('flex-1 overflow-y-auto space-y-8', isPlayerVisible && 'pb-32')}>
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Voice Generation Models */}
            {ttsModels.length > 0 && (
              <ModelSection title="Voice Generation">
                {ttsModels.map((model) => (
                  <ModelCard
                    key={model.model_name}
                    model={model}
                    isDownloading={downloadingModel === model.model_name}
                    onDownload={() => handleDownload(model.model_name)}
                    onDelete={() => openDeleteDialog(model)}
                  />
                ))}
              </ModelSection>
            )}

            {/* Transcription Models */}
            {sttModels.length > 0 && (
              <ModelSection title="Transcription">
                {sttModels.map((model) => (
                  <ModelCard
                    key={model.model_name}
                    model={model}
                    isDownloading={downloadingModel === model.model_name}
                    onDownload={() => handleDownload(model.model_name)}
                    onDelete={() => openDeleteDialog(model)}
                  />
                ))}
              </ModelSection>
            )}
          </>
        )}
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Model</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{modelToDelete?.displayName}</strong>?
              {modelToDelete?.sizeMb && (
                <> This will free up {formatSize(modelToDelete.sizeMb)} of disk space.</>
              )}{' '}
              You will need to re-download it to use it again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => modelToDelete && deleteMutation.mutate(modelToDelete.name)}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ---- Sub-components ---- */

function ModelSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-sm font-semibold text-muted-foreground mb-4">{title}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
    </section>
  );
}

function ModelCard({
  model,
  isDownloading,
  onDownload,
  onDelete,
}: {
  model: ModelStatus;
  isDownloading: boolean;
  onDownload: () => void;
  onDelete: () => void;
}) {
  const showDownloading = model.downloading || isDownloading;
  const isLocal = model.is_local;

  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-medium text-sm truncate">{model.display_name}</h3>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            {model.size_mb != null && model.size_mb > 0 && (
              <span className="text-xs text-muted-foreground">{formatSize(model.size_mb)}</span>
            )}
            <StatusBadge
              loaded={model.loaded}
              downloaded={model.downloaded}
              downloading={showDownloading}
              isLocal={!!isLocal}
            />
          </div>
        </div>

        <div className="flex gap-2 shrink-0">
          {showDownloading ? (
            <Button size="sm" variant="outline" disabled>
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
              {isLocal ? 'Loading...' : 'Downloading...'}
            </Button>
          ) : model.downloaded ? (
            isLocal && !model.loaded ? (
              <Button size="sm" variant="outline" onClick={onDownload} title="Load model into GPU">
                <Download className="h-4 w-4 mr-1" />
                Load
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={onDelete}
                disabled={model.loaded && !isLocal}
                title={
                  model.loaded && !isLocal
                    ? 'Unload model before deleting'
                    : isLocal && model.loaded
                      ? 'Unload'
                      : 'Delete'
                }
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )
          ) : (
            <Button size="sm" variant="outline" onClick={onDownload}>
              <Download className="h-4 w-4 mr-1" />
              Download
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({
  loaded,
  downloaded,
  downloading,
  isLocal,
}: {
  loaded: boolean;
  downloaded: boolean;
  downloading: boolean;
  isLocal: boolean;
}) {
  if (loaded) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-green-500">
        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
        Loaded
      </span>
    );
  }
  if (downloading) {
    return <span className="text-xs text-muted-foreground">In progress...</span>;
  }
  if (downloaded) {
    return (
      <span className="text-xs text-muted-foreground">{isLocal ? 'Local' : 'Ready'}</span>
    );
  }
  return <span className="text-xs text-muted-foreground">Not downloaded</span>;
}

function formatSize(sizeMb?: number): string {
  if (!sizeMb) return '';
  if (sizeMb < 1024) return `${sizeMb.toFixed(0)} MB`;
  return `${(sizeMb / 1024).toFixed(1)} GB`;
}
