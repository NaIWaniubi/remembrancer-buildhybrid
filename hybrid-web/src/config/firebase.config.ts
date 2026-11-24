import { env } from './env'

// Build-time Firebase configuration. Empty values keep the app in guest/local mode.
// Runtime overrides saved from Settings take precedence in firebase.init.ts.
const firebaseConfig = {
  apiKey: env.firebaseApiKey,
  authDomain: env.firebaseAuthDomain || (env.firebaseProjectId ? `${env.firebaseProjectId}.firebaseapp.com` : ''),
  projectId: env.firebaseProjectId,
  storageBucket: env.firebaseStorageBucket,
  messagingSenderId: env.firebaseMessagingSenderId,
  appId: env.firebaseAppId,
  measurementId: env.firebaseMeasurementId
}

export { firebaseConfig }
export default firebaseConfig
