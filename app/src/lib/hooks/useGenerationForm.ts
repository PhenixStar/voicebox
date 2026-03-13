import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { useToast } from '@/components/ui/use-toast';
import { apiClient } from '@/lib/api/client';
import { LANGUAGE_CODES, type LanguageCode } from '@/lib/constants/languages';
import { useGeneration } from '@/lib/hooks/useGeneration';
import { useModelDownloadToast } from '@/lib/hooks/useModelDownloadToast';
import { useGenerationStore } from '@/stores/generationStore';
import { usePlayerStore } from '@/stores/playerStore';

const generationSchema = z.object({
  text: z.string().min(1, 'Text is required').max(5000),
  language: z.enum(LANGUAGE_CODES as [LanguageCode, ...LanguageCode[]]),
  seed: z.number().int().optional(),
  modelSize: z.enum(['1.7B', '0.6B']).optional(),
  modelName: z.string().optional(),
  voiceName: z.string().optional(),
  instruct: z.string().max(500).optional(),
});

export type GenerationFormValues = z.infer<typeof generationSchema>;

// Models that use built-in voices (no profile needed)
export const BUILTIN_VOICE_MODELS = ['kokoro-82M', 'kugelaudio-7B'] as const;

// Check if a model uses built-in voices
export function isBuiltinVoiceModel(modelName?: string): boolean {
  return BUILTIN_VOICE_MODELS.includes(modelName as (typeof BUILTIN_VOICE_MODELS)[number]);
}

interface UseGenerationFormOptions {
  onSuccess?: (generationId: string) => void;
  defaultValues?: Partial<GenerationFormValues>;
}

export function useGenerationForm(options: UseGenerationFormOptions = {}) {
  const { toast } = useToast();
  const generation = useGeneration();
  const setAudioWithAutoPlay = usePlayerStore((state) => state.setAudioWithAutoPlay);
  const setIsGenerating = useGenerationStore((state) => state.setIsGenerating);
  const [downloadingModelName, setDownloadingModelName] = useState<string | null>(null);
  const [downloadingDisplayName, setDownloadingDisplayName] = useState<string | null>(null);

  useModelDownloadToast({
    modelName: downloadingModelName || '',
    displayName: downloadingDisplayName || '',
    enabled: !!downloadingModelName,
  });

  const form = useForm<GenerationFormValues>({
    resolver: zodResolver(generationSchema),
    defaultValues: {
      text: '',
      language: 'en',
      seed: undefined,
      modelSize: '1.7B',
      modelName: 'qwen-tts-1.7B',
      voiceName: undefined,
      instruct: '',
      ...options.defaultValues,
    },
  });

  async function handleSubmit(
    data: GenerationFormValues,
    selectedProfileId: string | null,
  ): Promise<void> {
    const useBuiltinVoice = isBuiltinVoiceModel(data.modelName);

    // Qwen models require a profile with samples
    if (!useBuiltinVoice && !selectedProfileId) {
      toast({
        title: 'No profile selected',
        description: 'Qwen TTS requires a voice profile. Select one above or use Kokoro/KugelAudio for built-in voices.',
        variant: 'destructive',
      });
      return;
    }

    // Built-in voice models require a voice selection
    if (useBuiltinVoice && !data.voiceName) {
      toast({
        title: 'No voice selected',
        description: 'Please select a built-in voice for this model.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsGenerating(true);

      const modelName = data.modelName || `qwen-tts-${data.modelSize}`;
      const displayName = modelName;

      // Check if model is downloaded
      try {
        const modelStatus = await apiClient.getModelStatus();
        const model = modelStatus.models.find((m) => m.model_name === modelName);
        if (model && !model.downloaded) {
          setDownloadingModelName(modelName);
          setDownloadingDisplayName(displayName);
        }
      } catch (error) {
        console.error('Failed to check model status:', error);
      }

      const result = await generation.mutateAsync({
        profile_id: useBuiltinVoice ? undefined : selectedProfileId!,
        text: data.text,
        language: data.language as LanguageCode,
        seed: data.seed,
        model_size: useBuiltinVoice ? undefined : data.modelSize,
        model_name: data.modelName,
        voice_name: useBuiltinVoice ? data.voiceName : undefined,
        instruct: data.instruct || undefined,
      });

      toast({
        title: 'Generation complete!',
        description: `Audio generated (${result.duration.toFixed(2)}s)`,
      });

      const audioUrl = apiClient.getAudioUrl(result.id);
      setAudioWithAutoPlay(audioUrl, result.id, selectedProfileId || '', data.text.substring(0, 50));

      form.reset();
      options.onSuccess?.(result.id);
    } catch (error) {
      toast({
        title: 'Generation failed',
        description: error instanceof Error ? error.message : 'Failed to generate audio',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
      setDownloadingModelName(null);
      setDownloadingDisplayName(null);
    }
  }

  return {
    form,
    handleSubmit,
    isPending: generation.isPending,
  };
}
