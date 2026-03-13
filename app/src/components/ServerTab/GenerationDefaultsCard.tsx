import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SlidersHorizontal } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

const AUDIO_FORMATS = [
  { value: 'wav', label: 'WAV (lossless)' },
  { value: 'mp3', label: 'MP3' },
  { value: 'ogg', label: 'OGG Vorbis' },
];

export function GenerationDefaultsCard() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => apiClient.listSettings(),
  });

  const { data: modelStatus } = useQuery({
    queryKey: ['modelStatus'],
    queryFn: () => apiClient.getModelStatus(),
  });

  const ttsModels = modelStatus?.models.filter((m) => m.model_type === 'tts') ?? [];

  const updateMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) =>
      apiClient.updateSetting(key, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
    onError: (err: Error) => {
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' });
    },
  });

  const getValue = (key: string): string => {
    return settings?.find((s) => s.key === key)?.value ?? '';
  };

  const handleChange = (key: string, value: string) => {
    updateMutation.mutate({ key, value });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4" />
          Generation Defaults
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Default Model */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Default Model</p>
            <p className="text-xs text-muted-foreground">Used when creating new generations</p>
          </div>
          <Select value={getValue('default_model')} onValueChange={(v) => handleChange('default_model', v)}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select model" />
            </SelectTrigger>
            <SelectContent>
              {ttsModels.map((m) => (
                <SelectItem key={m.model_name} value={m.model_name}>
                  {m.display_name}
                  {m.is_cloud && ' \u2601'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Default Language */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Default Language</p>
            <p className="text-xs text-muted-foreground">Pre-selected language for new text</p>
          </div>
          <Select value={getValue('default_language')} onValueChange={(v) => handleChange('default_language', v)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGE_OPTIONS.map((lang) => (
                <SelectItem key={lang.value} value={lang.value}>
                  {lang.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Default Audio Format */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Audio Format</p>
            <p className="text-xs text-muted-foreground">Output format for generated audio</p>
          </div>
          <Select value={getValue('default_audio_format')} onValueChange={(v) => handleChange('default_audio_format', v)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AUDIO_FORMATS.map((fmt) => (
                <SelectItem key={fmt.value} value={fmt.value}>
                  {fmt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
