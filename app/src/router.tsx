import { createRootRoute, createRoute, createRouter, Outlet } from '@tanstack/react-router';
import { AppFrame } from '@/components/AppFrame/AppFrame';
import { AudioTab } from '@/components/AudioTab/AudioTab';
import { MainEditor } from '@/components/MainEditor/MainEditor';
import { ModelsTab } from '@/components/ModelsTab/ModelsTab';
import { ServerTab } from '@/components/ServerTab/ServerTab';
import { TopNav } from '@/components/TopNav';
import { StoriesTab } from '@/components/StoriesTab/StoriesTab';
import { HistoryPage } from '@/components/History/HistoryPage';
import { Toaster } from '@/components/ui/toaster';
import { VoicesTab } from '@/components/VoicesTab/VoicesTab';
import { useModelDownloadToast } from '@/lib/hooks/useModelDownloadToast';
import { MODEL_DISPLAY_NAMES, useRestoreActiveTasks } from '@/lib/hooks/useRestoreActiveTasks';
import { TOP_NAV_HEIGHT } from '@/lib/constants/ui';

// Simple platform check that works in both web and Tauri
const isMacOS = () => navigator.platform.toLowerCase().includes('mac');

// Root layout component
function RootLayout() {
  const activeDownloads = useRestoreActiveTasks();

  return (
    <AppFrame>
      <TopNav isMacOS={isMacOS()} />

      <main
        className="flex-1 overflow-hidden flex flex-col"
        style={{ marginTop: TOP_NAV_HEIGHT }}
      >
        <div className="container mx-auto px-8 max-w-[1800px] h-full overflow-hidden flex flex-col">
          <Outlet />
        </div>
      </main>

      {activeDownloads.map((download) => {
        const displayName = MODEL_DISPLAY_NAMES[download.model_name] || download.model_name;
        return (
          <DownloadToastRestorer
            key={download.model_name}
            modelName={download.model_name}
            displayName={displayName}
          />
        );
      })}

      <Toaster />
    </AppFrame>
  );
}

function DownloadToastRestorer({
  modelName,
  displayName,
}: {
  modelName: string;
  displayName: string;
}) {
  useModelDownloadToast({ modelName, displayName, enabled: true });
  return null;
}

// Routes
const rootRoute = createRootRoute({ component: RootLayout });

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: MainEditor,
});

const historyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/history',
  component: HistoryPage,
});

const storiesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/stories',
  component: StoriesTab,
});

const voicesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/voices',
  component: VoicesTab,
});

const audioRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/audio',
  component: AudioTab,
});

const modelsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/models',
  component: ModelsTab,
});

const serverRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/server',
  component: ServerTab,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  historyRoute,
  storiesRoute,
  voicesRoute,
  audioRoute,
  modelsRoute,
  serverRoute,
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
