// Remembrancer options page — Firebase project (AI Logic channel) + degradation strategy.

import {
  saveCloudConfigToStorage,
  probeCloud,
  resetCloudConfig
} from '../shared/cloudClient.js'

document.addEventListener('DOMContentLoaded', async () => {
  const apiKeyEl = document.getElementById('firebase-api-key')
  const projectIdEl = document.getElementById('firebase-project-id')
  const appIdEl = document.getElementById('firebase-app-id')
  const appCheckEndpointEl = document.getElementById('firebase-appcheck-endpoint')
  const appCheckDebugEl = document.getElementById('appcheck-debug')
  const appCheckDebugTokenEl = document.getElementById('firebase-appcheck-debug-token')
  const configErrorEl = document.getElementById('config-error')
  const cfgCloud = document.getElementById('cfg-cloud-enabled')
  const cfgDegradation = document.getElementById('cfg-degradation')

  // hydrate fields from storage
  const stored = await chrome.storage.local.get([
    'remote_config',
    'firebase_project',
    'appcheck_debug',
    'appcheck_debug_token'
  ])
  const fbProject = stored.firebase_project ?? {}
  apiKeyEl.value = fbProject.apiKey ?? ''
  projectIdEl.value = fbProject.projectId ?? ''
  appIdEl.value = fbProject.appId ?? ''
  appCheckEndpointEl.value = fbProject.appCheckTokenEndpoint ?? ''
  appCheckDebugEl.checked = stored.appcheck_debug === true
  appCheckDebugTokenEl.value = stored.appcheck_debug_token ?? ''

  if (stored.remote_config) {
    cfgCloud.checked = stored.remote_config.cloud_summary_enabled ?? true
    const storedPolicy = stored.remote_config.degradation_policy ?? 'graceful'
    cfgDegradation.value = storedPolicy === 'none' ? 'fail-loudly' : storedPolicy
  } else {
    cfgDegradation.value = 'graceful'
  }

  updateChannelStatus()

  document.getElementById('btn-save').addEventListener('click', async () => {
    try {
      await saveCloudConfigToStorage({
        apiKey: apiKeyEl.value.trim(),
        projectId: projectIdEl.value.trim(),
        appId: appIdEl.value.trim(),
        appCheckTokenEndpoint: appCheckEndpointEl.value.trim(),
        appcheck_debug: appCheckDebugEl.checked,
        appcheck_debug_token: appCheckDebugTokenEl.value.trim()
      })
      showConfigError('')
      await refreshProbe(true)
    } catch (error) {
      showConfigError(error.message)
    }
  })

  document.getElementById('btn-reset-cloud').addEventListener('click', async () => {
    await resetCloudConfig()
    apiKeyEl.value = ''
    projectIdEl.value = ''
    appIdEl.value = ''
    appCheckEndpointEl.value = ''
    appCheckDebugEl.checked = false
    appCheckDebugTokenEl.value = ''
    showConfigError('')
    await refreshProbe(true)
  })

  document.getElementById('btn-save-strategy').addEventListener('click', async () => {
    await chrome.storage.local.set({
      remote_config: {
        cloud_summary_enabled: cfgCloud.checked,
        ondevice_transcription_enabled: true,
        degradation_policy: cfgDegradation.value,
        max_audio_seconds_per_request: 300,
        transcript_max_duration_cloud_sec: 600,
        emotion_tag_model: 'web-speech-local'
      }
    })
    chrome.runtime.sendMessage({ type: 'CONFIG_UPDATED' })
    const saveBadge = document.getElementById('save-status')
    saveBadge.style.display = 'inline-flex'
    setTimeout(() => { saveBadge.style.display = 'none' }, 1800)
  })
})

function showConfigError(message) {
  const element = document.getElementById('config-error')
  element.textContent = message
  element.style.display = message ? 'flex' : 'none'
}

async function refreshProbe(force) {
  const probeBadge = document.getElementById('probe-status')
  const stateEl = document.getElementById('channel-cloud-state')
  const detailEl = document.getElementById('channel-cloud-detail')

  probeBadge.className = 'badge offline'
  probeBadge.textContent = force ? 'probing…' : 'not probed'
  stateEl.className = 'state muted'
  stateEl.textContent = 'CHECKING…'

  const probe = await probeCloud()
  applyProbe(probe)
}

function applyProbe(probe) {
  const stateEl = document.getElementById('channel-cloud-state')
  const detailEl = document.getElementById('channel-cloud-detail')

  if (!probe.configured) {
    stateEl.className = 'state muted'
    stateEl.textContent = 'OPTIONAL'
    detailEl.textContent =
      'no Firebase project saved - popup uses the local engine only (the designed default).'
    return
  }

  if (probe.reachable) {
    stateEl.className = 'state ok'
    stateEl.textContent = 'READY'
    detailEl.textContent =
      'Firebase AI Logic wired - Gemini Developer API backend, mode prefer_on_device; ' +
      `provenance: ${probe.inferenceSource || 'unspecified'}.`
  } else {
    stateEl.className = 'state warn'
    stateEl.textContent = 'DEGRADED'
    detailEl.textContent =
      'Firebase AI Logic unreachable - the active degradation policy determines whether the request fails loudly or falls back locally.'
  }
}

async function updateChannelStatus() {
  const probe = await probeCloud(false)
  applyProbe(probe)
}
