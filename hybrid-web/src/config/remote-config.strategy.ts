// Strategy constants + degradation switches for Remembrancer.
//
// LOCAL-FIRST ORDER: these defaults act as a hard-coded mirror that makes the
// app fully functional offline / without any Firebase project. When a real
// Firebase project is configured, an optional Remote Config overlay may refresh
// them at runtime — the mirror values always remain as the fallback.

export const REMOTE_CONFIG_KEYS = {
  CLOUD_SUMMARY_ENABLED: 'cloud_summary_enabled',
  ONDEVICE_TRANSCRIPTION_ENABLED: 'ondevice_transcription_enabled',
  TRANSCRIPT_MAX_DURATION_CLOUD: 'transcript_max_duration_cloud_sec',
  DEGRADATION_POLICY: 'degradation_policy',
  MAX_AUDIO_SECONDS_PER_REQUEST: 'max_audio_seconds_per_request',
  EMOTION_TAG_MODEL: 'emotion_tag_model'
} as const

export type DegradationPolicy =
  | 'none'        // no degradation — fail loudly
  | 'local_only'  // on-device path only; cloud calls refused
  | 'graceful'    // try cloud, fall back to local engine with visible warning
  | 'offline'     // full offline mode: local storage only, no network at all

export const REMOTE_CONFIG_DEFAULTS: Record<string, any> = {
  [REMOTE_CONFIG_KEYS.CLOUD_SUMMARY_ENABLED]: true,
  [REMOTE_CONFIG_KEYS.ONDEVICE_TRANSCRIPTION_ENABLED]: true,
  [REMOTE_CONFIG_KEYS.TRANSCRIPT_MAX_DURATION_CLOUD]: 600,
  [REMOTE_CONFIG_KEYS.DEGRADATION_POLICY]: 'graceful',
  [REMOTE_CONFIG_KEYS.MAX_AUDIO_SECONDS_PER_REQUEST]: 300,
  [REMOTE_CONFIG_KEYS.EMOTION_TAG_MODEL]: 'web-speech-local'
}

/** Channel labels shown in the UI badges. */
export const CHANNEL_LABELS = {
  transcriptionOnDevice: 'Web Speech API ﾷ on-device',
  transcriptionFallback: 'typed / paste mode',
  summaryLocal: 'local engine ﾷ offline floor',
  summaryCloud: 'Firebase AI Logic ﾷ Gemini hybrid (sponsor SDK)',
  aiLogicOptional: 'Firebase AI Logic (Gemini hybrid)'
} as const