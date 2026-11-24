import { ref } from 'vue'
import {
  fetchAndActivate,
  getBoolean,
  getNumber,
  getString
} from 'firebase/remote-config'
import { REMOTE_CONFIG_KEYS, REMOTE_CONFIG_DEFAULTS, type DegradationPolicy } from '@/config/remote-config.strategy'
import { useFirebaseState } from '@/config/firebase.init'

export interface RemoteConfigState {
  cloudSummaryEnabled: boolean
  ondeviceTranscriptionEnabled: boolean
  transcriptMaxDurationCloudSec: number
  degradationPolicy: DegradationPolicy
  maxAudioSecondsPerRequest: number
  emotionTagModel: string
}

function defaults(): RemoteConfigState {
  return {
    cloudSummaryEnabled: REMOTE_CONFIG_DEFAULTS[REMOTE_CONFIG_KEYS.CLOUD_SUMMARY_ENABLED],
    ondeviceTranscriptionEnabled: REMOTE_CONFIG_DEFAULTS[REMOTE_CONFIG_KEYS.ONDEVICE_TRANSCRIPTION_ENABLED],
    transcriptMaxDurationCloudSec: REMOTE_CONFIG_DEFAULTS[REMOTE_CONFIG_KEYS.TRANSCRIPT_MAX_DURATION_CLOUD],
    degradationPolicy: REMOTE_CONFIG_DEFAULTS[REMOTE_CONFIG_KEYS.DEGRADATION_POLICY],
    maxAudioSecondsPerRequest: REMOTE_CONFIG_DEFAULTS[REMOTE_CONFIG_KEYS.MAX_AUDIO_SECONDS_PER_REQUEST],
    emotionTagModel: REMOTE_CONFIG_DEFAULTS[REMOTE_CONFIG_KEYS.EMOTION_TAG_MODEL]
  }
}

// Runtime overrides persisted locally - the offline-first equivalent of
// Firebase Remote Config. Lets a family adjust strategy without a project.
const OVERRIDE_KEY = 'remembrancer.strategy'

interface StrategyOverride {
  cloudSummaryEnabled?: boolean
  degradationPolicy?: DegradationPolicy
  maxAudioSecondsPerRequest?: number
  ondeviceTranscriptionEnabled?: boolean
}

function loadOverride(): StrategyOverride {
  try {
    const raw = localStorage.getItem(OVERRIDE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as StrategyOverride
  } catch {
    return {}
  }
}

export function saveStrategyOverride(override: StrategyOverride): void {
  try {
    localStorage.setItem(OVERRIDE_KEY, JSON.stringify(override))
  } catch {
    /* ignore */
  }
}

/**
 * Local-first configuration:
 * 1. Hard-coded strategy mirror (always available)
 * 2. Local runtime override (family decisions without Firebase)
 * 3. Optional Firebase Remote Config overlay when a real project is configured
 */
export function useRemoteConfig() {
  const config = ref<RemoteConfigState>(defaults())
  const ready = ref(false)

  function apply() {
    const merged = { ...defaults(), ...loadOverride() }
    config.value = merged as RemoteConfigState
  }

  async function fetchAndActivateRemembrancerConfig(): Promise<void> {
    apply()

    // Optional Remote Config overlay - only when Firebase is actually configured.
    const fb = useFirebaseState()
    if (fb.ready && fb.remoteConfig) {
      try {
        const rc = fb.remoteConfig
        for (const [k, v] of Object.entries(REMOTE_CONFIG_DEFAULTS)) {
          rc.defaultConfig[k] = String(v)
        }
        await Promise.race([
          fetchAndActivate(rc),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('remote-config-timeout')), 5000)
          )
        ])

        const next = defaults()
        next.cloudSummaryEnabled =
          getBoolean(rc, REMOTE_CONFIG_KEYS.CLOUD_SUMMARY_ENABLED) ??
          REMOTE_CONFIG_DEFAULTS[REMOTE_CONFIG_KEYS.CLOUD_SUMMARY_ENABLED]
        next.ondeviceTranscriptionEnabled =
          getBoolean(rc, REMOTE_CONFIG_KEYS.ONDEVICE_TRANSCRIPTION_ENABLED) ??
          REMOTE_CONFIG_DEFAULTS[REMOTE_CONFIG_KEYS.ONDEVICE_TRANSCRIPTION_ENABLED]
        next.transcriptMaxDurationCloudSec =
          getNumber(rc, REMOTE_CONFIG_KEYS.TRANSCRIPT_MAX_DURATION_CLOUD) ??
          REMOTE_CONFIG_DEFAULTS[REMOTE_CONFIG_KEYS.TRANSCRIPT_MAX_DURATION_CLOUD]
        next.maxAudioSecondsPerRequest =
          getNumber(rc, REMOTE_CONFIG_KEYS.MAX_AUDIO_SECONDS_PER_REQUEST) ??
          REMOTE_CONFIG_DEFAULTS[REMOTE_CONFIG_KEYS.MAX_AUDIO_SECONDS_PER_REQUEST]
        next.degradationPolicy =
          (getString(rc, REMOTE_CONFIG_KEYS.DEGRADATION_POLICY) as DegradationPolicy) ??
          REMOTE_CONFIG_DEFAULTS[REMOTE_CONFIG_KEYS.DEGRADATION_POLICY]
        next.emotionTagModel =
          getString(rc, REMOTE_CONFIG_KEYS.EMOTION_TAG_MODEL) ??
          REMOTE_CONFIG_DEFAULTS[REMOTE_CONFIG_KEYS.EMOTION_TAG_MODEL]

        config.value = next
      } catch {
        // Remote Config unreachable - keep the local mirror silently.
      }
    }
    ready.value = true
  }

  return { config, ready, fetchAndActivate: fetchAndActivateRemembrancerConfig }
}
