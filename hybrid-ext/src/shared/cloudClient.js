// Extension-side hybrid client for Remembrancer (Chrome MV3).
//
// The cloud channel is Firebase AI Logic ONLY (the sponsor SDK, per the official hybrid
// quickstart): Gemini Developer API backend, PREFER_ON_DEVICE mode, SDK-reported
// inference source. The deterministic local engine (./localEngine.js) remains the
// offline floor beneath every channel.
//
// MV3 pages/service workers cannot resolve bare specifiers ("firebase/ai"), so this module
// imports the pre-bundled SDK (src/lib/firebase-ai-logic.bundle.js, produced by tools/bundle-ai.mjs).

import {
  summarizeLocally,
  analyzeSentiment,
  deriveHeadline
} from './localEngine.js'
import {
  initializeDeviceModel,
  generateSummaryViaAiLogic,
  isAiLogicConfigured,
  inferenceLabel,
  validateFirebaseProjectConfig
} from '../lib/firebase-ai-logic.bundle.js'

const DEFAULT_REMOTE_CONFIG = {
  cloud_summary_enabled: true,
  degradation_policy: 'graceful'
}
const VALID_DEGRADATION_POLICIES = new Set([
  'graceful',
  'fail-loudly',
  'none',
  'local_only',
  'offline'
])
const FIREBASE_PROJECT_KEY = 'firebase_project'

export class CloudNotConfiguredError extends Error {
  constructor(message = 'No Firebase project configured in Options.') {
    super(message)
    this.name = 'CloudNotConfiguredError'
  }
}

export class DegradationPolicyError extends Error {
  constructor(message, policy) {
    super(message)
    this.name = 'DegradationPolicyError'
    this.policy = policy
  }
}

/** Read and validate the persisted strategy. Unknown values fail closed. */
export async function getRemoteConfig() {
  const { remote_config } = await chrome.storage.local.get('remote_config')
  const policy = remote_config?.degradation_policy ?? DEFAULT_REMOTE_CONFIG.degradation_policy
  if (!VALID_DEGRADATION_POLICIES.has(policy)) {
    throw new DegradationPolicyError(`Unknown degradation policy: ${policy}`, policy)
  }
  return {
    ...DEFAULT_REMOTE_CONFIG,
    ...remote_config,
    degradation_policy: policy
  }
}

/** Enforce policies that forbid cloud work before any request or fallback is attempted. */
export function assertCloudRequestAllowed(config) {
  const policy = config?.degradation_policy ?? DEFAULT_REMOTE_CONFIG.degradation_policy
  if (!VALID_DEGRADATION_POLICIES.has(policy)) {
    throw new DegradationPolicyError(`Unknown degradation policy: ${policy}`, policy)
  }
  if (policy === 'local_only' || policy === 'offline') {
    throw new DegradationPolicyError(
      `Cloud requests are disabled by degradation policy "${policy}".`,
      policy
    )
  }
  if (config?.cloud_summary_enabled === false) {
    throw new DegradationPolicyError('Cloud summary disabled by strategy.', policy)
  }
}

/** Only graceful mode may convert a cloud failure into a local result. */
export function canFallbackLocally(policy) {
  return policy === 'graceful'
}

/**
 * True when a real Firebase project exists in chrome.storage (guest mode = false).
 * Also arms on-device-model download per the Chrome Prompt API requirement.
 */
export async function getEffectiveCloudConfig() {
  const configured = await isAiLogicConfigured()
  return { configured, source: configured ? 'firebase-ai-logic' : '' }
}

/** Pre-download the on-device model after a user interaction (before any query). */
export async function prepareOnDeviceModel(onProgress) {
  try {
    await initializeDeviceModel(onProgress)
    return true
  } catch (error) {
    const { degradation_policy: policy } = await getRemoteConfig()
    if (canFallbackLocally(policy)) {
      console.debug('[Remembrancer] on-device prewarm skipped:', error?.message || error)
      return false
    }
    throw error
  }
}

/** One summary request through Firebase AI Logic; returns real SDK provenance. */
async function aiLogicSummary(transcript) {
  const outcome = await generateSummaryViaAiLogic(transcript)
  return {
    text: outcome.text,
    inferenceSource: outcome.inferenceSource,
    elapsedMs: outcome.elapsedMs
  }
}

/**
 * Summary chain for the popup's two buttons:
 * - on-device summary (local engine, always works)
 * - cloud request (Firebase AI Logic; fallback only when policy is graceful)
 */
export async function summarizeText(text, preferCloud) {
  const trimmed = String(text ?? '').trim()
  if (!trimmed) {
    return { ok: false, error: 'Nothing to process — paste some family conversation text first.' }
  }

  const remoteConfig = await getRemoteConfig()
  if (!preferCloud) return finalizeLocal(trimmed)

  assertCloudRequestAllowed(remoteConfig)

  try {
    const cloud = await aiLogicSummary(trimmed)
    return {
      ok: true,
      headline: '',
      summary: cloud.text,
      tags: [],
      path: 'firebase-ai-logic',
      inferenceSource: cloud.inferenceSource,
      degraded: false,
      elapsedMs: cloud.elapsedMs
    }
  } catch (error) {
    if (!canFallbackLocally(remoteConfig.degradation_policy)) throw error

    const local = finalizeLocal(trimmed)
    local.degraded = true
    local.degradeReason = `ai-logic failed (${error?.message || error})`
    return local
  }
}

function finalizeLocal(text) {
  const local = summarizeLocally(text, 3)
  const sentiment = analyzeSentiment(text)
  return {
    ok: true,
    headline: '',
    summary: local.summary,
    tags: sentiment.tags,
    path: 'extractive-local',
    degraded: false,
    degradeReason: '',
    elapsedMs: 0
  }
}

/** Long-text mode with headline + tags contract (used for very long pastes). */
export async function processLongText(text, preferCloud) {
  const base = await summarizeText(text, preferCloud)
  if (!base.ok) return base
  base.headline = deriveHeadline(text)
  if (!base.tags.length) base.tags = analyzeSentiment(text).tags
  return base
}

/** Human-readable provenance label for badges ("on-device" / "in-cloud"). */
export { inferenceLabel as inferenceLabel }

/** Ping used by the options page status visualization. Performs one real minimal request. */
export async function probeCloud(timeoutMs = 6000) {
  const started = performance.now()
  const configured = await isAiLogicConfigured()
  if (!configured) {
    return {
      reachable: false,
      configured: false,
      detail: 'not configured · guest mode (local floor)',
      inferenceSource: null,
      elapsedMs: 0
    }
  }

  let timeoutId
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`Probe timed out after ${timeoutMs}ms`)), timeoutMs)
  })

  try {
    const outcome = await Promise.race([generateSummaryViaAiLogic('ping'), timeout])
    return {
      reachable: true,
      configured: true,
      detail: 'Firebase AI Logic · Gemini Developer API backend · mode prefer_on_device',
      inferenceSource: outcome.inferenceSource,
      elapsedMs: Math.round(performance.now() - started)
    }
  } catch (error) {
    const message = error?.message || String(error)
    return {
      reachable: false,
      configured: true,
      detail: message.slice(0, 160),
      inferenceSource: null,
      elapsedMs: Math.round(performance.now() - started)
    }
  } finally {
    clearTimeout(timeoutId)
  }
}

// --- storage persistence (chrome.storage.local, offline-first equivalent of Remote Config) ---

export async function saveCloudConfigToStorage(config) {
  const normalized = validateFirebaseProjectConfig(config)
  const debugToken = String(config.appcheck_debug_token ?? '').trim()
  if (config.appcheck_debug === true && !debugToken) {
    throw new Error('App Check debug mode is enabled but no debug token was provided.')
  }
  const project = {
    apiKey: normalized.apiKey,
    projectId: normalized.projectId,
    appId: normalized.appId
  }
  if (normalized.appCheckTokenEndpoint) {
    project.appCheckTokenEndpoint = normalized.appCheckTokenEndpoint
  }

  await chrome.storage.local.set({
    [FIREBASE_PROJECT_KEY]: project,
    appcheck_debug: config.appcheck_debug === true,
    appcheck_debug_token: debugToken
  })
}

export async function resetCloudConfig() {
  await chrome.storage.local.remove(FIREBASE_PROJECT_KEY)
  await chrome.storage.local.remove('appcheck_debug')
  await chrome.storage.local.remove('appcheck_debug_token')
}
