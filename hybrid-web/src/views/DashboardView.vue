<template>
  <div class="dashboard-view">
    <div class="dash-header">
      <div>
        <h2>Family Dashboard</h2>
        <p class="dash-sub">
          Degraded production route — guest mode · storage:
          <span class="storage">{{ store.backend === 'firestore' ? 'Firestore' : 'localStorage mirror' }}{{ store.pendingSync ? ' · pending sync' : '' }}</span>
        </p>
      </div>
      <div class="status-stack">
        <span :class="['badge', speechSupported ? 'ok' : 'warn']">
          <span :class="['dot', speechSupported ? 'ok' : 'muted']"></span>
          transcription {{ speechSupported ? 'Web Speech API ready' : 'typed/paste fallback' }}
        </span>
        <span :class="['badge', store.config.cloudSummaryEnabled ? 'cloud' : 'offline']">
          summary strategy: {{ store.degradationPolicyLabel }}
        </span>
        <span
          v-if="store.cloudProbe"
          :class="['badge', store.cloudProbe.reachable ? 'cloud' : 'offline']"
        >
          Firebase AI Logic: {{ store.cloudProbe.configured ? (store.cloudProbe.reachable ? 'generateContent ready' : 'probe failed') : 'guest mode · local floor' }}
        </span>
        <span class="badge">◉ Gemini hybrid mode PREFER_ON_DEVICE (Firebase AI Logic)</span>
      </div>
    </div>

    <CloudSetupGuide compact />

    <VoiceRecorder />

    <div class="dash-grid">
      <MemoryTimeline />
      <RetrievalQA />
    </div>

    <MemberSelector />
    <SettingsPanel />

    <footer class="dash-footnote">
      Typed/paste and the local engine run without a network dependency. Microphone capture is opt-in;
      Web Speech API networking depends on the browser. Firebase AI Logic activates only after a real project is saved.
    </footer>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useMemoryStore } from '@/stores/memoryStore'
import VoiceRecorder from '@/components/VoiceRecorder.vue'
import MemoryTimeline from '@/components/MemoryTimeline.vue'
import MemberSelector from '@/components/MemberSelector.vue'
import RetrievalQA from '@/components/RetrievalQA.vue'
import SettingsPanel from '@/components/SettingsPanel.vue'
import CloudSetupGuide from '@/components/CloudSetupGuide.vue'
import { isSpeechRecognitionSupported } from '@/lib/speechRecognition'

const store = useMemoryStore()
const speechSupported = isSpeechRecognitionSupported()

onMounted(() => {
  void store.init(store.currentFamilyId || 'demo-family')
})
</script>

<style scoped>
.dashboard-view { max-width: 1080px; margin: 0 auto; padding: 1.5rem; display: flex; flex-direction: column; gap: 1.25rem; }
.dash-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; flex-wrap: wrap; }
.dash-header h2 { margin: 0; font-size: 1.4rem; }
.dash-sub { margin: 0.3rem 0 0; font-size: 0.8rem; color: var(--text-dim); }
.storage { color: var(--accent); }
.status-stack { display: flex; flex-direction: column; gap: 0.45rem; align-items: flex-end; }
.dash-grid { display: grid; grid-template-columns: 3fr 2fr; gap: 1.25rem; align-items: start; }
@media (max-width: 900px) { .dash-grid { grid-template-columns: 1fr; } }
.dash-footnote { font-size: 0.75rem; color: var(--text-dim); text-align: center; padding-top: 0.5rem; border-top: 1px solid var(--border); }
</style>