# Phase 02 — Bug Fix: KugelAudio Meta Tensor Error

## Overview
- **Priority:** Critical
- **Status:** Pending
- **Effort:** S (3h)

## Key Insights

**Error message:**
```
Failed to load kugelaudio-7B: Cannot copy out of meta tensor; no data!
Please use torch.nn.Module.to_empty() instead of torch.nn.Module.to()
when moving module from meta to a different device.
```

**Root cause:** In `kugelaudio_backend.py:64-67`, the model is loaded with:
```python
self.model = KugelAudioForConditionalGenerationInference.from_pretrained(
    model_path,
    torch_dtype=torch.bfloat16,
).to(self.device)
```

The `from_pretrained()` call loads the model using `torch.device("meta")` for memory-efficient loading (common in HuggingFace transformers). The subsequent `.to(self.device)` fails because you can't copy meta tensors — they have no data. The fix is to use `device_map` parameter in `from_pretrained()` instead of chaining `.to()`.

**Secondary issue:** After the error, clicking "Load" again shows "Download" button instead of retrying load — this is the stale button state issue (Phase 03).

## Requirements

- KugelAudio model MUST load successfully on V100 with bfloat16
- Error handling MUST provide clear feedback if loading fails (e.g., insufficient VRAM)
- Model unloading MUST properly free VRAM

## Related Code Files

### Modify
- `repo/modded/backend/backends/kugelaudio_backend.py` — Fix `_load_model_sync()` method

### Read (for context)
- `repo/modded/backend/routers/model_management.py` — Load/download trigger endpoint
- KugelAudio pip package source (if available) for `from_pretrained` signature

## Implementation Steps

1. **Fix `_load_model_sync` in `kugelaudio_backend.py`:**
   Replace `.to(self.device)` with `device_map` parameter:

   ```python
   def _load_model_sync(self) -> None:
       try:
           import torch
           from kugelaudio_open import (
               KugelAudioForConditionalGenerationInference,
               KugelAudioProcessor,
           )

           model_path = str(self.MODEL_DIR)
           print(f"[KugelAudio] Loading model from {model_path} on {self.device} ...")

           # Use device_map instead of .to() to avoid meta tensor copy error
           self.model = KugelAudioForConditionalGenerationInference.from_pretrained(
               model_path,
               torch_dtype=torch.bfloat16,
               device_map=self.device,
           )
           self.model.eval()
           self.model.model.strip_encoders()

           self.processor = KugelAudioProcessor.from_pretrained(model_path)
           self._available_voices = self.processor.get_available_voices()
           print(f"[KugelAudio] Loaded. Voices: {self._available_voices}")

       except Exception as e:
           print(f"[KugelAudio] Error loading model: {e}")
           raise
   ```

2. **If `device_map` is not supported by KugelAudio's `from_pretrained`**, use `to_empty()` approach:
   ```python
   model = KugelAudioForConditionalGenerationInference.from_pretrained(
       model_path,
       torch_dtype=torch.bfloat16,
   )
   # Move from meta device to real device
   self.model = model.to_empty(device=self.device)
   # Reload weights into the now-allocated tensors
   self.model.load_state_dict(
       torch.load(Path(model_path) / "model.safetensors", map_location=self.device),
       strict=False,
   )
   ```

3. **Fallback: low_cpu_mem_usage=False**
   If the above don't work, try disabling meta device loading:
   ```python
   self.model = KugelAudioForConditionalGenerationInference.from_pretrained(
       model_path,
       torch_dtype=torch.bfloat16,
       low_cpu_mem_usage=False,
   ).to(self.device)
   ```

4. **Test inside container:**
   ```bash
   docker exec voicebox python3 -c "
   from kugelaudio_open import KugelAudioForConditionalGenerationInference
   import torch
   m = KugelAudioForConditionalGenerationInference.from_pretrained(
       '/home/models/kugelaudio', torch_dtype=torch.bfloat16, device_map='cuda'
   )
   print('Success:', type(m))
   "
   ```

5. **Hot-deploy fix:**
   ```bash
   docker cp repo/modded/backend/backends/kugelaudio_backend.py voicebox:/app/backend/backends/kugelaudio_backend.py
   docker exec voicebox pkill -f "python3 -m backend.server"
   ```

6. **Verify via API:**
   ```bash
   curl -X POST http://localhost:8080/models/download -H 'Content-Type: application/json' -d '{"model_name":"kugelaudio-7B"}'
   ```

## Todo List
- [ ] Try `device_map=self.device` in `from_pretrained`
- [ ] If that fails, try `low_cpu_mem_usage=False`
- [ ] If that fails, try `to_empty()` approach
- [ ] Test loading via API endpoint
- [ ] Test generation with all 3 voices (default, warm, clear)
- [ ] Verify unload properly frees VRAM
- [ ] Hot-deploy to container

## Success Criteria
- `POST /models/download {"model_name":"kugelaudio-7B"}` succeeds
- `GET /models/status` shows `kugelaudio-7B: loaded=true`
- Generation produces valid audio with all 3 voices
- Unload frees VRAM back to baseline

## Risk Assessment
- **VRAM:** KugelAudio needs ~19GB. If Qwen is loaded (4.6GB), total exceeds V100 32GB with overhead. May need to unload Qwen first.
- **Package API:** `kugelaudio_open` may not support `device_map` — need to test inside container to find the right approach.
