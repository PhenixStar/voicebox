import { usePlatform } from '@/platform/PlatformContext';

export function TitleBarDragRegion() {
  const platform = usePlatform();

  // Only render the drag region on Tauri — on web it blocks TopNav clicks
  if (!platform.metadata.isTauri) {
    return null;
  }

  return (
    <div
      data-tauri-drag-region
      className="fixed top-0 left-0 right-0 h-12 z-[9999]"
    />
  );
}
