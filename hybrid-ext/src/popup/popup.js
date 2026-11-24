// Remembrancer popup logic - hybrid architecture (Firebase AI Logic cloud channel).
// Dual buttons:
//   1. On-device Summary  -> local extractive engine + sentiment tags (zero quota)
//   2. Firebase AI Logic   -> Gemini Developer API backend, PREFER_ON_DEVICE mode,
//                             SDK-reported on-device/in-cloud provenance badge,
//                             local fallback only when degradation policy is graceful

import {
  summarizeText,
  getEffectiveCloudConfig,
  probeCloud,
  prepareOnDeviceModel
} from '../shared/cloudClient.js'
import { inferenceLabel } from '../lib/firebase-ai-logic.bundle.js'

document.addEventListener('DOMContentLoaded', async () => {
  const btnLocal = document.getElementById('btn-local')
  const btnCloud = document.getElementById('btn-cloud')
  const pasteInput = document.getElementById('paste-input')
  const statusText = document.getElementById('processing-status')
  const resultSection = document.getElementById('result-section')
  const cloudStatusEl = document.getElementById('cloud-status')
  const degradationEl = document.getElementById('degradation-indicator')

  // --- Load strategy + cloud config from chrome.storage.local ---
  const { remote_config: rc } = await chrome.storage.local.get('remote_config')
  if (rc) {
    degradationEl.textContent = rc.degradation_policy ?? 'graceful'
    if (rc.cloud_summary_enabled === false) {
      btnCloud.disabled = true
      btnCloud.title = 'Firebase AI Logic disabled by strategy'
    }
  } else {
    degradationEl.textContent = 'graceful'
  }

  async function refreshCloudStatus() {
    const cfg = await getEffectiveCloudConfig()
    if (!cfg.configured) {
      cloudStatusEl.textContent = 'not configured · guest mode'
      cloudStatusEl.className = 'status-value'
      return
    }
    const probe = await probeCloud(4000)
    cloudStatusEl.textContent = probe.reachable ? `ready (${probe.elapsedMs}ms)` : `pending · ${probe.detail}`
    cloudStatusEl.className = probe.reachable ? 'status-value ok' : 'status-value'
  }
  void refreshCloudStatus()

  function renderResult(result) {
    resultSection.style.display = 'block'
    document.getElementById('result-path').textContent =
      result.path === 'firebase-ai-logic'
        ? `☁ firebase-ai-logic${result.inferenceSource ? ` · ${inferenceLabel(result.inferenceSource)}` : ''}`
        : '⚙ extractive-local'

    const degradeBadge = document.getElementById('result-degrade')
    if (result.degraded) {
      degradeBadge.style.display = 'inline-flex'
      degradeBadge.textContent = `degraded → local${result.degradeReason ? ` (${result.degradeReason})` : ''}`
    } else {
      degradeBadge.style.display = 'none'
    }

    const tagsEl = document.getElementById('result-tags')
    tagsEl.innerHTML = ''
    for (const tag of result.tags ?? []) {
      const span = document.createElement('span')
      span.className = 'tag'
      span.textContent = `#${tag}`
      tagsEl.appendChild(span)
    }

    document.getElementById('summary-output').textContent = result.summary
    const metaParts = []
    if (result.model) metaParts.push(`model: ${result.model}`)
    if (result.path === 'firebase-ai-logic') {
      metaParts.push(`provenance: ${inferenceLabel(result.inferenceSource)}`)
    }
    if (result.elapsedMs) metaParts.push(`${result.elapsedMs}ms`)
    metaParts.push('no audio ever captured or sent — text only')
    document.getElementById('result-meta').textContent = metaParts.join(' · ')
  }

  async function run(action) {
    const text = pasteInput.value.trim()
    if (!text) {
      statusText.textContent = 'Paste some family conversation text first.'
      pasteInput.focus()
      return
    }
    const preferCloud = action === 'cloud'
    btnLocal.disabled = true
    btnCloud.disabled = true
    statusText.textContent =
      preferCloud
        ? 'Firebase AI Logic · preparing on-device model…'
        : 'Summarizing on device…'

    try {
      if (preferCloud) await prepareOnDeviceModel()
      const result = await summarizeText(text, preferCloud)
      if (!result.ok) {
        statusText.textContent = result.error
        return
      }
      renderResult(result)
      statusText.textContent =
        result.path === 'firebase-ai-logic'
          ? `Done via ☁ Firebase AI Logic (${inferenceLabel(result.inferenceSource)}, ${result.elapsedMs}ms)`
          : result.degraded
            ? `Done locally (Firebase AI Logic unavailable/degraded: ${result.degradeReason})`
            : 'Done via ⚙ local engine · no quota consumed'
    } catch (err) {
      statusText.textContent = `Error: ${err.message}`
    } finally {
      btnLocal.disabled = false
      btnCloud.disabled = false
    }
  }

  btnLocal.addEventListener('click', () => run('local'))
  btnCloud.addEventListener('click', () => run('cloud'))

  document.getElementById('open-options').addEventListener('click', (e) => {
    e.preventDefault()
    chrome.runtime.openOptionsPage()
  })
})
