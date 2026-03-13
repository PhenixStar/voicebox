import { Settings } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConnectionForm } from '@/components/ServerSettings/ConnectionForm';
import { ServerStatus } from '@/components/ServerSettings/ServerStatus';
import { UpdateStatus } from '@/components/ServerSettings/UpdateStatus';
import { ApiKeysCard } from '@/components/ServerTab/ApiKeysCard';
import { GenerationDefaultsCard } from '@/components/ServerTab/GenerationDefaultsCard';
import { usePlatform } from '@/platform/PlatformContext';
import { useUIStore } from '@/stores/uiStore';
import { usePlayerStore } from '@/stores/playerStore';
import { cn } from '@/lib/utils/cn';

export function ServerTab() {
  const platform = usePlatform();
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
  const audioUrl = usePlayerStore((s) => s.audioUrl);
  const isPlayerVisible = !!audioUrl;

  return (
    <div
      className={cn(
        'h-full flex flex-col py-4 overflow-y-auto space-y-6 max-w-2xl mx-auto w-full',
        isPlayerVisible && 'pb-32',
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3 shrink-0">
        <Settings className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Settings</h1>
      </div>

      {/* Server Connection */}
      <ConnectionForm />

      {/* Server Status */}
      <ServerStatus />

      {/* Appearance */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Appearance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Theme</p>
              <p className="text-xs text-muted-foreground">Choose dark or light mode</p>
            </div>
            <Select value={theme} onValueChange={(v) => setTheme(v as 'dark' | 'light')}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="light">Light</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* API Keys */}
      <ApiKeysCard />

      {/* Generation Defaults */}
      <GenerationDefaultsCard />

      {/* Update (Tauri only) */}
      {platform.metadata.isTauri && <UpdateStatus />}
    </div>
  );
}
