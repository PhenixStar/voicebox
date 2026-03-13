# Phase 04 — UI/UX: Layout Centering + Dynamic Inputs

## Overview
- **Priority:** High
- **Status:** Pending
- **Effort:** S (4h)

## Key Insights

**Current layout:** `router.tsx:31` sets content container:
```tsx
<div className="container mx-auto px-8 max-w-[1800px] h-full overflow-hidden flex flex-col">
```

This is 1800px max-width with 32px padding. On smaller screens, this works. On wide screens, content is centered but internal form elements stretch full width within their cards.

**Issues reported:**
1. Generation form inputs not centered — the `GenerationForm.tsx` is a `Card` that stretches to fill container width
2. Stories inputs not dynamically sized — similar issue
3. On tablet/mobile, `px-8` is too much horizontal padding

**Fix approach:**
- Reduce max-width for form-heavy pages (Generate, Settings) to ~800px
- Keep wider max-width for grid-based pages (Models, History, Voices)
- Make padding responsive (`px-4 md:px-8`)

## Requirements

- Form-centric pages (Generate, Settings) MUST be centered with reasonable max-width (~800px)
- Grid-based pages (Models, Voices, History) can use wider layout
- All pages MUST be usable on 320px-wide screens
- Padding MUST be responsive

## Related Code Files

### Modify
- `repo/modded/app/src/router.tsx` — Adjust container max-width and padding
- `repo/modded/app/src/components/MainEditor/MainEditor.tsx` — Wrap generate section in narrower container
- `repo/modded/app/src/components/StoriesTab/StoryContent.tsx` — Improve input spacing
- `repo/modded/app/src/components/ServerTab/ServerTab.tsx` — Center settings content

### Read (for context)
- `repo/modded/app/src/components/Generation/GenerationForm.tsx`

## Implementation Steps

1. **Make root container padding responsive in `router.tsx`:**
   ```tsx
   <div className="container mx-auto px-4 md:px-8 max-w-[1800px] h-full overflow-hidden flex flex-col">
   ```

2. **Add max-width constraint to form-centric pages:**

   In `MainEditor.tsx`, wrap the generation form section:
   ```tsx
   <div className="mx-auto w-full max-w-3xl">
     <GenerationForm />
   </div>
   ```

   In `ServerTab.tsx`, add max-width:
   ```tsx
   <div className="h-full flex flex-col py-4 overflow-y-auto space-y-6 max-w-2xl mx-auto">
   ```

3. **Make GenerationForm grid responsive:**
   Current: `grid gap-4 md:grid-cols-3` — this is fine for desktop but cramped on mobile.
   Change to: `grid gap-4 sm:grid-cols-2 lg:grid-cols-3` for better intermediate sizing.

4. **Fix Stories input spacing:**
   The StoryContent uses DnD sortable list. Ensure the text input for search and the popover trigger are properly sized.

5. **Test at breakpoints:** 320px, 768px, 1024px, 1440px, 1920px

## Todo List
- [ ] Make root container padding responsive
- [ ] Add `max-w-3xl mx-auto` to GenerationForm wrapper
- [ ] Add `max-w-2xl mx-auto` to ServerTab
- [ ] Adjust grid breakpoints for form controls
- [ ] Test at all common breakpoints
- [ ] Hot-deploy frontend

## Success Criteria
- Forms are centered and readable on all screen sizes
- No horizontal overflow on mobile
- Grid layouts use appropriate column counts per breakpoint
- Consistent spacing across all pages
