import { useState, useMemo } from 'react';
import { Edit, Mic, MoreHorizontal, Play, Trash2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { apiClient } from '@/lib/api/client';
import type { VoiceProfileResponse, ModelStatus } from '@/lib/api/types';
import { useDeleteProfile, useProfileSamples } from '@/lib/hooks/useProfiles';
import { usePlayerStore } from '@/stores/playerStore';
import { useUIStore } from '@/stores/uiStore';

// -- VoiceCard: card for user-created voice profiles --

interface VoiceCardProps {
  profile: VoiceProfileResponse;
  genCount: number;
}

export function VoiceCard({ profile, genCount }: VoiceCardProps) {
  const { data: samples } = useProfileSamples(profile.id);
  const setEditingProfileId = useUIStore((s) => s.setEditingProfileId);
  const setDialogOpen = useUIStore((s) => s.setProfileDialogOpen);
  const deleteProfile = useDeleteProfile();
  const setAudioWithAutoPlay = usePlayerStore((s) => s.setAudioWithAutoPlay);

  // Deterministic hue from name for avatar background
  const hue = profile.name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;

  const handlePreview = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (samples && samples.length > 0) {
      const sampleUrl = apiClient.getSampleUrl(samples[0].id);
      setAudioWithAutoPlay(sampleUrl, `sample-${samples[0].id}`, profile.id, `${profile.name} sample`);
    }
  };

  const openEdit = () => {
    setEditingProfileId(profile.id);
    setDialogOpen(true);
  };

  return (
    <div
      onClick={openEdit}
      className="bg-card rounded-xl border border-border p-4 cursor-pointer hover:border-accent/30 hover:bg-muted/30 transition-all group"
    >
      {/* Avatar */}
      <div
        className="h-10 w-10 rounded-lg flex items-center justify-center mb-3"
        style={{ backgroundColor: `hsl(${hue} 40% 25%)` }}
      >
        <Mic className="h-5 w-5 text-white/80" />
      </div>

      {/* Name */}
      <h3 className="font-medium text-sm truncate">{profile.name}</h3>

      {/* Meta */}
      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
        <span className="uppercase">{profile.language || 'EN'}</span>
        <span>-</span>
        <span>{samples?.length ?? 0} samples</span>
      </div>
      <div className="text-xs text-muted-foreground mt-0.5">{genCount} generations</div>

      {/* Actions row (visible on hover) */}
      <div className="flex items-center gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0"
          onClick={handlePreview}
          disabled={!samples || samples.length === 0}
          title="Preview"
        >
          <Play className="h-3.5 w-3.5" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                openEdit();
              }}
            >
              <Edit className="h-4 w-4 mr-2" /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                deleteProfile.mutate(profile.id);
              }}
              className="text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

// -- BuiltinVoiceSection: expandable section for a downloaded model's voices --

interface BuiltinVoiceSectionProps {
  model: ModelStatus;
  searchQuery: string;
}

export function BuiltinVoiceSection({ model, searchQuery }: BuiltinVoiceSectionProps) {
  const [showAll, setShowAll] = useState(false);

  const { data: voices } = useQuery({
    queryKey: ['voices', model.model_name],
    queryFn: () => apiClient.getModelVoices(model.model_name),
  });

  const filteredVoices = useMemo(() => {
    if (!voices) return [];
    if (!searchQuery) return voices;
    const q = searchQuery.toLowerCase();
    return voices.filter((v) => v.toLowerCase().includes(q));
  }, [voices, searchQuery]);

  const displayVoices = showAll ? filteredVoices : filteredVoices.slice(0, 12);
  const hasMore = filteredVoices.length > 12;

  if (filteredVoices.length === 0 && searchQuery) return null;

  return (
    <section>
      <h2 className="text-sm font-semibold text-muted-foreground mb-4">
        {model.display_name} ({filteredVoices.length} voices)
        {model.loaded && <span className="ml-2 text-green-500 text-xs">Loaded</span>}
      </h2>
      <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2">
        {displayVoices.map((voice) => (
          <div
            key={voice}
            className="bg-card rounded-lg border border-border p-3 text-center hover:border-accent/30 transition"
          >
            <p className="text-xs font-medium truncate" title={voice}>
              {voice}
            </p>
          </div>
        ))}
      </div>
      {hasMore && !showAll && (
        <Button variant="ghost" size="sm" className="mt-3 text-xs" onClick={() => setShowAll(true)}>
          Show all {filteredVoices.length} voices
        </Button>
      )}
    </section>
  );
}

// -- EmptyState: shown when user has no voice profiles --

export function VoiceEmptyState() {
  const setDialogOpen = useUIStore((s) => s.setProfileDialogOpen);

  return (
    <div className="text-center py-12 text-muted-foreground">
      <Mic className="h-12 w-12 mx-auto mb-4 opacity-30" />
      <p className="text-sm">No voice profiles yet</p>
      <Button variant="outline" size="sm" className="mt-3" onClick={() => setDialogOpen(true)}>
        Create your first voice
      </Button>
    </div>
  );
}
