import { useQuery } from '@tanstack/react-query';
import { Download, Mic, Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ProfileForm } from '@/components/VoiceProfiles/ProfileForm';
import { apiClient } from '@/lib/api/client';
import { BOTTOM_SAFE_AREA_PADDING } from '@/lib/constants/ui';
import { useHistory } from '@/lib/hooks/useHistory';
import { useProfiles } from '@/lib/hooks/useProfiles';
import { cn } from '@/lib/utils/cn';
import { usePlayerStore } from '@/stores/playerStore';
import { useUIStore } from '@/stores/uiStore';
import { BuiltinVoiceSection, VoiceCard, VoiceEmptyState } from './voice-library-cards';
import { ImportVoiceDialog } from './import-voice-dialog';

export function VoicesTab() {
  const { data: profiles, isLoading } = useProfiles();
  const { data: historyData } = useHistory({ limit: 1000 });
  const setDialogOpen = useUIStore((s) => s.setProfileDialogOpen);
  const setEditingProfileId = useUIStore((s) => s.setEditingProfileId);
  const [searchQuery, setSearchQuery] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const audioUrl = usePlayerStore((s) => s.audioUrl);
  const isPlayerVisible = !!audioUrl;

  // Fetch model status for built-in voices
  const { data: modelStatus } = useQuery({
    queryKey: ['modelStatus'],
    queryFn: () => apiClient.getModelStatus(),
  });

  // Downloaded built-in voice models (kokoro / kugelaudio / elevenlabs)
  const builtinModels = useMemo(
    () =>
      modelStatus?.models.filter(
        (m) =>
          ((m.model_name.startsWith('kokoro') || m.model_name.startsWith('kugelaudio')) &&
            m.downloaded) ||
          (m.is_cloud && m.loaded),
      ) ?? [],
    [modelStatus],
  );

  // Generation counts per profile
  const generationCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    historyData?.items?.forEach((item) => {
      counts[item.profile_id] = (counts[item.profile_id] || 0) + 1;
    });
    return counts;
  }, [historyData]);

  // Filter profiles by search query
  const filteredProfiles = useMemo(() => {
    if (!profiles) return [];
    if (!searchQuery) return profiles;
    const q = searchQuery.toLowerCase();
    return profiles.filter(
      (p) => p.name.toLowerCase().includes(q) || p.language?.toLowerCase().includes(q),
    );
  }, [profiles, searchQuery]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading voices...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col py-4 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0 mb-6">
        <div className="flex items-center gap-3">
          <Mic className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-2xl font-bold">Voice Library</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Download className="h-4 w-4 mr-2" /> Import
          </Button>
          <Button
            onClick={() => {
              setEditingProfileId(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" /> Create Voice
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative shrink-0 mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search voices..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-card border-border"
        />
      </div>

      {/* Scrollable content */}
      <div
        className={cn('flex-1 overflow-y-auto space-y-8', isPlayerVisible && BOTTOM_SAFE_AREA_PADDING)}
      >
        {/* My Voices Section */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground mb-4">
            My Voices ({filteredProfiles.length})
          </h2>
          {filteredProfiles.length === 0 ? (
            <VoiceEmptyState />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filteredProfiles.map((profile) => (
                <VoiceCard
                  key={profile.id}
                  profile={profile}
                  genCount={generationCounts[profile.id] || 0}
                />
              ))}
            </div>
          )}
        </section>

        {/* Built-in Voices Sections */}
        {builtinModels.map((model) => (
          <BuiltinVoiceSection key={model.model_name} model={model} searchQuery={searchQuery} />
        ))}
      </div>

      <ProfileForm />
      <ImportVoiceDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}
