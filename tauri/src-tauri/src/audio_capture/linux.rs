use crate::audio_capture::AudioCaptureState;

pub async fn start_capture(
    _state: &AudioCaptureState,
    _max_duration_secs: u32,
) -> Result<(), String> {
    Err("Audio capture is not yet implemented on Linux".into())
}

pub async fn stop_capture(_state: &AudioCaptureState) -> Result<String, String> {
    Err("Audio capture is not yet implemented on Linux".into())
}

pub fn is_supported() -> bool {
    false
}
