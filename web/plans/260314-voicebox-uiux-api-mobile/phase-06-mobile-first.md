# Phase 06 — Mobile-First Responsive Redesign

## Overview
- **Priority:** Medium
- **Status:** Pending
- **Effort:** M (12h)
- **Depends on:** Phase 04 (layout centering)

## Key Insights

Current UI was designed desktop-first. TopNav horizontal tabs overflow on narrow screens. Forms don't adapt to touch. No PWA manifest for "Add to Home Screen".

**Mobile pain points:**
- TopNav tabs overflow with hidden text (`hidden md:inline`) — icons only on mobile but no labels makes navigation confusing
- 8px padding is too much on small screens
- Form inputs too small for touch targets (44px minimum recommended)
- No bottom navigation (standard mobile pattern)
- Audio player not optimized for mobile
- No PWA manifest or service worker

## Requirements

- App MUST be fully usable on 320px screens
- Touch targets MUST be at least 44px
- Navigation MUST be intuitive on mobile (bottom nav or hamburger)
- PWA manifest for "Add to Home Screen" functionality
- Quick Generate mode: one-screen flow for the most common action

## Related Code Files

### Modify
- `repo/modded/app/src/components/TopNav.tsx` — Responsive navigation
- `repo/modded/app/src/router.tsx` — Container padding adjustments
- `repo/modded/app/src/components/Generation/GenerationForm.tsx` — Touch-friendly inputs
- `repo/modded/app/src/index.css` — Mobile typography/spacing

### Create
- `repo/modded/app/public/manifest.json` — PWA manifest
- `repo/modded/app/src/components/BottomNav.tsx` — Mobile bottom navigation
- `repo/modded/app/src/components/QuickGenerate/QuickGenerate.tsx` — Simplified mobile generate view

## Implementation Steps

1. **Bottom navigation for mobile:**
   Show TopNav on `md:` and above, show BottomNav on mobile. BottomNav has 5 icons with labels (Generate, History, Voices, Stories, Models).

2. **PWA manifest:**
   ```json
   {
     "name": "The Voice",
     "short_name": "Voice",
     "start_url": "/",
     "display": "standalone",
     "background_color": "#0a0a0a",
     "theme_color": "#0a0a0a",
     "icons": [...]
   }
   ```

3. **Touch-friendly form controls:**
   - Min height 44px on all inputs/buttons
   - Larger text areas on mobile
   - Full-width selects

4. **Quick Generate route (`/quick`):**
   Single-screen: text input + voice dropdown + generate button + auto-play result. No sidebar, no profile selection needed (uses default or last-used voice).

5. **Responsive grid adjustments:**
   - Models: 1 col on mobile, 2 on tablet, 3 on desktop
   - History: stack cards vertically on mobile
   - Voices: 1 col on mobile, 2-3 on desktop

## Todo List
- [ ] Create BottomNav component
- [ ] Show/hide TopNav vs BottomNav based on breakpoint
- [ ] Create PWA manifest with icons
- [ ] Add viewport meta tag if missing
- [ ] Increase touch target sizes (44px minimum)
- [ ] Create QuickGenerate route
- [ ] Adjust responsive grid breakpoints
- [ ] Test on actual mobile device or Chrome DevTools
- [ ] Hot-deploy

## Success Criteria
- Navigation works intuitively on 320px screens
- All buttons/inputs are easily tappable
- PWA installable from mobile browser
- Quick Generate mode works end-to-end on mobile

## Risk Assessment
- **Medium:** Bottom nav + top nav coexistence requires careful z-index and spacing management
- **Low:** PWA manifest is additive, no breaking changes
