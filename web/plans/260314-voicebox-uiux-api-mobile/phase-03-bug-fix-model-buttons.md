# Phase 03 — Bug Fix: Model Buttons Stale State

## Overview
- **Priority:** High
- **Status:** Pending
- **Effort:** S (2h)

## Key Insights

**Symptoms:**
1. Load button clicked → nothing visible happens (no spinner, no feedback)
2. After failed load, button reverts to "Download" instead of "Load"
3. Buttons don't show loading state during load/download operations

**Root cause analysis in `ModelsTab.tsx`:**

The `handleDownload` function (line 78-93) calls `apiClient.triggerModelDownload()` and then sets `downloadingModel` state. But for **local models** (Kokoro, KugelAudio), the backend returns immediately with success/failure — there's no SSE progress stream. The `useModelDownloadToast` hook only works for HF models with SSE progress.

For local models, the flow is:
1. Click "Load" → `handleDownload()` calls API
2. API endpoint `trigger_model_download` (line 330-342 of `model_management.py`) calls `backend.load_model()` synchronously (via `await`)
3. If it fails, the error is thrown as HTTPException
4. Frontend `handleDownload` catches the error and shows toast, but `downloadingModel` was already set
5. The `handleDownloadError` clears `downloadingModel`, but the UI flashes incorrectly

**Additional issue:** The `ModelCard` component decides which button to show based on `model.downloaded` and `model.loaded` from the server response. After a failed load, the model status may not refresh fast enough (5-second poll interval), causing the button to show "Download" instead of "Load".

## Requirements

- Clicking Load/Download MUST show immediate visual feedback (spinner)
- Failed operations MUST keep the correct button state (Load vs Download)
- Local model loading MUST show a spinner until complete or failed
- Error messages MUST be descriptive

## Related Code Files

### Modify
- `repo/modded/app/src/components/ModelsTab/ModelsTab.tsx` — Fix button state management

### Read (for context)
- `repo/modded/backend/routers/model_management.py` — Trigger download endpoint behavior

## Implementation Steps

1. **Track loading state per-model with a Set instead of single string:**
   ```typescript
   const [loadingModels, setLoadingModels] = useState<Set<string>>(new Set());

   const addLoading = (name: string) =>
     setLoadingModels(prev => new Set(prev).add(name));
   const removeLoading = (name: string) =>
     setLoadingModels(prev => { const s = new Set(prev); s.delete(name); return s; });
   ```

2. **Fix `handleDownload` to properly handle local vs HF models:**
   ```typescript
   const handleDownload = async (modelName: string) => {
     const model = modelStatus?.models.find((m) => m.model_name === modelName);
     if (!model) return;

     addLoading(modelName);

     try {
       await apiClient.triggerModelDownload(modelName);

       // For local/cloud models, load is synchronous — just refresh status
       if (model.is_local || model.is_cloud) {
         queryClient.invalidateQueries({ queryKey: ['modelStatus'] });
         removeLoading(modelName);
         toast({ title: 'Model loaded', description: `${model.display_name} is ready.` });
         return;
       }

       // For HF models, start SSE progress tracking
       setDownloadingModel(modelName);
       setDownloadingDisplayName(model.display_name);
     } catch (error) {
       removeLoading(modelName);
       toast({
         title: 'Download failed',
         description: error instanceof Error ? error.message : 'Unknown error',
         variant: 'destructive',
       });
     }
   };
   ```

3. **Update `ModelCard` to use the loading Set:**
   ```typescript
   <ModelCard
     key={model.model_name}
     model={model}
     isDownloading={loadingModels.has(model.model_name) || downloadingModel === model.model_name}
     onDownload={() => handleDownload(model.model_name)}
     onDelete={() => openDeleteDialog(model)}
   />
   ```

4. **Add ElevenLabs cloud model to the Models tab filter:**
   Currently `ttsModels` filter in `ModelsTab.tsx:101-107` excludes `elevenlabs-v2`. Add it:
   ```typescript
   const ttsModels = modelStatus?.models.filter(
     (m) => m.model_type === 'tts'
   ) ?? [];
   ```

5. **Force immediate status refresh after load/error:**
   After loading completes or fails, call `queryClient.invalidateQueries` immediately instead of waiting for 5-second poll.

## Todo List
- [ ] Replace single `downloadingModel` string with `loadingModels` Set
- [ ] Separate local model load flow from HF download flow
- [ ] Add immediate status refresh after load complete/error
- [ ] Include cloud models (ElevenLabs) in Models tab
- [ ] Test: click Load for Kokoro → spinner shows → completes
- [ ] Test: click Load for KugelAudio → spinner shows → error shows correctly
- [ ] Test: after error, button still shows "Load" not "Download"
- [ ] Hot-deploy frontend

## Success Criteria
- Every button click shows immediate visual feedback
- Failed loads keep correct button state
- Model status refreshes immediately after state changes
- All 5 TTS backends visible in Models tab
