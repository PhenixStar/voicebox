import { Link, useMatchRoute } from '@tanstack/react-router';
import { BookOpen, Box, Clock, Loader2, Mic, Moon, Pin, PinOff, Settings, Speaker, Sun, Volume2 } from 'lucide-react';
import voiceboxLogo from '@/assets/voicebox-logo.png';
import { cn } from '@/lib/utils/cn';
import { SIDEBAR_COLLAPSED_WIDTH, SIDEBAR_EXPANDED_WIDTH } from '@/lib/constants/ui';
import { useGenerationStore } from '@/stores/generationStore';
import { usePlayerStore } from '@/stores/playerStore';
import { useUIStore } from '@/stores/uiStore';
import { usePlatform } from '@/platform/PlatformContext';

const topTabs = [
  { id: 'main', path: '/', icon: Volume2, label: 'Generate' },
  { id: 'history', path: '/history', icon: Clock, label: 'History' },
  { id: 'voices', path: '/voices', icon: Mic, label: 'Voices' },
  { id: 'stories', path: '/stories', icon: BookOpen, label: 'Stories' },
];

const bottomTabs = [
  { id: 'models', path: '/models', icon: Box, label: 'Models' },
  { id: 'audio', path: '/audio', icon: Speaker, label: 'Audio', tauriOnly: true },
  { id: 'server', path: '/server', icon: Settings, label: 'Settings' },
];

interface SidebarProps {
  isMacOS?: boolean;
}

export function Sidebar({ isMacOS }: SidebarProps) {
  const isGenerating = useGenerationStore((state) => state.isGenerating);
  const audioUrl = usePlayerStore((state) => state.audioUrl);
  const isPlayerVisible = !!audioUrl;
  const matchRoute = useMatchRoute();
  const platform = usePlatform();

  const expanded = useUIStore((state) => state.sidebarExpanded);
  const setExpanded = useUIStore((state) => state.setSidebarExpanded);
  const pinned = useUIStore((state) => state.sidebarPinned);
  const setPinned = useUIStore((state) => state.setSidebarPinned);
  const theme = useUIStore((state) => state.theme);
  const setTheme = useUIStore((state) => state.setTheme);

  const width = expanded ? SIDEBAR_EXPANDED_WIDTH : SIDEBAR_COLLAPSED_WIDTH;

  const handleMouseEnter = () => {
    if (!pinned) setExpanded(true);
  };
  const handleMouseLeave = () => {
    if (!pinned) setExpanded(false);
  };

  const filteredBottomTabs = bottomTabs.filter(
    (tab) => !tab.tauriOnly || platform.metadata.isTauri,
  );

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ width }}
      className={cn(
        'fixed left-0 top-0 h-full bg-sidebar border-r border-border flex flex-col py-4 z-40',
        'transition-all duration-200 ease-out overflow-hidden',
        isMacOS && 'pt-14',
      )}
    >
      {/* Logo */}
      <div className={cn('flex items-center gap-3 mb-6', expanded ? 'px-4' : 'justify-center px-0')}>
        <img src={voiceboxLogo} alt="Voicebox" className="w-8 h-8 object-contain shrink-0" />
        <span
          className={cn(
            'font-semibold text-sm text-foreground whitespace-nowrap transition-opacity duration-200',
            expanded ? 'opacity-100' : 'opacity-0 w-0',
          )}
        >
          Voicebox
        </span>
      </div>

      {/* Top navigation */}
      <nav className="flex flex-col gap-1 px-2">
        {topTabs.map((tab) => (
          <NavItem key={tab.id} tab={tab} expanded={expanded} matchRoute={matchRoute} />
        ))}
      </nav>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Generation loader */}
      {isGenerating && (
        <div className={cn('flex items-center justify-center py-3', isPlayerVisible && 'mb-24')}>
          <Loader2 className="h-5 w-5 text-accent animate-spin" />
          {expanded && <span className="ml-2 text-xs text-muted-foreground">Generating...</span>}
        </div>
      )}

      {/* Bottom navigation */}
      <nav className="flex flex-col gap-1 px-2">
        {filteredBottomTabs.map((tab) => (
          <NavItem key={tab.id} tab={tab} expanded={expanded} matchRoute={matchRoute} />
        ))}
      </nav>

      {/* Theme toggle */}
      <button
        type="button"
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        className={cn(
          'flex items-center gap-2 py-2 mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors',
          expanded ? 'px-4' : 'justify-center px-0',
        )}
        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {theme === 'dark' ? <Sun className="h-3.5 w-3.5 shrink-0" /> : <Moon className="h-3.5 w-3.5 shrink-0" />}
        {expanded && <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>}
      </button>

      {/* Pin toggle — only visible when expanded */}
      {expanded && (
        <button
          type="button"
          onClick={() => setPinned(!pinned)}
          className="flex items-center gap-2 px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          title={pinned ? 'Unpin sidebar' : 'Pin sidebar open'}
        >
          {pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
          <span>{pinned ? 'Unpin' : 'Pin open'}</span>
        </button>
      )}
    </div>
  );
}

interface NavItemProps {
  tab: { id: string; path: string; icon: React.ComponentType<{ className?: string }>; label: string };
  expanded: boolean;
  matchRoute: ReturnType<typeof useMatchRoute>;
}

function NavItem({ tab, expanded, matchRoute }: NavItemProps) {
  const Icon = tab.icon;
  const isActive = tab.path === '/'
    ? matchRoute({ to: '/' })
    : matchRoute({ to: tab.path });

  return (
    <Link
      to={tab.path}
      className={cn(
        'flex items-center gap-3 rounded-lg transition-all duration-150 group relative',
        expanded ? 'px-3 py-2.5' : 'justify-center px-0 py-2.5',
        isActive
          ? 'bg-accent/10 text-foreground'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
      )}
      title={!expanded ? tab.label : undefined}
    >
      {/* Active indicator */}
      {isActive && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-accent rounded-r-full" />
      )}

      <Icon className={cn('h-[18px] w-[18px] shrink-0', expanded ? '' : 'mx-auto')} />

      <span
        className={cn(
          'text-sm whitespace-nowrap transition-opacity duration-200',
          expanded ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden',
        )}
      >
        {tab.label}
      </span>
    </Link>
  );
}
