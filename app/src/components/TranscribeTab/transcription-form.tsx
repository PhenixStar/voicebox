import { useMutation } from '@tanstack/react-query';
import { Link2, Loader2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { apiClient } from '@/lib/api/client';
import { LANGUAGE_OPTIONS } from '@/lib/constants/languages';
import type { DiarizedTranscriptionResponse } from '@/lib/api/types';

type InputMode = 'url' | 'file';

const MODEL_SIZE_OPTIONS = [
  { value: 'tiny', label: 'Tiny (fastest)' },
  { value: 'base', label: 'Base' },
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large-v3', label: 'Large v3 (best)' },
];

interface TranscriptionFormProps {
  onResult: (result: DiarizedTranscriptionResponse) => void;
}

export function TranscriptionForm({ onResult }: TranscriptionFormProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [inputMode, setInputMode] = useState<InputMode>('url');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [language, setLanguage] = useState('auto');
  const [modelSize, setModelSize] = useState('base');
  const [diarize, setDiarize] = useState(false);

  function onSuccess(data: DiarizedTranscriptionResponse) {
    onResult(data);
    toast({ title: 'Transcription complete', description: `Duration: ${data.duration.toFixed(1)}s` });
  }

  function onError(error: Error) {
    toast({ title: 'Transcription failed', description: error.message, variant: 'destructive' });
  }

  const transcribeFile = useMutation({
    mutationFn: () => apiClient.transcribeFile(file!, language, diarize, modelSize),
    onSuccess,
    onError,
  });

  const transcribeUrl = useMutation({
    mutationFn: () => apiClient.transcribeUrl(url, language, diarize, modelSize),
    onSuccess,
    onError,
  });

  const isPending = transcribeFile.isPending || transcribeUrl.isPending;
  const canSubmit = (inputMode === 'url' ? url.trim() : !!file) && !isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (inputMode === 'url') transcribeUrl.mutate();
    else transcribeFile.mutate();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
      {/* Input mode toggle */}
      <div className="flex gap-2">
        <Button
          type="button"
          variant={inputMode === 'url' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setInputMode('url')}
          className="flex-1"
        >
          <Link2 className="h-3.5 w-3.5 mr-1.5" />
          From URL
        </Button>
        <Button
          type="button"
          variant={inputMode === 'file' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setInputMode('file')}
          className="flex-1"
        >
          <Upload className="h-3.5 w-3.5 mr-1.5" />
          From File
        </Button>
      </div>

      {/* URL or File input */}
      {inputMode === 'url' ? (
        <Input
          placeholder="Paste YouTube or audio URL..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={isPending}
        />
      ) : (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".mp4,.webm,.mkv,.mp3,.wav,.ogg,.flac,.m4a,.avi,.mov"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start text-muted-foreground"
            onClick={() => fileInputRef.current?.click()}
            disabled={isPending}
          >
            <Upload className="h-4 w-4 mr-2" />
            {file ? file.name : 'Choose audio or video file...'}
          </Button>
        </div>
      )}

      {/* Options row */}
      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-[140px]">
          <Label className="text-xs text-muted-foreground mb-1 block">Language</Label>
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto-detect</SelectItem>
              {LANGUAGE_OPTIONS.map((l) => (
                <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 min-w-[140px]">
          <Label className="text-xs text-muted-foreground mb-1 block">Model</Label>
          <Select value={modelSize} onValueChange={setModelSize}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODEL_SIZE_OPTIONS.map((m) => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end pb-1">
          <div className="flex items-center gap-2">
            <Checkbox id="diarize" checked={diarize} onCheckedChange={(checked) => setDiarize(checked)} />
            <Label htmlFor="diarize" className="text-sm cursor-pointer">Speaker Detection</Label>
          </div>
        </div>
      </div>

      {/* Submit */}
      <Button type="submit" disabled={!canSubmit} className="w-full">
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Transcribing...
          </>
        ) : (
          'Transcribe'
        )}
      </Button>
    </form>
  );
}
