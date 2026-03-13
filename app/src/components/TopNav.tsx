import { Link, useMatchRoute } from '@tanstack/react-router';
import { BookOpen, Box, Clock, Mic, Moon, Settings, Sun, Volume2 } from 'lucide-react';
import voiceboxLogo from '@/assets/voicebox-logo.png';
import { cn } from '@/lib/utils/cn';
import { TOP_NAV_HEIGHT } from '@/lib/constants/ui';
import { useUIStore } from '@/stores/uiStore';
import { usePlatform } from '@/platform/PlatformContext';

const tabs = [
  { id: 'main', path: '/', icon: Volume2, label: 'Generate' },
  { id: 'history', path: '/history', icon: Clock, label: 'History' },
  { id: 'voices', path: '/voices', icon: Mic, label: 'Voices' },
  { id: 'stories', path: '/stories', icon: BookOpen, label: 'Stories' },
  { id: 'models', path: '/models', icon: Box, label: 'Models' },
];

interface TopNavProps {
  isMacOS?: boolean;
}

export function TopNav({ isMacOS }: TopNavProps) {
  const matchRoute = useMatchRoute();
  const platform = usePlatform();
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);

  return (
    <header
      style={{ height: TOP_NAV_HEIGHT }}
      className={cn(
        'fixed top-0 left-0 right-0 z-40 bg-sidebar border-b border-border',
        'flex items-center px-4 gap-2',
        isMacOS && 'pl-20',
      )}
    >
      {/* Logo */}
      <Link to="/" className="flex items-center gap-2 mr-4 shrink-0">
        <img src={voiceboxLogo} alt="The Voice" className="w-7 h-7 object-contain" />
        <span className="font-semibold text-sm text-foreground hidden sm:inline">The Voice</span>
      </Link>

      {/* Center tabs */}
      <nav className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.path === '/'
            ? matchRoute({ to: '/' })
            : matchRoute({ to: tab.path });

          return (
            <Link
              key={tab.id}
              to={tab.path}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors',
                isActive
                  ? 'bg-accent/15 text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="hidden md:inline">{tab.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right actions */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Theme toggle */}
        <button
          type="button"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        {/* Settings */}
        <Link
          to="/server"
          className={cn(
            'p-2 rounded-lg transition-colors',
            matchRoute({ to: '/server' })
              ? 'text-foreground bg-accent/15'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
          )}
          title="Settings"
        >
          <Settings className="h-4 w-4" />
        </Link>
      </div>
    </header>
  );
}
