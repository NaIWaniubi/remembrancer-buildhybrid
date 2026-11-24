// Firebase AI Logic wrapper for Remembrancer (Chrome MV3 extension).
//
// The REAL sponsor SDK integration per the official hybrid quickstart
// (https://firebase.google.com/docs/ai-logic/hybrid/web/get-started):
//
//   import { getAI, getGenerativeModel, GoogleAIBackend, InferenceMode } from "firebase/ai";
//   const ai = getAI(firebaseApp, { backend: new GoogleAIBackend() });
//   const model = getGenerativeModel(ai, { mode: InferenceMode.PREFER_ON_DEVICE });
//   // after or on a user interaction (button click), before any query:
//   await model.initializeDeviceModel((val) => /* UI progress state */);
//   const result = await model.generateContent(prompt);
//   const text = result.response.text();
//   const source = result.response.inferenceSource; // "on_device" | "in_cloud"
//
// App Check enforcement is mandatory for AI Logic since Nov 2, 2026. Local development
// uses the debug provider (set globalThis.FIREBASE_APPCHECK_DEBUG_TOKEN = true before
// initializeAppCheck, then safelist the token printed by the Firebase SDK in the console).
// Production uses a CustomProvider backed by an HTTPS token endpoint configured in Options.
//
// BUNDLE NOTE: MV3 pages/service workers cannot resolve bare specifiers like "firebase/ai",
// so `tools/bundle-ai.mjs` bundles this file (+ firebase SDK) into src/lib/firebase-ai-logic.bundle.js;
// shipped entry points import the bundle instead of importing the SDK directly.
// The deterministic local engine (src/shared/localEngine.js) remains the offline floor
// beneath every channel.

import { initializeApp, getApps } from 'firebase/app'
import { CustomProvider, initializeAppCheck } from 'firebase/app-check'
import {
  getAI,
  getGenerativeModel,
  GoogleAIBackend,
  InferenceMode
} from 'firebase/ai'

const REQUIRED_PROJECT_FIELDS = ['apiKey', 'projectId', 'appId']
const PLACEHOLDER_VALUES = new Set([
  'PROJECT_ID',
  'YOUR_API_KEY',
  '1:PROJECT_NUMBER:web:YOUR_APP_ID'
])

let hybridService = null
let deviceInitialized = false

function isPlaceholder(value) {
  const normalized = String(value ?? '').trim()
  return !normalized || PLACEHOLDER_VALUES.has(normalized)
}

function missingProjectFields(config) {
  return REQUIRED_PROJECT_FIELDS.filter((field) => isPlaceholder(config?.[field]))
}

function namedError(name, message) {
  const error = new Error(message)
  error.name = name
  return error
}

/** Validate and normalize the three Firebase Web app fields required by AI Logic. */
export function validateFirebaseProjectConfig(config) {
  const missing = missingProjectFields(config)
  if (missing.length > 0) {
    throw namedError(
      'FirebaseConfigError',
      `Firebase project configuration is incomplete: missing ${missing.join(', ')}. ` +
        'Save API key, Project ID, and App ID in Options.'
    )
  }

  return {
    apiKey: String(config.apiKey).trim(),
    projectId: String(config.projectId).trim(),
    appId: String(config.appId).trim(),
    appCheckTokenEndpoint: String(config.appCheckTokenEndpoint ?? '').trim()
  }
}

/** Resolve the project config stored by the options page (empty until the user saves one). */
async function loadProjectConfig() {
  const { firebase_project } = await chrome.storage.local.get('firebase_project')
  return firebase_project ?? null
}

function isDebugHost() {
  return Boolean(
    typeof self !== 'undefined' &&
    self.location &&
    /^(localhost|127\.0\.0\.1)$/.test(self.location.hostname)
  )
}

/**
 * Build a legal App Check provider. Debug mode still supplies a provider instance, but the
 * Firebase SDK performs the debug-token exchange itself. Production requires a real HTTPS
 * token endpoint and fails clearly when it is absent.
 */
function createAppCheckProvider(config, debug) {
  if (debug) {
    return new CustomProvider({
      async getToken() {
        throw new Error('Firebase App Check debug exchange is handled by the Firebase SDK.')
      }
    })
  }

  const endpoint = config.appCheckTokenEndpoint
  if (!endpoint) {
    throw namedError(
      'AppCheckNotConfiguredError',
      'App Check production provider is not configured: set appCheckTokenEndpoint in Options ' +
        'or enable App Check debug mode for local development.'
    )
  }

  let parsedEndpoint
  try {
    parsedEndpoint = new URL(endpoint)
  } catch {
    throw namedError('AppCheckConfigError', 'App Check token endpoint must be a valid HTTPS URL.')
  }
  if (parsedEndpoint.protocol !== 'https:') {
    throw namedError('AppCheckConfigError', 'App Check token endpoint must use HTTPS.')
  }

  return new CustomProvider({
    async getToken() {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ appId: config.appId })
      })
      if (!response.ok) {
        throw new Error(`App Check token endpoint returned HTTP ${response.status}.`)
      }

      const payload = await response.json()
      const token = payload?.token
      const expireTimeMillis = Number(payload?.expireTimeMillis)
      if (
        typeof token !== 'string' ||
        token.length === 0 ||
        !Number.isFinite(expireTimeMillis) ||
        expireTimeMillis <= Date.now()
      ) {
        throw new Error('App Check token endpoint returned an invalid token payload.')
      }
      return { token, expireTimeMillis }
    }
  })
}

/**
 * Lazily wire Firebase + App Check + the AI Logic hybrid model instance.
 * Throws AiLogicNotConfiguredError while placeholders/guest mode is active.
 */
export async function ensureHybridService() {
  if (hybridService) return hybridService

  const storedConfig = await loadProjectConfig()
  if (!storedConfig) {
    throw namedError(
      'AiLogicNotConfiguredError',
      'No Firebase project configured. Save API key, Project ID, and App ID in Options.'
    )
  }

  let config
  try {
    config = validateFirebaseProjectConfig(storedConfig)
  } catch (error) {
    throw namedError('AiLogicNotConfiguredError', error.message)
  }

  const appConfig = {
    apiKey: config.apiKey,
    projectId: config.projectId,
    appId: config.appId
  }
  const app = getApps().length === 0 ? initializeApp(appConfig) : getApps()[0]

  // App Check protects the Gemini API. Debug mode must be armed before initializeAppCheck;
  // the Firebase SDK prints the deterministic debug token that must be safelisted.
  const { appcheck_debug, appcheck_debug_token } = await chrome.storage.local.get([
    'appcheck_debug',
    'appcheck_debug_token'
  ])
  const debug = isDebugHost() || appcheck_debug === true
  if (debug) {
    const token = String(appcheck_debug_token ?? '').trim()
    if (!token) {
      throw namedError(
        'AppCheckNotConfiguredError',
        'App Check debug mode is enabled but no debug token is saved. Paste the registered token in Options.'
      )
    }
    globalThis.FIREBASE_APPCHECK_DEBUG_TOKEN = token
    console.info('[Remembrancer] Firebase App Check debug mode enabled with the token saved in Options.')
  }

  const provider = createAppCheckProvider(config, debug)
  initializeAppCheck(app, { provider: provider, isTokenAutoRefreshEnabled: true })

  const ai = getAI(app, { backend: new GoogleAIBackend() })
  const model = getGenerativeModel(ai, { mode: InferenceMode.PREFER_ON_DEVICE })
  hybridService = { app, ai, model }
  return hybridService
}

/**
 * Per the Chrome Prompt API requirement, initializeDeviceModel() must run after or on a
 * user interaction (a button click) and before any query. Callers pass a UI progress callback.
 */
export async function initializeDeviceModel(onProgress) {
  const { model } = await ensureHybridService()
  if (deviceInitialized) return
  deviceInitialized = true
  if (typeof onProgress === 'function') {
    await model.initializeDeviceModel((val) => onProgress(val))
  } else {
    await model.initializeDeviceModel()
  }
}

/**
 * One summary request through Firebase AI Logic: returns the SDK's response text plus the
 * SDK-reported inference source ("on_device" | "in_cloud") so badges show TRUE provenance.
 */
export async function generateSummaryViaAiLogic(transcript) {
  const started = performance.now()
  const { model } = await ensureHybridService()

  const prompt =
    'You are Remembrancer, a warm family memory assistant. Rewrite the transcript excerpt into ONE ' +
    'concise paragraph (max 90 words), preserving emotion and named people. Reply with only the ' +
    `summary text.\n\nFamily memory excerpt:\n${String(transcript).slice(0, 24000)}`

  const result = await model.generateContent(prompt)
  const response = result.response
  const text = response.text()

  return {
    text,
    inferenceSource: response.inferenceSource,
    elapsedMs: Math.round(performance.now() - started)
  }
}

/** Human-readable provenance label for badges ("on-device" / "in-cloud"). */
export function inferenceLabel(source) {
  if (source === 'on_device') return 'on-device'
  if (source === 'in_cloud') return 'in-cloud'
  return 'unspecified'
}

/** True when a real Firebase project is configured (guest mode = false). */
export async function isAiLogicConfigured() {
  const config = await loadProjectConfig()
  return Boolean(config && missingProjectFields(config).length === 0)
}

/**
 * Cloud fallback: only invoked when strategy allows AND text exceeds threshold.
 */
export async function summarizeInCloud(transcriptText) {
  const config = (await chrome.storage.local.get('remote_config')).remote_config || {}
  if (!config.cloud_summary_enabled) {
    throw new Error('Cloud summary disabled by strategy')
  }

  const result = await generateSummaryViaAiLogic(transcriptText)
  return {
    text: result.text,
    model: 'gemini-3.5-flash-lite',
    inferenceSource: result.inferenceSource,
    elapsedMs: result.elapsedMs
  }
}
