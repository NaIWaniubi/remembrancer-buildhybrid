import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import {
  initializeAppCheck,
  CustomProvider,
  ReCaptchaEnterpriseProvider,
  type AppCheck
} from 'firebase/app-check'
import { getFirestore } from 'firebase/firestore'
import { getRemoteConfig } from 'firebase/remote-config'
import firebaseConfig, { firebaseConfig as rawConfig } from './firebase.config'
import { env } from './env'

// Local-first guard: Firebase is initialized only when a real project is configured either at
// build time through VITE_FIREBASE_* or through the runtime Settings override.
const STORAGE_KEY = 'remembrancer.firebase'
export const APP_CHECK_DEBUG_STORAGE_KEY = 'remembrancer.appcheck-debug'
const PLACEHOLDER_MARKERS = ['PROJECT_ID', 'YOUR_API_KEY', 'PROJECT_NUMBER', 'YOUR_APP_ID', 'YOUR_RECAPTCHA_SITE_KEY']

export interface RuntimeFirebaseConfig {
  apiKey?: string
  projectId?: string
  authDomain?: string
  appId?: string
}

function loadRuntimeFirebaseConfig(): RuntimeFirebaseConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as RuntimeFirebaseConfig
  } catch {
    return {}
  }
}

export function saveRuntimeFirebaseConfig(cfg: RuntimeFirebaseConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg))
  } catch {
    /* storage unavailable */
  }
}

function isPlaceholder(value: string | undefined): boolean {
  const trimmed = value?.trim() ?? ''
  return !trimmed || PLACEHOLDER_MARKERS.some((marker) => trimmed.includes(marker))
}

export type ResolvedFirebase = {
  config: typeof rawConfig
  source: 'runtime' | 'build'
} | null

/** Resolve which Firebase config applies right now (without initializing anything). */
export function resolveFirebase(): ResolvedFirebase {
  const runtime = loadRuntimeFirebaseConfig()
  const runtimeProjectId = runtime.projectId?.trim()
  const runtimeApiKey = runtime.apiKey?.trim()
  const runtimeAppId = runtime.appId?.trim() || rawConfig.appId

  if (
    !isPlaceholder(runtimeApiKey) &&
    !isPlaceholder(runtimeProjectId) &&
    !isPlaceholder(runtimeAppId)
  ) {
    return {
      config: {
        ...rawConfig,
        apiKey: runtimeApiKey!,
        projectId: runtimeProjectId!,
        authDomain: runtime.authDomain?.trim() || `${runtimeProjectId}.firebaseapp.com`,
        appId: runtimeAppId,
        storageBucket: rawConfig.storageBucket || `${runtimeProjectId}.appspot.com`,
        messagingSenderId: rawConfig.messagingSenderId,
        measurementId: rawConfig.measurementId
      },
      source: 'runtime'
    }
  }

  if (
    !isPlaceholder(rawConfig.apiKey) &&
    !isPlaceholder(rawConfig.projectId) &&
    !isPlaceholder(rawConfig.appId)
  ) {
    return { config: rawConfig, source: 'build' }
  }

  return null
}

/**
 * 'placeholder'  = no project configured (the designed guest default)
 * 'invalid'      = a config exists but the SDK rejected it during init
 */
export type FirebaseStatus = 'uninitialized' | 'ready' | 'placeholder' | 'invalid'

interface FirebaseState {
  ready: boolean
  status: FirebaseStatus
  source: string
  config: typeof rawConfig | null
  /** Human-readable reason when Firebase or App Check initialization failed. */
  setupError: string
  app: FirebaseApp | null
  auth: ReturnType<typeof getAuth> | null
  googleProvider: GoogleAuthProvider | null
  db: ReturnType<typeof getFirestore> | null
  remoteConfig: ReturnType<typeof getRemoteConfig> | null
  /** App Check instance (protects the Gemini API for AI Logic). */
  appCheck: AppCheck | null
  /** Explicit App Check configuration/initialization error, surfaced by probe and Settings. */
  appCheckError: string
}

const state: FirebaseState = {
  ready: false,
  status: 'uninitialized',
  source: 'none',
  config: null,
  setupError: '',
  app: null,
  auth: null,
  googleProvider: null,
  db: null,
  remoteConfig: null,
  appCheck: null,
  appCheckError: ''
}

/**
 * App Check debug token is read from VITE_FIREBASE_APPCHECK_DEBUG_TOKEN so the real value
 * stays in the ignored local .env file. Register it in Firebase Console → App Check →
 * your Web app → Manage debug tokens.
 */
function getAppCheckDebugToken(): string {
  const token = env.firebaseAppCheckDebugToken
  if (!token) {
    throw new Error(
      'App Check debug mode is enabled but VITE_FIREBASE_APPCHECK_DEBUG_TOKEN is empty. ' +
        'Add the registered debug token to hybrid-web/.env.local and rebuild.'
    )
  }
  return token
}

/** The single debug switch used by both Firebase initialization and the Settings UI. */
export function isAppCheckDebugEnabled(): boolean {
  try {
    return localStorage.getItem(APP_CHECK_DEBUG_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function armAppCheckDebug(): boolean {
  if (!isAppCheckDebugEnabled() || typeof self === 'undefined') return false
  ;(self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean | string }).FIREBASE_APPCHECK_DEBUG_TOKEN =
    getAppCheckDebugToken()
  return true
}

function logDebugTokenBanner(): void {
  console.log(
    '[Remembrancer][App Check] Debug provider armed from VITE_FIREBASE_APPCHECK_DEBUG_TOKEN. ' +
      'The token value is intentionally not logged.'
  )
}

function createDebugProvider(): InstanceType<typeof CustomProvider> {
  const token = getAppCheckDebugToken()
  return new CustomProvider({
    getToken: async () => ({
      token,
      expireTimeMillis: Date.now() + 60 * 60 * 1000
    })
  })
}

function createProductionProvider(): InstanceType<typeof ReCaptchaEnterpriseProvider> {
  const siteKey = env.firebaseRecaptchaSiteKey
  if (isPlaceholder(siteKey)) {
    throw new Error(
      'App Check production provider is not configured. Set VITE_FIREBASE_RECAPTCHA_SITE_KEY ' +
        'or enable the remembrancer.appcheck-debug switch for local development.'
    )
  }
  return new ReCaptchaEnterpriseProvider(siteKey)
}

/**
 * Lazily initialize Firebase once a real project config exists. Missing configuration is the
 * designed guest default. App Check failures are retained and surfaced explicitly; they never
 * silently produce an empty token.
 */
export async function ensureFirebase(force = false): Promise<FirebaseStatus> {
  if (state.ready && !force) return state.status

  const resolved = resolveFirebase()
  if (!resolved) {
    Object.assign(state, {
      ready: false,
      status: 'placeholder',
      source: 'none',
      config: null,
      setupError: '',
      appCheck: null,
      appCheckError: ''
    })
    return state.status
  }

  const { config, source } = resolved
  try {
    const app = getApps().length === 0 ? initializeApp(config) : getApps()[0]
    const debugArmed = armAppCheckDebug()
    if (debugArmed) logDebugTokenBanner()

    let appCheckInstance: AppCheck | null = null
    let appCheckError = ''
    try {
      const provider = debugArmed ? createDebugProvider() : createProductionProvider()
      appCheckInstance = initializeAppCheck(app, {
        provider,
        isTokenAutoRefreshEnabled: true
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      appCheckError = message
      console.warn('[Remembrancer] App Check initialization failed:', message)
    }

    const auth = getAuth(app)
    Object.assign(state, {
      ready: true,
      status: 'ready',
      source,
      config,
      setupError: '',
      app,
      auth,
      googleProvider: new GoogleAuthProvider(),
      db: getFirestore(app),
      remoteConfig: getRemoteConfig(app),
      appCheck: appCheckInstance,
      appCheckError
    })
    return state.status
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.warn('[Remembrancer] Firebase init failed — running local-only. See Settings / setup guide.', message)
    Object.assign(state, {
      ready: false,
      status: 'invalid',
      source: 'none',
      config: null,
      setupError: message.slice(0, 200),
      appCheck: null,
      appCheckError: ''
    })
    return state.status
  }
}

/** Human-readable reason when the last init attempt failed ('' when none). */
export function firebaseSetupError(): string {
  return state.setupError || state.appCheckError
}

export function isFirebaseReady(): boolean {
  return state.ready && state.status === 'ready'
}

export function useFirebaseState(): FirebaseState {
  return state
}
