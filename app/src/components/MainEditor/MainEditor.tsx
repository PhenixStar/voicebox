import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, Play, SlidersHorizontal, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
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
import { useProfiles } from '@/lib/hooks/useProfiles';
import { useHistory } from '@/lib/hooks/useHistory';
import { useUIStore } from '@/stores/uiStore';
import { usePlayerStore } from '@/stores/playerStore';
import type { HistoryResponse } from '@/lib/api/types';

export function MainEditor() {
  const selectedProfileId = useUIStore((s) => s.selectedProfileId);
  const setSelectedProfileId = useUIStore((s) => s.setSelectedProfileId);
  const setAudioWithAutoPlay = usePlayerStore((s) => s.setAudioWithAutoPlay);
  const { data: profiles } = useProfiles();
  const { data: recentHistory } = useHistory({ limit: 5 });
  const [isInstructMode, setIsInstructMode] = useState(false);

  const { form, handleSubmit, isPending } = useGenerationForm();

  const watchedModelName = form.watch('modelName');
  const watchedText = form.watch('text') || '';
  const useBuiltinVoice = isBuiltinVoiceModel(watchedModelName);

  // Fetch TTS models
  const { data: modelStatus } = useQuery({
    queryKey: ['modelStatus'],
    queryFn: () => apiClient.getModelStatus(),
    refetchInterval: 10000,
  });
  const ttsModels = modelStatus?.models.filter(
    (m) =>
      m.model_name.startsWith('qwen-tts') ||
      BUILTIN_VOICE_MODELS.includes(m.model_name as (typeof BUILTIN_VOICE_MODELS)[number]),
  ) ?? [];

  // Fetch voices for built-in voice models
  const { data: availableVoices } = useQuery({
    queryKey: ['voices', watchedModelName],
    queryFn: () => apiClient.getModelVoices(watchedModelName!),
    enabled: useBuiltinVoice && !!watchedModelName,
  });

  // Generate button guard: built-in voice needs voice selected, Qwen needs profile
  const canGenerate = useBuiltinVoice
    ? !!form.watch('voiceName')
    : !!selectedProfileId;

  // Set first profile as default when none selected
  useEffect(() => {
    if (!selectedProfileId && profiles && profiles.length > 0) {
      setSelectedProfileId(profiles[0].id);
    }
  }, [selectedProfileId, profiles, setSelectedProfileId]);

  async function onSubmit(data: Parameters<typeof handleSubmit>[0]) {
    await handleSubmit(data, selectedProfileId);
  }

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto py-6 gap-6 overflow-y-auto">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6 flex-1 min-h-0">
          {/* Model Bar */}
          <div className="flex items-center gap-3 shrink-0">
            <FormField
              control={form.control}
              name="modelName"
              render={({ field }) => (
                <FormItem className="flex-1 space-y-0">
                  <Select
                    value={field.value}
                    onValueChange={(val) => {
                      field.onChange(val);
                      if (val === 'qwen-tts-1.7B') form.setValue('modelSize', '1.7B');
                      else if (val === 'qwen-tts-0.6B') form.setValue('modelSize', '0.6B');
                      form.setValue('voiceName', undefined);
                    }}
                  >
                    <FormControl>
                      <SelectTrigger className="h-10 bg-card border-border rounded-xl">
                        <SelectValue placeholder="Select model" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ttsModels.map((m) => (
                        <SelectItem
                          key={m.model_name}
                          value={m.model_name}
                          disabled={!m.downloaded}
                          className="text-sm"
                        >
                          {m.display_name}
                          {!m.downloaded && ' (not downloaded)'}
                          {m.loaded && ' (active)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="language"
              render={({ field }) => (
                <FormItem className="w-[180px] space-y-0">
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-10 bg-card border-border rounded-xl">
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
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />
          </div>

          {/* Text Input Area */}
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="bg-card rounded-xl border border-border p-4 flex flex-col">
              <FormField
                control={form.control}
                name="text"
                render={({ field }) => (
                  <FormItem className="flex-1 space-y-0">
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Type or paste your text here..."
                        className="resize-none bg-transparent border-none focus-visible:ring-0 focus-visible:ring-offset-0 text-base min-h-[200px] max-h-[400px]"
                      />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />
              <div className="flex justify-between items-center text-xs text-muted-foreground mt-2">
                <span>{watchedText.length} characters</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsInstructMode(!isInstructMode)}
                  className={isInstructMode ? 'text-accent' : 'text-muted-foreground'}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5 mr-1" />
                  Instruct
                </Button>
              </div>
            </div>
          </div>

          {/* Voice Bar */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Voice Picker: unified dropdown for built-in voices or profiles */}
            {useBuiltinVoice ? (
              <FormField
                control={form.control}
                name="voiceName"
                render={({ field }) => (
                  <FormItem className="flex-1 space-y-0">
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-11 bg-card border-border rounded-xl">
                          <SelectValue placeholder="Select a voice..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectGroup>
                          <SelectLabel>Built-in Voices</SelectLabel>
                          {(availableVoices ?? []).map((voice) => (
                            <SelectItem key={voice} value={voice}>
                              {voice}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />
            ) : (
              <div className="flex-1">
                <Select
                  value={selectedProfileId || ''}
                  onValueChange={(value) => setSelectedProfileId(value || null)}
                >
                  <SelectTrigger className="h-11 bg-card border-border rounded-xl">
                    <SelectValue placeholder="Select a voice profile..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Voice Profiles</SelectLabel>
                      {profiles?.map((profile) => (
                        <SelectItem key={profile.id} value={profile.id}>
                          {profile.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Generate Button */}
            <Button
              type="submit"
              disabled={isPending || !canGenerate}
              className="h-11 px-8 rounded-full bg-accent hover:bg-accent/90 text-accent-foreground font-medium shadow-lg"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate
                </>
              )}
            </Button>
          </div>

          {/* Expandable Instruct Panel */}
          <AnimatePresence>
            {isInstructMode && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden shrink-0"
              >
                <div className="bg-card rounded-xl border border-border p-4 flex flex-col gap-3">
                  <FormField
                    control={form.control}
                    name="instruct"
                    render={({ field }) => (
                      <FormItem className="space-y-1">
                        <FormLabel className="text-xs font-medium text-muted-foreground">
                          Voice Instructions
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder="e.g. speak slowly with a warm, friendly tone"
                            className="resize-none bg-transparent border border-border rounded-lg focus-visible:ring-1 min-h-[60px] max-h-[120px] text-sm"
                          />
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="seed"
                    render={({ field }) => (
                      <FormItem className="space-y-1">
                        <FormLabel className="text-xs font-medium text-muted-foreground">
                          Seed (optional)
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="Random seed for reproducibility"
                            value={field.value ?? ''}
                            onChange={(e) =>
                              field.onChange(e.target.value ? Number(e.target.value) : undefined)
                            }
                            className="h-9 bg-transparent border border-border rounded-lg text-sm"
                          />
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </form>
      </Form>

      {/* Recent Generations */}
      <div className="shrink-0 pb-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-medium text-muted-foreground">Recent Generations</h3>
          <Link to="/history" className="text-xs text-accent hover:underline">
            View All
          </Link>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {recentHistory?.items?.length === 0 && (
            <p className="text-xs text-muted-foreground">No generations yet. Create your first one above.</p>
          )}
          {recentHistory?.items?.slice(0, 5).map((gen) => (
            <RecentCard key={gen.id} generation={gen} onPlay={setAudioWithAutoPlay} />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Compact card for recent generation entries */
function RecentCard({
  generation,
  onPlay,
}: {
  generation: HistoryResponse;
  onPlay: (url: string, id: string, profileId: string | null, title?: string) => void;
}) {
  const audioUrl = apiClient.getAudioUrl(generation.id);
  const durationStr = generation.duration >= 60
    ? `${Math.floor(generation.duration / 60)}m ${(generation.duration % 60).toFixed(0)}s`
    : `${generation.duration.toFixed(1)}s`;

  return (
    <button
      type="button"
      onClick={() =>
        onPlay(audioUrl, generation.id, generation.profile_id, generation.text?.substring(0, 50))
      }
      className="shrink-0 w-[200px] bg-card rounded-lg border border-border p-3 hover:bg-muted/50 transition text-left"
    >
      <p className="text-xs truncate">{generation.text?.substring(0, 60) || 'Untitled'}</p>
      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
        <Play className="h-3 w-3" />
        <span>{durationStr}</span>
        {generation.profile_name && (
          <span className="truncate ml-auto">{generation.profile_name}</span>
        )}
      </div>
    </button>
  );
}
