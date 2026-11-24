import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const root = new URL('../', import.meta.url)

async function source(relativePath) {
  return readFile(new URL(relativePath, root), 'utf8')
}

test('Firebase build config reads every required VITE_FIREBASE value from env.ts', async () => {
  const env = await source('src/config/env.ts')
  const config = await source('src/config/firebase.config.ts')

  for (const key of ['API_KEY', 'PROJECT_ID', 'AUTH_DOMAIN', 'APP_ID', 'RECAPTCHA_SITE_KEY']) {
    assert.match(env, new RegExp(`VITE_FIREBASE_${key}`))
  }
  assert.match(config, /env\.firebaseApiKey/)
  assert.match(config, /env\.firebaseProjectId/)
  assert.match(config, /env\.firebaseAuthDomain/)
  assert.match(config, /env\.firebaseAppId/)
  assert.doesNotMatch(config, /YOUR_API_KEY|PROJECT_ID|YOUR_APP_ID/)
})

test('App Check uses a real production provider and an env-backed debug provider', async () => {
  const init = await source('src/config/firebase.init.ts')
  assert.match(init, /ReCaptchaEnterpriseProvider/)
  assert.match(init, /CustomProvider/)
  assert.match(init, /isTokenAutoRefreshEnabled:\s*true/)
  assert.match(init, /remembrancer\.appcheck-debug/)
  assert.match(init, /env\.firebaseAppCheckDebugToken/)
  assert.doesNotMatch(init, /remembrancer\.firebase\.debug/)
  assert.doesNotMatch(init, /remembrancer-web-app-check-debug/)
  assert.doesNotMatch(init, /token:\s*['"]{2}/)
})

test('Settings persists appId and uses the unified App Check debug key', async () => {
  const settings = await source('src/components/SettingsPanel.vue')
  assert.match(settings, /fbForm\.appId/)
  assert.match(settings, /appId:\s*fbForm\.appId\.trim\(\)/)
  assert.match(settings, /APP_CHECK_DEBUG_STORAGE_KEY/)
  assert.doesNotMatch(settings, /remembrancer\.firebase\.debug/)
})

test('environment template documents appId, reCAPTCHA site key, and debug token', async () => {
  const example = await source('.env.example')
  assert.match(example, /VITE_FIREBASE_APP_ID=/)
  assert.match(example, /VITE_FIREBASE_RECAPTCHA_SITE_KEY=/)
  assert.match(example, /VITE_FIREBASE_APPCHECK_DEBUG_TOKEN=/)
})

test('demo seeds do not claim Firebase AI Logic provenance', async () => {
  const seeds = await source('src/lib/memoryStore.local.ts')
  assert.doesNotMatch(seeds, /summaryPath:\s*['"]firebase-ai-logic['"]/)
  assert.match(seeds, /summaryPath:\s*['"]demo-local['"]/)
})

test('timeline and member selector are wired to the shared visible memory state', async () => {
  const timeline = await source('src/components/MemoryTimeline.vue')
  const selector = await source('src/components/MemberSelector.vue')
  assert.match(timeline, /store\.visibleMemories/)
  assert.match(timeline, /memoryBadge/)
  assert.match(selector, /store\.setActiveMemberIds/)
})

test('Firestore composable marks pending sync and uses the unified document path', async () => {
  const firestore = await source('src/composables/useFirestoreMemory.ts')
  assert.match(firestore, /pendingSync/)
  assert.match(firestore, /currentUser/)
  assert.match(firestore, /memoryDocumentSegments/)
  assert.doesNotMatch(firestore, /cloud-openai-compat/)
})

test('privacy copy acknowledges explicit microphone opt-in and browser-controlled networking', async () => {
  const voice = await source('src/components/VoiceRecorder.vue')
  const readme = await source('../README.md')
  assert.match(voice, /micConsent/)
  assert.match(voice, /may send audio|may process audio/i)
  assert.doesNotMatch(voice, /No audio bytes are captured or transmitted|nothing leaves your browser/i)
  assert.doesNotMatch(readme, /voice never leaves your browser|no audio bytes are captured|nothing leaves your browser/i)
})

test('cloud probe is backed by a real generateContent call and old compat labels are gone', async () => {
  const cloud = await source('src/lib/cloudClient.ts')
  assert.match(cloud, /probeGenerativeModel/)
  assert.match(cloud, /generateContent/)
  assert.match(cloud, /inferenceSource/)
  assert.doesNotMatch(cloud, /cloud-openai-compat/)
})

test('Firestore rules match the families/{familyId}/memories/{id} code path', async () => {
  const rules = await source('../firestore.rules')
  assert.match(rules, /match \/databases\/\{database\}\/documents/)
  assert.match(rules, /match \/families\/\{familyId\}\/memories\/\{memoryId\}/)
  assert.match(rules, /request\.auth != null/)
  assert.match(rules, /visibleTo/)
})
