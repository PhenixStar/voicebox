import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

const APP_VERSION = '0.2.0';

export function Footer() {
  const { data: health } = useQuery({
    queryKey: ['serverHealth'],
    queryFn: () => apiClient.getHealth(),
    retry: false,
    staleTime: 30000,
  });

  return (
    <footer className="border-t border-border px-4 py-1.5 flex items-center justify-between text-[11px] text-muted-foreground shrink-0 bg-background/80 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <span>The Voice v{APP_VERSION}</span>
        {health?.gpu_available && (
          <span className="hidden sm:inline opacity-60">
            GPU: {health.gpu_type ?? 'Available'}
          </span>
        )}
      </div>
      <span>
        Created by{' '}
        <a
          href="https://github.com/PhenixStar"
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent hover:underline"
        >
          phenix
        </a>
      </span>
    </footer>
  );
}
