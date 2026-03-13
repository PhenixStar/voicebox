import { useQuery } from '@tanstack/react-query';
import { Loader2, Mic } from 'lucide-react';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { LANGUAGE_OPTIONS } from '@/lib/constants/languages';
import { apiClient } from '@/lib/api/client';
import {
  useGenerationForm,
  isBuiltinVoiceModel,
  BUILTIN_VOICE_MODELS,
} from '@/lib/hooks/useGenerationForm';
import { useProfile } from '@/lib/hooks/useProfiles';
import { useUIStore } from '@/stores/uiStore';

export function GenerationForm() {
  const selectedProfileId = useUIStore((state) => state.selectedProfileId);
  const { data: selectedProfile } = useProfile(selectedProfileId || '');

  const { form, handleSubmit, isPending } = useGenerationForm();
  const watchedModelName = form.watch('modelName');
  const useBuiltinVoice = isBuiltinVoiceModel(watchedModelName);

  // Fetch available TTS models from API
  const { data: modelStatus } = useQuery({
    queryKey: ['modelStatus'],
    queryFn: () => apiClient.getModelStatus(),
    refetchInterval: 10000,
  });

  // Fetch built-in voices when a built-in voice model is selected
  const { data: availableVoices } = useQuery({
    queryKey: ['voices', watchedModelName],
    queryFn: () => apiClient.getModelVoices(watchedModelName!),
    enabled: useBuiltinVoice && !!watchedModelName,
  });

  // Reset voice selection when model changes
  useEffect(() => {
    form.setValue('voiceName', undefined);
  }, [watchedModelName, form]);

  // Build model options from API status
  const ttsModels = modelStatus?.models.filter(
    (m) =>
      m.model_type === 'tts' &&
      (m.model_name.startsWith('qwen-tts') ||
        BUILTIN_VOICE_MODELS.includes(m.model_name as (typeof BUILTIN_VOICE_MODELS)[number])),
  ) ?? [];

  async function onSubmit(data: Parameters<typeof handleSubmit>[0]) {
    await handleSubmit(data, selectedProfileId);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Generate Speech</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Voice Profile — only needed for Qwen (voice-cloning) */}
            {!useBuiltinVoice && (
              <div>
                <FormLabel>Voice Profile</FormLabel>
                {selectedProfile ? (
                  <div className="mt-2 p-3 border rounded-md bg-muted/50 flex items-center gap-2">
                    <Mic className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{selectedProfile.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {selectedProfile.language}
                    </span>
                  </div>
                ) : (
                  <div className="mt-2 p-3 border border-dashed rounded-md text-sm text-muted-foreground">
                    Click on a profile card above to select a voice profile
                  </div>
                )}
              </div>
            )}

            <FormField
              control={form.control}
              name="text"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Text to Speak</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter the text you want to generate..."
                      className="min-h-[150px]"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>Max 5000 characters</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="instruct"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Delivery Instructions (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="e.g. Speak slowly with emphasis, Warm and friendly tone..."
                      className="min-h-[80px]"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Natural language instructions for speech delivery. Max 500 characters
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 md:grid-cols-3">
              {/* Language */}
              <FormField
                control={form.control}
                name="language"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Language</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {LANGUAGE_OPTIONS.map((lang) => (
                          <SelectItem key={lang.value} value={lang.value}>
                            {lang.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Model Selector */}
              <FormField
                control={form.control}
                name="modelName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Model</FormLabel>
                    <Select
                      onValueChange={(val) => {
                        field.onChange(val);
                        // Sync modelSize for Qwen models
                        if (val === 'qwen-tts-1.7B') form.setValue('modelSize', '1.7B');
                        else if (val === 'qwen-tts-0.6B') form.setValue('modelSize', '0.6B');
                      }}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select model" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {ttsModels.map((m) => (
                          <SelectItem
                            key={m.model_name}
                            value={m.model_name}
                            disabled={!m.downloaded && !m.is_cloud}
                          >
                            {m.display_name}
                            {m.is_cloud && ' ☁'}
                            {!m.downloaded && !m.is_cloud && ' (not downloaded)'}
                            {m.is_local && m.downloaded && !m.loaded && ' (ready)'}
                            {m.loaded && !m.is_cloud && ' ✓'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {useBuiltinVoice
                        ? 'Uses built-in voices (no profile needed)'
                        : 'Voice-cloning from profile samples'}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Voice selector for built-in voice models */}
              {useBuiltinVoice ? (
                <FormField
                  control={form.control}
                  name="voiceName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Voice</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select voice" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(availableVoices ?? []).map((voice) => (
                            <SelectItem key={voice} value={voice}>
                              {voice}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        {availableVoices
                          ? `${availableVoices.length} voices available`
                          : 'Loading voices...'}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : (
                /* Seed for Qwen models */
                <FormField
                  control={form.control}
                  name="seed"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Seed (optional)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="Random"
                          {...field}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value ? parseInt(e.target.value, 10) : undefined,
                            )
                          }
                        />
                      </FormControl>
                      <FormDescription>For reproducible results</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isPending || (!useBuiltinVoice && !selectedProfileId)}
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                'Generate Speech'
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
