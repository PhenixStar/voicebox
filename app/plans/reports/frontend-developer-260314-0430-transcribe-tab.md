## Frontend Implementation -- Transcribe Tab (2026-03-14)

### Summary
- Framework: React 18 + TypeScript
- Key Components: TranscribeTab, TranscriptionForm, TranscriptionResults
- Responsive Behaviour: yes (mobile-first, player-aware padding, flex-wrap options row)
- Accessibility: semantic form, labeled inputs, checkbox with htmlFor, button states

### Files Created / Modified
| File | Purpose |
|------|---------|
| src/components/TranscribeTab/TranscribeTab.tsx (new, 36 lines) | Main tab shell -- header + scrollable area + results |
| src/components/TranscribeTab/transcription-form.tsx (new, 181 lines) | URL/file input, language/model/diarize options, submit mutation |
| src/components/TranscribeTab/transcription-results.tsx (new, 156 lines) | Full-text + segments tabs, speaker color-coding, copy/TXT/SRT export |
| src/router.tsx (modified) | Added /transcribe route with TranscribeTab component |
| src/components/TopNav.tsx (modified) | Added Transcribe tab (FileText icon) before Models |
| src/components/BottomNav.tsx (modified) | Added Transcribe tab (FileText icon) before Models |
| src/lib/api/client.ts (modified) | Added transcribeFile() and transcribeUrl() methods |
| src/lib/api/types.ts (modified) | Added TranscriptionSegment and DiarizedTranscriptionResponse types |

### Details
- Input mode toggle: URL (paste YouTube/audio link) or File (audio/video file picker)
- Options: language select (auto-detect + all supported), model size (tiny -> large-v3), speaker detection checkbox
- Results: summary bar (duration, language, speaker count), tabbed view (Full Text textarea + Segments list with color-coded speakers)
- Export: Copy to clipboard, download TXT, download SRT (with speaker labels)
- Uses useMutation from TanStack Query for both transcription endpoints
- Player-aware bottom padding via BOTTOM_SAFE_AREA_PADDING
- All files under 200 lines

### Build Verification
- Vite build: passed (5.56s, 2616 modules)
- TypeScript: no new errors introduced (pre-existing errors in unrelated files)

### Next Steps
- [ ] Backend endpoints (POST /transcribe/file, POST /transcribe/url) implementation
- [ ] UX review with real transcription data
- [ ] Consider adding progress/streaming for long transcriptions
