# Phase 03 — Transcription Tab Frontend

## Overview
- **Priority**: High
- **Status**: Pending
- **Effort**: M (8h)

## Architecture

New route `/transcribe` → `TranscribeTab` component with:
1. **Input section**: URL input OR file upload (drag-drop) + language selector + diarize toggle
2. **Progress**: SSE or polling for long transcriptions
3. **Results section**: Full transcript with speaker labels, segment timeline, copy/export buttons
4. **Speaker view**: Color-coded speaker labels, segment-by-segment timeline

## Related Code Files
- **Create**: `app/src/components/TranscribeTab/TranscribeTab.tsx`
- **Create**: `app/src/components/TranscribeTab/transcription-results.tsx`
- **Create**: `app/src/components/TranscribeTab/speaker-segment.tsx`
- **Modify**: `app/src/router.tsx` (add `/transcribe` route)
- **Modify**: `app/src/components/TopNav.tsx` (add Transcribe tab)
- **Modify**: `app/src/components/BottomNav.tsx` (add Transcribe tab)
- **Modify**: `app/src/lib/api/client.ts` (add transcription API methods)
- **Modify**: `app/src/lib/api/types.ts` (add transcription types)

## UI Design

### Input Area
- Toggle: "URL" | "File Upload"
- URL input with placeholder "Paste YouTube/audio URL..."
- File drop zone accepting video/audio
- Language auto-detect checkbox + manual override dropdown
- "Enable Speaker Detection" toggle
- Submit button with progress indicator

### Results View
- Full transcript in editable textarea
- Per-segment view: `[00:00 - 00:05] SPEAKER_00: "Hello there..."`
- Speaker summary: "2 speakers detected"
- Export buttons: TXT, SRT, JSON
- "Create Voice Profile" button per speaker (links to voice import flow)

## Implementation Steps

1. Create `TranscribeTab.tsx` with URL/file input + options
2. Add API client methods for `/transcribe/file` and `/transcribe/url`
3. Create `transcription-results.tsx` for displaying segmented results
4. Create `speaker-segment.tsx` for individual speaker segment rendering
5. Add route to `router.tsx`
6. Add to `TopNav.tsx` and `BottomNav.tsx` navigation
7. Add TypeScript types for transcription response
