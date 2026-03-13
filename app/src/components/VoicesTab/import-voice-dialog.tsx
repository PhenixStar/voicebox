import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link2, Loader2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
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

interface ImportVoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ImportMode = 'url' | 'file';

export function ImportVoiceDialog({ open, onOpenChange }: ImportVoiceDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<ImportMode>('url');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [language, setLanguage] = useState('en');
  const [clipDuration, setClipDuration] = useState(15);

  const importFromUrl = useMutation({
    mutationFn: () =>
      apiClient.importProfileFromUrl({
        url,
        name,
        language,
        clip_duration: clipDuration,
      }),
    onSuccess: (data) => {
      toast({
        title: 'Voice imported!',
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      resetForm();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: 'Import failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const importFromFile = useMutation({
    mutationFn: () =>
      apiClient.importProfileFromFile(file!, name, language, undefined, 0, clipDuration),
    onSuccess: (data) => {
      toast({
        title: 'Voice imported!',
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      resetForm();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: 'Import failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const isPending = importFromUrl.isPending || importFromFile.isPending;
  const canSubmit = name.trim() && (mode === 'url' ? url.trim() : !!file) && !isPending;

  function resetForm() {
    setUrl('');
    setFile(null);
    setName('');
    setLanguage('en');
    setClipDuration(15);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === 'url') {
      importFromUrl.mutate();
    } else {
      importFromFile.mutate();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import Voice</DialogTitle>
          <DialogDescription>
            Create a voice profile from a video URL or audio file.
            Audio will be extracted, transcribed, and used as a voice sample.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Mode Toggle */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant={mode === 'url' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('url')}
              className="flex-1"
            >
              <Link2 className="h-3.5 w-3.5 mr-1.5" />
              From URL
            </Button>
            <Button
              type="button"
              variant={mode === 'file' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('file')}
              className="flex-1"
            >
              <Upload className="h-3.5 w-3.5 mr-1.5" />
              From File
            </Button>
          </div>

          {/* URL or File input */}
          {mode === 'url' ? (
            <Input
              placeholder="https://youtube.com/watch?v=... or any video/audio URL"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={isPending}
            />
          ) : (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".mp4,.webm,.mkv,.mp3,.wav,.ogg,.flac,.m4a,.avi"
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
                {file ? file.name : 'Choose video or audio file...'}
              </Button>
            </div>
          )}

          {/* Voice name */}
          <Input
            placeholder="Voice name (e.g. Morgan Freeman)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isPending}
          />

          {/* Language + Duration */}
          <div className="flex gap-3">
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGE_OPTIONS.map((l) => (
                  <SelectItem key={l.value} value={l.value}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2 w-32">
              <Input
                type="number"
                min={3}
                max={30}
                value={clipDuration}
                onChange={(e) => setClipDuration(Number(e.target.value))}
                className="w-16"
                disabled={isPending}
              />
              <span className="text-xs text-muted-foreground">sec</span>
            </div>
          </div>

          {/* Submit */}
          <Button type="submit" disabled={!canSubmit} className="w-full">
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Importing... (this may take a minute)
              </>
            ) : (
              'Import Voice'
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
