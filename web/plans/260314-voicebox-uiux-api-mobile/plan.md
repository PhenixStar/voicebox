# Voicebox UI/UX, API, Mobile & Feature Expansion Plan

## Context

Post ElevenLabs v2 integration. voice.nulled.ai is live with 5 TTS backends. User testing revealed 8 categories of issues ranging from bugs to missing features.

## Phases

| Phase | Title | Priority | Status | Effort |
|-------|-------|----------|--------|--------|
| 01 | [Bug Fixes — Dark Mode + Theme Toggle](phase-01-bug-fixes-dark-theme.md) | Critical | Done | S (2h) |
| 02 | [Bug Fixes — KugelAudio Meta Tensor](phase-02-bug-fix-kugelaudio.md) | Critical | Done | S (3h) |
| 03 | [Bug Fixes — Model Buttons Stale State](phase-03-bug-fix-model-buttons.md) | High | Done | S (2h) |
| 04 | [UI/UX — Layout Centering + Dynamic Inputs](phase-04-uiux-layout-centering.md) | High | Done | S (4h) |
| 05 | [Settings Page Expansion](phase-05-settings-expansion.md) | High | Done | M (8h) |
| 06 | [Mobile-First Responsive Redesign](phase-06-mobile-first.md) | Medium | Done | M (12h) |
| 07 | [REST API v1 + Auth](phase-07-rest-api-auth.md) | Medium | Done | M (10h) |
| 08 | [MCP Server](phase-08-mcp-server.md) | Medium | Done | M (16h) |
| 09 | [MVP Features — ElevenLabs Parity](phase-09-mvp-features.md) | Low | Done (9A+9B+9C+9D) | L (30h) |

## Dependencies

```
Phase 01, 02, 03 → independent (bugs, do first)
Phase 04 → independent
Phase 05 → independent (but feeds into Phase 06)
Phase 06 → after Phase 04
Phase 07 → after Phase 05 (needs settings for API key config)
Phase 08 → after Phase 07 (MCP wraps REST API)
Phase 09 → after Phase 07
```

## Key Files

- Frontend: `repo/modded/app/src/`
- Backend: `repo/modded/backend/`
- Docker: `docker-compose.yml`, `Dockerfile`
- Stores: `stores/uiStore.ts`, `stores/serverStore.ts`
- Router: `router.tsx`
- Models UI: `components/ModelsTab/ModelsTab.tsx`
- Generation: `components/Generation/GenerationForm.tsx`
- Settings: `components/ServerTab/ServerTab.tsx`
- KugelAudio: `backend/backends/kugelaudio_backend.py`
