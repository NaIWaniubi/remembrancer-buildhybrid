<template>
  <section class="settings-panel card" aria-label="Settings">
    <div class="sp-head">
      <h3>Settings — Firebase AI Logic &amp; strategy</h3>
      <span :class="['badge', probeResult ? (probeResult.reachable ? 'cloud' : probeResult.configured ? 'warn' : 'offline') : 'offline']">
        {{ aiLogicBadge }}
      </span>
    </div>

    <!-- Section 1: channel status -->
    <div class="sp-section">
      <h4>Channels &amp; status</h4>
      <ul class="channel-list">
        <li>
          <span :class="['badge', speechSupported ? 'ok' : 'warn']">{{ speechSupported ? 'ready' : 'fallback' }}</span>
          Transcription — {{ speechSupported ? 'Web Speech API (browser-managed)' : 'typed/paste fallback' }}
          <span class="muted">(network behavior depends on the browser)</span>
        </li>
        <li>
          <span class="badge ok">ready</span>
          Local engine — sentiment tags + extractive summary, fully offline (the floor beneath every channel)
        </li>
        <li>
          <span :class="['badge', probeResult?.reachable ? 'cloud' : (probeResult?.configured ? 'warn' : 'offline')]">
            {{ probeResult?.reachable ? 'READY · generateContent ok' : (probeResult?.configured ? 'generateContent failed' : 'local-only') }}
          </span>
          Firebase AI Logic — Gemini Developer API backend, hybrid mode PREFER_ON_DEVICE
          <span class="muted">(the sponsor cloud channel; on-device or in-cloud per each response)</span>
        </li>
        <li>
          <span :class="['badge', appCheckNote.startsWith('debug') ? 'ok' : 'warn']">{{ appCheckNote }}</span>
          App Check — protects the Gemini API (auto-enforced since Nov 2026); local builds use the debug provider
        </li>
      </ul>
    </div>

    <!-- Section 2: Firebase project + AI Logic -->
    <div class="sp-section">
      <h4>Firebase project <span class="muted">(step 3 of the first-run guide — enables the sponsor cloud channel)</span></h4>
      <div class="sp-grid">
        <label class="field">
          <span>API key</span>
          <input v-model="fbForm.apiKey" type="password" placeholder="YOUR_API_KEY" autocomplete="off" />
        </label>
        <label class="field">
          <span>Project ID</span>
          <input v-model="fbForm.projectId" type="text" placeholder="PROJECT_ID" />
        </label>
        <label class="field">
          <span>App ID</span>
          <input v-model="fbForm.appId" type="text" placeholder="1:PROJECT_NUMBER:web:YOUR_APP_ID" />
        </label>
        <label class="field">
          <span>Auth domain (optional)</span>
          <input v-model="fbForm.authDomain" type="text" placeholder="PROJECT_ID.firebaseapp.com" />
        </label>
      </div>
      <label class="field compact app-check-toggle">
        <input v-model="appCheckDebug" type="checkbox" @change="persistAppCheckDebug" />
        <span>Use App Check debug provider (local/evaluation only; register the printed token)</span>
      </label>
      <div class="probe-row">
        <button @click="saveFirebase" class="probe-btn">Save project &amp; activate AI Logic</button>
        <button @click="runProbe(true)" :disabled="probing" class="ghost-btn">
          {{ probing ? 'Probing…' : 'Probe Firebase AI Logic' }}
        </button>
        <span v-if="probeResult" :class="['badge', probeResult.reachable ? 'ok' : (probeResult.configured ? 'warn' : 'offline')]">
          {{ probeResult.reachable ? `ready (${probeResult.detail})` : (probeResult.configured ? `unreachable · ${probeResult.detail}` : probeResult.detail) }}
        </span>
      </div>
      <p class="hint">
        A real project switches on Firebase Auth, Firestore sync, Remote Config and — with the AI Logic
        guided setup completed — the Gemini hybrid channel. Production App Check also requires
        <code>VITE_FIREBASE_RECAPTCHA_SITE_KEY</code>. Guest mode stays the default until you save.
      </p>
    </div>

    <!-- Section 3: degradation strategy -->
    <div class="sp-section">
      <h4>Degradation strategy</h4>
      <div class="strategy-row">
        <label class="field">
          <span>Policy</span>
          <select v-model="form.degradationPolicy">
            <option value="none">none — fail loudly</option>
            <option value="local_only">local_only — no cloud calls</option>
            <option value="graceful">graceful — local fallback (recommended)</option>
            <option value="offline">offline — storage only</option>
          </select>
        </label>
        <label class="field compact">
          <span>Prefer Firebase AI Logic for new memories</span>
          <input v-model="form.preferCloud" type="checkbox" />
        </label>
      </div>
      <p class="hint">
        With <strong>graceful</strong>, a memory whose AI Logic request fails or times out is still saved,
        summarized by the local engine, and badged “degraded → local”. Guest mode and the local mirror never depend
        on this choice.
      </p>
    </div>

    <!-- Section 4: data & reset -->
    <div class="sp-section">
      <h4>Data &amp; reset</h4>
      <div class="actions">
        <button @click="saveStrategy" class="save-btn">Save settings</button>
        <button @click="resetToLocalOnly" class="ghost-btn">Reset to guest / local-only</button>
      </div>
      <p class="note">
        Saved locally in this browser (the offline-first equivalent of Remote Config): strategy in
        <code>remembrancer.remoteConfig</code>, prefer-AI-Logic flag in <code>remembrancer.preferCloud</code>.
        Typed/paste text and the local summary engine stay in this browser. Microphone use is opt-in,
        and Web Speech API networking depends on the browser. Firebase AI Logic receives text only when
        a real project is saved and cloud processing is enabled.
      </p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { probeAiLogic } from '@/lib/cloudClient'
import {
  saveRuntimeFirebaseConfig,
  ensureFirebase,
  firebaseSetupError,
  isAppCheckDebugEnabled,
  APP_CHECK_DEBUG_STORAGE_KEY
} from '@/config/firebase.init'
import { saveStrategyOverride, type RemoteConfigState } from '@/composables/useRemoteConfig'
import { isSpeechRecognitionSupported } from '@/lib/speechRecognition'

const emit = defineEmits<{ (e: 'saved'): void }>()

const speechSupported = isSpeechRecognitionSupported()

const form = reactive({
  degradationPolicy: 'graceful' as RemoteConfigState['degradationPolicy'],
  preferCloud: true
})

// hydrate preferCloud + degradation policy from local runtime state
function hydrate() {
  try {
    const raw = localStorage.getItem('remembrancer.strategy')
    if (raw) {
      const parsed = JSON.parse(raw)
      form.degradationPolicy = parsed.degradationPolicy ?? 'graceful'
      form.preferCloud = parsed.preferCloud !== false
    }
  } catch {
    /* ignore */
  }
  try {
    const pref = localStorage.getItem('remembrancer.preferCloud')
    form.preferCloud = pref === '0' ? false : pref === '1' ? true : true
  } catch {
    /* ignore */
  }
}
hydrate()

async function refreshReady() {
  await ensureFirebase(false)
}

onMounted(async () => {
  await refreshReady()
  void runProbe()
})

const fbForm = reactive({
  apiKey: '',
  projectId: '',
  appId: '',
  authDomain: ''
})

const appCheckDebug = ref(isAppCheckDebugEnabled())

function persistAppCheckDebug() {
  try {
    localStorage.setItem(APP_CHECK_DEBUG_STORAGE_KEY, appCheckDebug.value ? '1' : '0')
  } catch {
    /* storage unavailable */
  }
}

function hydrateFirebase() {
  try {
    const raw = localStorage.getItem('remembrancer.firebase')
    if (!raw) return
    const cfg = JSON.parse(raw)
    fbForm.apiKey = cfg.apiKey ?? ''
    fbForm.projectId = cfg.projectId ?? ''
    fbForm.appId = cfg.appId ?? ''
    fbForm.authDomain = cfg.authDomain ?? ''
  } catch {
    /* ignore */
  }
}
hydrateFirebase()

async function saveFirebase() {
  persistAppCheckDebug()
  saveRuntimeFirebaseConfig({
    apiKey: fbForm.apiKey.trim(),
    projectId: fbForm.projectId.trim(),
    appId: fbForm.appId.trim(),
    authDomain: fbForm.authDomain.trim()
  })
  window.location.reload()
}

const probeResult = ref<Awaited<ReturnType<typeof probeAiLogic>> | null>(null)
const probing = ref(false)
const appCheckNote = ref('checking…')

async function runProbe(initializeDevice = false) {
  probing.value = true
  appCheckNote.value = 'checking…'
  try {
    probeResult.value = await probeAiLogic(initializeDevice ? 180_000 : 6000, initializeDevice)
  } finally {
    probing.value = false
  }
  // App Check attestation status is informational: whether the debug provider is armed.
  const setupError = firebaseSetupError()
  appCheckNote.value = setupError
    ? `App Check error: ${setupError.slice(0, 80)}`
    : isAppCheckDebugEnabled()
      ? 'debug provider armed (localhost)'
      : 'prod provider (reCAPTCHA Enterprise)'
}

/** Header badge text: what actually runs today. */
const aiLogicBadge = computed(() => {
  if (!probeResult.value) return 'probing…'
  if (!probeResult.value.configured) return 'guest mode · local floor'
  return probeResult.value.reachable ? 'AI Logic ready' : 'project set · channel pending'
})

function saveStrategy() {
  localStorage.setItem('remembrancer.strategy', JSON.stringify({
    degradationPolicy: form.degradationPolicy,
    preferCloud: form.preferCloud
  }))
  saveStrategyOverride({
    degradationPolicy: form.degradationPolicy,
    cloudSummaryEnabled: true
  })
  localStorage.setItem('remembrancer.preferCloud', form.preferCloud ? '1' : '0')
  void emit
  window.location.reload()
}

function resetToLocalOnly() {
  try { localStorage.removeItem('remembrancer.firebase') } catch { /* ignore */ }
  fbForm.apiKey = ''
  fbForm.projectId = ''
  fbForm.appId = ''
  fbForm.authDomain = ''
  localStorage.setItem('remembrancer.preferCloud', '0')
  window.location.reload()
}
</script>

<style scoped>
.settings-panel { padding: 1.25rem 1.5rem; display: flex; flex-direction: column; gap: 0.9rem; }
.sp-head { display: flex; align-items: center; justify-content: space-between; gap: 0.7rem; flex-wrap: wrap; }
.sp-head h3 { margin: 0; font-size: 1.02rem; }
.sp-section {
  border-top: 1px solid var(--border);
  padding-top: 0.9rem;
  display: flex; flex-direction: column; gap: 0.7rem;
}
.sp-section h4 { margin: 0; font-size: 0.86rem; color: var(--text); }
.sp-section h4 .muted { font-weight: 400; font-size: 0.74rem; color: var(--text-dim); }
.channel-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.45rem; }
.channel-li, .channel-list li { display: flex; align-items: center; gap: 0.6rem; font-size: 0.8rem; color: var(--text-muted); line-height: 1.5; }
.channel-list .muted { color: var(--text-dim); }
.sp-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.8rem; }
.field { display: flex; flex-direction: column; gap: 0.35rem; font-size: 0.78rem; color: var(--text-muted); }
.field input { font-size: 0.84rem; }
.strategy-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 0.8rem; }
.field.compact { flex-direction: row; align-items: center; gap: 0.6rem; }
.field.compact input { width: auto; }
.hint { font-size: 0.74rem; color: var(--text-dim); margin: 0; line-height: 1.55; }
.probe-row { display: flex; align-items: center; gap: 0.7rem; flex-wrap: wrap; }
.probe-btn { padding: 0.45rem 1rem; background: var(--accent-strong); border-color: transparent; color: white; font-size: 0.82rem; font-weight: 600; }
.probe-btn:hover { background: var(--accent); }
.ghost-btn { padding: 0.45rem 1rem; background: var(--bg-input); border: 1px solid var(--border-strong); color: var(--text-muted); font-size: 0.82rem; }
.actions { display: flex; gap: 0.7rem; flex-wrap: wrap; }
.save-btn { padding: 0.55rem 1.3rem; background: var(--accent-strong); color: white; border-color: transparent; font-weight: 600; }
.save-btn:hover { background: var(--accent); }
.note { font-size: 0.74rem; color: var(--text-dim); margin: 0; line-height: 1.5; }
.note code { color: var(--accent); }
</style>