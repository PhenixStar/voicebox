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
import { Footer } from '@/components/Footer';
import { BottomNav } from '@/components/BottomNav';
import { VoicesTab } from '@/components/VoicesTab/VoicesTab';
import { TranscribeTab } from '@/components/TranscribeTab/TranscribeTab';
import { useModelDownloadToast } from '@/lib/hooks/useModelDownloadToast';
import { MODEL_DISPLAY_NAMES, useRestoreActiveTasks } from '@/lib/hooks/useRestoreActiveTasks';
// TOP_NAV_HEIGHT used in TopNav.tsx; here we use md:mt-[56px] directly

// Simple platform check that works in both web and Tauri
const isMacOS = () => navigator.platform.toLowerCase().includes('mac');

// Root layout component
function RootLayout() {
  const activeDownloads = useRestoreActiveTasks();

  return (
    <AppFrame>
      <TopNav isMacOS={isMacOS()} />

      {/* md+: top margin for TopNav. mobile: no TopNav, bottom padding for BottomNav */}
      <main className="flex-1 overflow-hidden flex flex-col md:mt-[56px] pb-[60px] md:pb-0">
        <div className="container mx-auto px-4 md:px-8 max-w-[1800px] h-full overflow-hidden flex flex-col">
          <Outlet />
        </div>
      </main>

      <div className="hidden md:block">
        <Footer />
      </div>

      <BottomNav />

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

const transcribeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/transcribe',
  component: TranscribeTab,
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
  transcribeRoute,
  modelsRoute,
  serverRoute,
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
