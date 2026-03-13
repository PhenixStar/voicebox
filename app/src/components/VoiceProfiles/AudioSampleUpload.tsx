import { CheckCircle, Loader2, Upload, XCircle } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormControl, FormItem, FormMessage } from '@/components/ui/form';

interface AudioSampleUploadProps {
  file: File | null | undefined;
  onFileChange: (file: File | undefined) => void;
  onTranscribe: () => void;
  onPlayPause: () => void;
  isPlaying: boolean;
  isValidating?: boolean;
  isTranscribing?: boolean;
  isDisabled?: boolean;
  fieldName: string;
  /** Optional batch upload handler — when provided, shows multi-file UI */
  onBatchUpload?: (files: File[]) => Promise<BatchResult[]>;
}

export interface BatchResult {
  file: File;
  status: 'success' | 'error';
  message?: string;
}

export function AudioSampleUpload({
  file,
  onFileChange,
  onTranscribe,
  onPlayPause,
  isPlaying,
  isValidating = false,
  isTranscribing = false,
  isDisabled = false,
  fieldName,
  onBatchUpload,
}: AudioSampleUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [batchFiles, setBatchFiles] = useState<File[]>([]);
  const [batchResults, setBatchResults] = useState<BatchResult[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleMultiFileSelect = (files: FileList) => {
    const audioFiles = Array.from(files).filter((f) => f.type.startsWith('audio/'));
    if (audioFiles.length === 0) return;

    if (audioFiles.length === 1 && !onBatchUpload) {
      onFileChange(audioFiles[0]);
      return;
    }

    if (onBatchUpload && audioFiles.length > 0) {
      setBatchFiles(audioFiles);
      setBatchResults([]);
    } else {
      onFileChange(audioFiles[0]);
    }
  };

  const handleBatchUpload = async () => {
    if (!onBatchUpload || batchFiles.length === 0) return;
    setIsUploading(true);
    try {
      const results = await onBatchUpload(batchFiles);
      setBatchResults(results);
    } finally {
      setIsUploading(false);
    }
  };

  const clearBatch = () => {
    setBatchFiles([]);
    setBatchResults([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Batch mode UI
  if (onBatchUpload && batchFiles.length > 0) {
    return (
      <FormItem>
        <FormControl>
          <div className="flex flex-col gap-3 p-4 border-2 rounded-lg border-primary bg-primary/5">
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm">{batchFiles.length} file(s) selected</span>
              <Button type="button" variant="ghost" size="sm" onClick={clearBatch}>
                Clear
              </Button>
            </div>

            <div className="max-h-[200px] overflow-y-auto space-y-1">
              {batchFiles.map((f, i) => {
                const result = batchResults.find((r) => r.file === f);
                return (
                  <div key={`${f.name}-${i}`} className="flex items-center gap-2 text-xs py-1">
                    {result ? (
                      result.status === 'success' ? (
                        <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                      )
                    ) : isUploading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />
                    ) : (
                      <div className="h-3.5 w-3.5 rounded-full border border-muted-foreground/30 shrink-0" />
                    )}
                    <span className="truncate flex-1">{f.name}</span>
                    {result?.status === 'error' && (
                      <span className="text-red-400 truncate max-w-[120px]">{result.message}</span>
                    )}
                  </div>
                );
              })}
            </div>

            {batchResults.length === 0 && (
              <Button
                type="button"
                onClick={handleBatchUpload}
                disabled={isUploading}
                className="w-full"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Uploading...
                  </>
                ) : (
                  `Upload ${batchFiles.length} files`
                )}
              </Button>
            )}

            {batchResults.length > 0 && (
              <div className="text-xs text-muted-foreground">
                {batchResults.filter((r) => r.status === 'success').length} succeeded,{' '}
                {batchResults.filter((r) => r.status === 'error').length} failed
              </div>
            )}
          </div>
        </FormControl>
        <FormMessage />
      </FormItem>
    );
  }

  // Single file mode UI (original behavior)
  return (
    <FormItem>
      <FormControl>
        <div className="flex flex-col gap-2">
          <input
            type="file"
            accept="audio/*"
            multiple={!!onBatchUpload}
            name={fieldName}
            ref={fileInputRef}
            onChange={(e) => {
              const files = e.target.files;
              if (files && files.length > 0) {
                handleMultiFileSelect(files);
              } else {
                onFileChange(undefined);
              }
            }}
            className="hidden"
          />
          <div
            role="button"
            tabIndex={0}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setIsDragging(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const droppedFiles = e.dataTransfer.files;
              if (droppedFiles.length > 0) {
                handleMultiFileSelect(droppedFiles);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            className={`flex flex-col items-center justify-center gap-4 p-4 border-2 rounded-lg transition-colors min-h-[180px] ${
              file
                ? 'border-primary bg-primary/5'
                : isDragging
                  ? 'border-primary bg-primary/5'
                  : 'border-dashed border-muted-foreground/25 hover:border-muted-foreground/50'
            }`}
          >
            {!file ? (
              <>
                <Button
                  type="button"
                  size="lg"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2"
                >
                  <Upload className="h-5 w-5" />
                  Choose File{onBatchUpload ? '(s)' : ''}
                </Button>
                <p className="text-sm text-muted-foreground text-center">
                  {onBatchUpload
                    ? 'Select one or more audio files, or drag and drop. Max 30s each.'
                    : 'Click to choose a file or drag and drop. Maximum duration: 30 seconds.'}
                </p>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <Upload className="h-5 w-5 text-primary" />
                  <span className="font-medium">File uploaded</span>
                </div>
                <p className="text-sm text-muted-foreground text-center">File: {file.name}</p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={onPlayPause}
                    disabled={isValidating}
                  >
                    {isPlaying ? 'Pause' : 'Play'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onTranscribe}
                    disabled={isTranscribing || isValidating || isDisabled}
                  >
                    {isTranscribing ? 'Transcribing...' : 'Transcribe'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      onFileChange(undefined);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                  >
                    Remove
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </FormControl>
      <FormMessage />
    </FormItem>
  );
}
