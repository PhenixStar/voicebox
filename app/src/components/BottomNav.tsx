import { Link, useMatchRoute } from '@tanstack/react-router';
import { BookOpen, Box, Clock, FileText, Mic, Settings, Volume2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

const tabs = [
  { path: '/', icon: Volume2, label: 'Generate' },
  { path: '/history', icon: Clock, label: 'History' },
  { path: '/voices', icon: Mic, label: 'Voices' },
  { path: '/stories', icon: BookOpen, label: 'Stories' },
  { path: '/transcribe', icon: FileText, label: 'Transcribe' },
  { path: '/models', icon: Box, label: 'Models' },
  { path: '/server', icon: Settings, label: 'Settings' },
];

/** Mobile-only bottom navigation bar (visible below md breakpoint) */
export function BottomNav() {
  const matchRoute = useMatchRoute();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-sidebar border-t border-border md:hidden safe-area-bottom">
      <div className="flex items-stretch justify-around">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive =
            tab.path === '/' ? matchRoute({ to: '/' }) : matchRoute({ to: tab.path });

          return (
            <Link
              key={tab.path}
              to={tab.path}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 py-2 px-1 min-w-[56px] min-h-[52px] transition-colors',
                isActive
                  ? 'text-accent'
                  : 'text-muted-foreground active:text-foreground',
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] leading-tight">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
