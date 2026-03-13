# Phase 01 — Bug Fixes: Dark Mode Default + Theme Toggle

## Overview
- **Priority:** Critical
- **Status:** Pending
- **Effort:** S (2h)

## Key Insights

### Bug 1: Dark mode should be default
The store already defaults to `'dark'` in `uiStore.ts:53` and `main.tsx:9` adds `dark` class on startup. However, the initial Zustand state does NOT call `document.documentElement.classList.toggle()` on hydration — the `setTheme` action only runs when explicitly called. If localStorage has no persisted state, the CSS class is set by `main.tsx`, but the Zustand store and the CSS class can desync.

**Root cause:** Zustand store is not persisted. Every page reload resets to `'dark'` in JS state, but `main.tsx:9` also sets the class. These are redundant but fragile — if either is removed, it breaks.

### Bug 2: Theme toggle requires two clicks
The toggle in `TopNav.tsx:76` calls `setTheme(theme === 'dark' ? 'light' : 'dark')`. The `setTheme` in `uiStore.ts:54-57` does `classList.toggle('dark', theme === 'dark')`.

**Root cause:** On first page load, `main.tsx` sets `classList.add('dark')` but the Zustand store initializes `theme: 'dark'` without syncing to DOM. First click toggles store to `'light'` and sets `classList.toggle('dark', false)` — this works. But if the DOM class was already set independently by `main.tsx`, there can be a race. The real issue is likely that the `Select` component in `ServerTab.tsx:64` uses `onValueChange` which may fire differently than the button toggle.

**More likely cause:** The CSS variables in `index.css` use `:root` for light and `.dark` for dark. If Tailwind v4 `@import "tailwindcss"` processes the dark mode differently, the toggle may require two state changes. Need to verify Tailwind dark mode config.

## Requirements

- App MUST default to dark theme on first visit
- Theme preference MUST persist across page reloads (localStorage)
- Theme toggle (TopNav button) MUST work on single click
- Theme selector (Settings dropdown) MUST work on single selection change

## Related Code Files

### Modify
- `repo/modded/app/src/stores/uiStore.ts` — Add `persist` middleware, sync DOM on init
- `repo/modded/app/src/main.tsx` — Remove manual `classList.add('dark')` (store handles it)

### Read (for context)
- `repo/modded/app/src/index.css` — CSS variable definitions for `:root` and `.dark`
- `repo/modded/app/src/components/TopNav.tsx` — Theme toggle button
- `repo/modded/app/src/components/ServerTab/ServerTab.tsx` — Theme Select dropdown

## Implementation Steps

1. **Add Zustand `persist` middleware to `uiStore.ts`:**
   ```typescript
   import { create } from 'zustand';
   import { persist } from 'zustand/middleware';

   export const useUIStore = create<UIStore>()(
     persist(
       (set) => ({
         // ... existing state
         theme: 'dark',
         setTheme: (theme) => {
           set({ theme });
           document.documentElement.classList.toggle('dark', theme === 'dark');
         },
       }),
       {
         name: 'voicebox-ui',
         partialize: (state) => ({ theme: state.theme }),
         onRehydrateStorage: () => (state) => {
           if (state) {
             document.documentElement.classList.toggle('dark', state.theme === 'dark');
           }
         },
       },
     ),
   );
   ```

2. **Remove manual dark class from `main.tsx`:**
   Remove line 9: `document.documentElement.classList.add('dark');`
   The store's `onRehydrateStorage` callback handles this now.

3. **Verify `index.css` has proper `.dark` selector:**
   Confirm CSS variables under `.dark { }` selector match Tailwind v4 expectations.

4. **Test:**
   - Fresh visit (no localStorage) → dark theme
   - Click toggle once → light theme immediately
   - Click toggle again → dark theme immediately
   - Reload page → persisted theme applied
   - Settings dropdown → single selection change applies theme

## Todo List
- [ ] Add `persist` middleware to `uiStore` with `theme` partialize
- [ ] Add `onRehydrateStorage` to sync DOM class on page load
- [ ] Remove `document.documentElement.classList.add('dark')` from `main.tsx`
- [ ] Test toggle button in TopNav (single click)
- [ ] Test Select dropdown in ServerTab (single selection)
- [ ] Test persistence across reload
- [ ] Hot-deploy frontend build to Docker container

## Success Criteria
- Dark theme on first visit without localStorage
- Single-click theme toggle works
- Theme persists across page reloads
- No flash of wrong theme on page load

## Risk Assessment
- **Low risk:** Zustand `persist` middleware is well-tested and included in the zustand package
- **Potential issue:** If `zustand/middleware` is not installed — verify it's bundled with zustand (it is since v4)
