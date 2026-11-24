<template>
  <section class="voice-recorder card" aria-label="Voice recorder">
    <div class="recorder-head">
      <h3>Live Capture</h3>
      <span class="badge" v-if="state === 'listening'">
        <span class="dot ok"></span> listening · {{ liveChannel }}
      </span>
      <span class="badge cloud" v-else-if="pipelineSummary">{{ pipelineSummary }}</span>
    </div>

    <div class="meter-wrap" aria-hidden="true">
      <div class="meter" :style="{ width: `${level}%` }"></div>
    </div>

    <label v-if="supported" class="mic-consent">
      <input v-model="micConsent" type="checkbox" />
      <span>
        I explicitly allow microphone access for this recording. The browser may ask for permission;
        Web Speech API may process audio on-device or send it to the browser vendor's speech service.
      </span>
    </label>

    <div class="recorder-controls">
      <button
        @click="toggleRecording"
        :disabled="busy || state === 'starting' || (supported && !micConsent)"
        :class="['record-btn', { recording: state === 'listening' }]"
      >
        {{ state === 'listening' ? '⏹ Stop &amp; Process' : (supported ? '🎙 Record &amp; Transcribe' : '⌨ Type / Paste Text') }}
      </button>
      <button @click="onPaste" class="ghost-btn" :disabled="busy">Type / Paste instead</button>
      <span class="status">{{ statusText }}</span>
    </div>

    <div v-if="!supported" class="fallback-hint">
      Web Speech API is unavailable in this browser — using typed/paste mode.
      The whole chain still runs locally.
    </div>

    <div v-if="transcript || interim" class="transcript-output">
      <label for="transcript-output-box">Transcript {{ channelBadge }}</label>
      <textarea id="transcript-output-box" v-model="displayText" rows="4" placeholder="Words appear here as they are spoken…"></textarea>
      <p class="meta" v-if="elapsedSec > 0">spoken for ~{{ elapsedSec }}s · {{ transcript.length }} characters captured</p>
    </div>

    <div v-if="outcome" class="outcome card-inner">
      <h4>Processing outcome</h4>
      <div class="outcome-row">
        <strong>{{ outcome.headline }}</strong>
        <span :class="['badge', outcomeBadgeTone]">
          {{ outcomeBadge }}
        </span>
        <span class="badge warn" v-if="outcome.degraded">degraded → local</span>
        <span class="badge ok" v-else>full chain ok</span>
      </div>
      <p class="summary-text">{{ outcome.summary }}</p>
      <div class="tags">
        <span v-for="tag in outcome.tags" :key="tag" class="tag">#{{ tag }}</span>
      </div>
      <p class="timeline-note">Saved to the timeline below · used as retrieval corpus for Archive Q&amp;A.</p>
    </div>

    <div v-if="deviceProgress !== null" class="device-progress card-inner">
      <h4>Firebase AI Logic · on-device model download</h4>
      <div class="meter-wrap" aria-hidden="true">
        <div class="meter" :style="{ width: `${Math.round(deviceProgress * 100)}%` }"></div>
      </div>
      <p class="meta">{{ Math.round(deviceProgress * 100) }}% downloaded — one-time model setup, per the Chrome Prompt API user-interaction requirement.</p>
    </div>

    <div v-if="error" class="recorder-error" role="alert">{{ error }}</div>

    <details class="engine-details">
      <summary>Engine notes (what runs where)</summary>
      <ul>
        <li><strong>Transcription</strong>: {{ supported ? 'Web Speech API (browser-managed; microphone access requires explicit opt-in)' : 'typed/paste fallback (browser lacks SpeechRecognition)' }}. Depending on the browser and its settings, speech audio may be processed locally or sent to the browser vendor's speech service.</li>
        <li><strong>Sentiment tags</strong>: deterministic lexicon engine in-page.</li>
        <li><strong>Summary</strong>: {{ useCloudToggle ? 'Firebase AI Logic (Gemini Developer API backend, PREFER_ON_DEVICE mode) with automatic local fallback' : 'local extractive engine only' }}.</li>
        <li><strong>Storage</strong>: {{ storageLabel }}.</li>
      </ul>
    </details>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, onBeforeUnmount } from 'vue'
import { SpeechEngine, isSpeechRecognitionSupported, type RecognitionState } from '@/lib/speechRecognition'
import { useMemoryStore } from '@/stores/memoryStore'
import { initializeDeviceModel } from '@/lib/cloudClient'
import { memoryBadge } from '@/lib/memoryPresentation'

const store = useMemoryStore()

// ---------- Web Speech API channel ----------
const supported = isSpeechRecognitionSupported()
const micConsent = ref(false)
let engine: SpeechEngine | null = null

const state = ref<RecognitionState>(supported ? 'idle' : 'unsupported')
const transcript = ref('')     // committed final text
const interim = ref('')        // partial hypothesis
const displayText = computed({
  get: () => [transcript.value, interim.value].filter(Boolean).join(' '),
  set: (v) => { transcript.value = v; interim.value = '' }
})
const busy = ref(false)
const error = ref('')
const outcome = ref<Awaited<ReturnType<typeof store.runPipeline>> | null>(null)
const pipelineSummary = ref('')
const level = ref(0)
const elapsedSec = ref(0)

const liveChannel = computed(() =>
  state.value === 'listening' && engine?.currentLanguage ? `lang ${engine.currentLanguage}` : 'Web Speech API'
)
const channelBadge = computed(() =>
  supported ? '· Web Speech API (browser-managed)' : '· typed / paste mode'
)

// preferCloud toggle persisted locally (family decision without Remote Config)
const useCloudToggle = ref(localStorage.getItem('remembrancer.preferCloud') !== '0')

function setPreferCloud(v: boolean) {
  useCloudToggle.value = v
  try { localStorage.setItem('remembrancer.preferCloud', v ? '1' : '0') } catch { /* ignore */ }
}

// ---------- Mic meter (starts only after explicit opt-in and browser permission) ----------
let audioCtx: AudioContext | null = null
let analyser: AnalyserNode | null = null
let mediaStream: MediaStream | null = null
let rafId = 0

async function startMeter() {
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true })
    audioCtx = new AudioContext()
    const source = audioCtx.createMediaStreamSource(mediaStream)
    analyser = audioCtx.createAnalyser()
    analyser.fftSize = 512
    source.connect(analyser)
    const data = new Uint8Array(analyser.frequencyBinCount)
    const tick = () => {
      if (!analyser) return
      analyser.getByteFrequencyData(data)
      let sum = 0
      for (let i = 0; i < data.length; i += 4) sum += data[i]
      level.value = Math.min(100, Math.round((sum / (data.length / 4)) * 1.6))
      rafId = requestAnimationFrame(tick)
    }
    tick()
  } catch {
    // permission denied or no mic — keep going; typed mode remains usable
    level.value = 0
  }
}

function stopMeter() {
  cancelAnimationFrame(rafId)
  try { mediaStream?.getTracks().forEach((t) => t.stop()) } catch { /* ignore */ }
  try { audioCtx?.close() } catch { /* ignore */ }
  mediaStream = null
  audioCtx = null
  analyser = null
  level.value = 0
}

let timer: ReturnType<typeof setInterval> | null = null

function clearTimer() {
  if (timer) clearInterval(timer)
  timer = null
}

async function toggleRecording() {
  if (state.value === 'listening') {
    if (supported && engine) {
      const t = engine.stop()
      transcript.value = t.finalText || transcript.value
      interim.value = ''
    }
    state.value = 'idle'
    stopMeter()
    clearTimer()
    if (transcript.value.trim()) await processTranscript()
    return
  }
  if (busy.value) return
  await startRecording()
}

async function startRecording() {
  if (!supported) {
    // Browsers without SpeechRecognition switch to typed/paste mode —
    // the rest of the chain is identical.
    const text = window.prompt('Paste the family conversation text (typed / paste fallback mode):')
    if (!text) return
    transcript.value = text.trim()
    await processTranscript()
    return
  }

  if (!micConsent.value) {
    error.value = 'Microphone use requires explicit opt-in. Check the consent box or use Type / Paste.'
    return
  }

  busy.value = true
  error.value = ''
  outcome.value = null
  pipelineSummary.value = ''
  transcript.value = ''
  interim.value = ''
  elapsedSec.value = 0
  state.value = 'starting'

  if (supported) {
    engine = new SpeechEngine({
      onResult: (t) => {
        transcript.value = t.finalText
        interim.value = t.interimText
      },
      onStateChange: (s) => {
        state.value = s
        if (s === 'listening') void startMeter()
        if (s === 'idle') stopMeter()
      },
      onError: (msg, fatal) => {
        error.value = fatal
          ? `Speech recognition failed (${msg}). The typed/paste fallback is available.`
          : `Speech hint: ${msg}`
      }
    })
    try {
      await engine.start()
    } catch (e: any) {
      error.value = e?.message || 'Could not start microphone/SpeechRecognition.'
      state.value = 'idle'
    }
  }

  timer = setInterval(() => { elapsedSec.value++ }, 1000)
  busy.value = false
}

async function processTranscript() {
  const text = displayText.value.trim()
  if (!text) {
    error.value = 'Nothing to process yet — speak/tap record or paste text first.'
    return
  }
  if (supported && engine && state.value !== 'idle') {
    const t = engine.stop()
    transcript.value = t.finalText || transcript.value
    interim.value = ''
    state.value = 'idle'
  }
  clearTimer()

  busy.value = true
  error.value = ''
  outcome.value = null
  pipelineSummary.value = 'preparing on-device model…'
  // Per the Chrome Prompt API requirement: initializeDeviceModel must run after a user
  // interaction (this click) and before any generateContent query. It resolves once the
  // model is ready; when the project isn't configured it throws and we fall back locally.
  await prepareOnDeviceModel()

  pipelineSummary.value = 'processing…'
  try {
    const result = await store.runPipeline({
      transcript: text,
      preferCloud: useCloudToggle.value,
      createdBy: 'guest'
    })
    outcome.value = result
    pipelineSummary.value = outcomeBadge.value
  } catch (e: any) {
    error.value = e?.message || 'Processing failed.'
    pipelineSummary.value = ''
  } finally {
    busy.value = false
  }
}

// expose text-based flow for browsers without SpeechRecognition
async function onPaste() {
  const text = prompt('Paste the family conversation text to process:')
  if (!text) return
  transcript.value = text
  await processTranscript()
}

defineExpose({ processTranscript, onPaste, setPreferCloud })

const statusText = computed(() => {
  if (busy.value) return 'Running the chain in-browser…'
  if (state.value === 'listening') return `Live transcription · ${liveChannel.value}`
  if (state.value === 'starting') return 'Warming up microphone…'
  if (state.value === 'unsupported') return 'Typed / paste mode'
  return outcome.value ? 'Ready — saved to timeline' : 'Ready to capture'
})

const storageLabel = computed(() =>
  store.backend === 'firestore' ? 'Firestore (remote project configured)' : 'localStorage mirror (default)'
)

// ---- Firebase AI Logic on-device model download (Chrome Prompt API requirement) ----
// initializeDeviceModel() must be called after or on a user interaction (this very click)
// and before any query — per the official hybrid quickstart.
const deviceProgress = ref<number | null>(null)

async function prepareOnDeviceModel(): Promise<void> {
  if (useCloudToggle.value && deviceProgress.value === null) {
    deviceProgress.value = 0
    try {
      await initializeDeviceModel((val) => {
        if (typeof val === 'number' && Number.isFinite(val)) deviceProgress.value = val
      })
    } catch (err: any) {
      // A guest/unconfigured project can't host AI Logic: stay silent (the pipeline
      // falls back to the local engine automatically) — never block capture over it.
      console.debug('[Remembrancer] on-device model prewarm skipped:', err?.message || err)
    }
  }
}

/** Real-provenance badge: only SDK-reported on_device/in_cloud values claim AI Logic. */
const outcomeBadge = computed(() => {
  const o = outcome.value
  if (!o) return ''
  return memoryBadge({ summaryPath: o.summaryPath, inferenceSource: o.inferenceSource }).label
})

const outcomeBadgeTone = computed(() => {
  const o = outcome.value
  if (!o) return 'neutral'
  return memoryBadge({ summaryPath: o.summaryPath, inferenceSource: o.inferenceSource }).tone
})

onBeforeUnmount(() => {
  clearTimer()
  stopMeter()
  engine?.stop()
})
</script>

<style scoped>
.voice-recorder { padding: 1.25rem 1.5rem; display: flex; flex-direction: column; gap: 0.9rem; }
.recorder-head { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; }
.recorder-head h3 { margin: 0; font-size: 1.02rem; }
.meter-wrap { height: 6px; border-radius: 999px; background: rgba(255,255,255,0.07); overflow: hidden; }
.meter { height: 100%; width: 0; background: linear-gradient(90deg, var(--accent-strong), var(--success)); transition: width 90ms linear; border-radius: 999px; }
.recorder-controls { display: flex; align-items: center; gap: 0.85rem; flex-wrap: wrap; }
.mic-consent { display: flex; align-items: flex-start; gap: 0.55rem; font-size: 0.76rem; color: var(--text-dim); line-height: 1.5; }
.mic-consent input { margin-top: 0.2rem; }
.ghost-btn { padding: 0.6rem 1rem; background: var(--bg-input); border: 1px solid var(--border-strong); color: var(--text-muted); border-radius: 10px; font-size: 0.86rem; }
.record-btn { padding: 0.65rem 1.35rem; font-size: 0.95rem; font-weight: 600; border-radius: 10px; }
.record-btn:not(.recording) { background: var(--accent-strong); color: white; border-color: transparent; }
.record-btn:not(.recording):hover { background: var(--accent); }
.record-btn.recording { background: var(--danger); color: white; animation: pulse 1.6s ease-in-out infinite; }
@keyframes pulse { 50% { box-shadow: 0 0 0 8px rgba(248, 113, 113, 0.25); } }
.status { font-size: 0.82rem; color: var(--text-dim); }
.fallback-hint { font-size: 0.78rem; color: var(--warning); border: 1px dashed rgba(251,191,36,0.4); background: rgba(251,191,36,0.06); border-radius: 10px; padding: 0.55rem 0.75rem; line-height: 1.5; }
.transcript-output label { font-size: 0.8rem; font-weight: 600; color: var(--text-muted); display: block; margin-bottom: 0.35rem; }
.transcript-output textarea { width: 100%; font-size: 0.88rem; }
.meta { font-size: 0.72rem; color: var(--text-dim); margin: 0.35rem 0 0; }
.card-inner { background: rgba(255,255,255,0.03); border: 1px solid var(--border); border-radius: 12px; padding: 1rem; }
.card-inner h4 { margin: 0 0 0.6rem; font-size: 0.92rem; }
.outcome-row { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; }
.summary-text { font-size: 0.88rem; color: var(--text-muted); line-height: 1.6; margin: 0.7rem 0 0.5rem; }
.tags { display: flex; gap: 0.4rem; flex-wrap: wrap; }
.tag { background: var(--tag-bg); color: var(--accent); font-size: 0.74rem; padding: 0.2rem 0.55rem; border-radius: 999px; border: 1px solid rgba(129,140,248,0.3); }
.timeline-note { font-size: 0.74rem; color: var(--text-dim); margin: 0.6rem 0 0; }
.recorder-error { color: var(--danger); font-size: 0.82rem; background: rgba(248,113,113,0.08); border: 1px solid rgba(248,113,113,0.3); border-radius: 10px; padding: 0.55rem 0.75rem; }
.engine-details summary { font-size: 0.78rem; color: var(--text-dim); cursor: pointer; }
.engine-details ul { margin: 0.5rem 0 0; padding-left: 1.1rem; font-size: 0.76rem; color: var(--text-dim); line-height: 1.6; }
</style>