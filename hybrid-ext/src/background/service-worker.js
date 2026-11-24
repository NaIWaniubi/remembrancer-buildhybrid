// Remembrancer MV3 service worker - hybrid architecture.
// On install: seed strategy defaults into chrome.storage.local.
// Message routing: popup -> LOCAL_SUMMARIZE (local engine, zero quota)
//                  popup -> FIREBASE_AI_LOGIC (Firebase AI Logic Gemini channel,
//                            PREFER_ON_DEVICE mode with local fallback)

import { assertCloudRequestAllowed, summarizeText } from '../shared/cloudClient.js'

const DEFAULT_REMOTE_CONFIG = {
  cloud_summary_enabled: true,
  ondevice_transcription_enabled: true,
  transcript_max_duration_cloud_sec: 600,
  degradation_policy: 'graceful',
  max_audio_seconds_per_request: 300,
  emotion_tag_model: 'web-speech-local'
}

chrome.runtime.onInstalled.addListener(async () => {
  console.log('[Remembrancer] Extension installed - degraded route active.')
  const stored = await chrome.storage.local.get('remote_config')
  if (!stored.remote_config) {
    await chrome.storage.local.set({ remote_config: DEFAULT_REMOTE_CONFIG })
  }
})

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GET_CONFIG') {
    chrome.storage.local.get('remote_config').then((res) => {
      sendResponse({ config: res.remote_config || DEFAULT_REMOTE_CONFIG })
    })
    return true
  }

  if (message.type === 'LOCAL_SUMMARIZE') {
    // Guaranteed channel: deterministic local engine - no key, no quota, offline.
    summarizeText(message.payload?.text ?? '', false)
      .then((result) => sendResponse({ success: result.ok, data: result.ok ? result : null, error: result.ok ? null : result.error }))
      .catch((err) => sendResponse({ success: false, error: err.message }))
    return true
  }

  if (message.type === 'CLOUD_LONGTEXT') {
    // Enforce the persisted strategy in the worker before any request/fallback work.
    chrome.storage.local.get('remote_config').then(async ({ remote_config }) => {
      try {
        assertCloudRequestAllowed(remote_config)
        const result = await summarizeText(message.payload?.text ?? '', true)
        sendResponse({ success: result.ok, data: result.ok ? result : null, error: result.ok ? null : result.error })
      } catch (err) {
        sendResponse({ success: false, error: err.message })
      }
    })
    return true
  }

  if (message.type === 'CONFIG_UPDATED') {
    console.log('[Remembrancer] Strategy config updated by options page.')
  }
})
