// Runtime environment access for Remembrancer web app.
// Vite exposes VITE_* variables at build time via import.meta.env.
// All values are placeholders by default — the app runs fully without them.

function readEnv(key: string): string {
  const raw = (import.meta.env as Record<string, string | undefined>)[key]
  return typeof raw === 'string' ? raw.trim() : ''
}

export const env = {
  firebaseApiKey: readEnv('VITE_FIREBASE_API_KEY'),
  firebaseProjectId: readEnv('VITE_FIREBASE_PROJECT_ID'),
  firebaseAuthDomain: readEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  firebaseAppId: readEnv('VITE_FIREBASE_APP_ID'),
  firebaseStorageBucket: readEnv('VITE_FIREBASE_STORAGE_BUCKET'),
  firebaseMessagingSenderId: readEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  firebaseMeasurementId: readEnv('VITE_FIREBASE_MEASUREMENT_ID'),
  firebaseRecaptchaSiteKey: readEnv('VITE_FIREBASE_RECAPTCHA_SITE_KEY'),
  firebaseAppCheckDebugToken: readEnv('VITE_FIREBASE_APPCHECK_DEBUG_TOKEN')
}

// A placeholder marker means "user has not filled this in yet".
export const PLACEHOLDER_MARKERS = ['YOUR_API_KEY', 'PROJECT_ID', 'YOUR_APP_ID', 'PROJECT_NUMBER']

export function isPlaceholder(value: string): boolean {
  return value === '' || PLACEHOLDER_MARKERS.some((m) => value.includes(m))
}
