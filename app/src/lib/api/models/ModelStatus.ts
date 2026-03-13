/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Response model for model status.
 */
export type ModelStatus = {
  model_name: string;
  display_name: string;
  downloaded: boolean;
  downloading?: boolean;  // True if download is in progress
  size_mb?: number | null;
  loaded?: boolean;
  backend_type?: string | null;  // "qwen", "kokoro", "kugelaudio", "whisper"
  model_type?: string | null;    // "tts" or "stt"
  is_local?: boolean;            // True if model is local-only (no HF download)
};
