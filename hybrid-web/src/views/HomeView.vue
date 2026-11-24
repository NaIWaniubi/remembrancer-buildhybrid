<template>
  <div class="home-view">
    <section class="hero">
      <span class="eyebrow">BuildHybridAI 2026 · Hybrid production build</span>
      <h1>Remembrancer</h1>
      <p class="tagline">
        Hybrid privacy-first family memory engine.<br />
        Start with typed/paste or explicitly opt in to microphone capture; summaries run locally by default.
      </p>
      <div class="hero-cta">
        <router-link to="/login" class="cta">Enter the Dashboard →</router-link>
        <router-link to="/dashboard" class="cta secondary">Continue as guest (offline-ready)</router-link>
      </div>
      <p class="guest-note">
        <span class="dot ok" aria-hidden="true"></span>
        Guest mode is on by default — no API key, no account, no quota, nothing to configure.
        Try the full chain right now: paste or speak a family memory and get an instant local summary
        with sentiment tags. When your family wants Firebase AI Logic summaries, open Settings and
        save your Firebase project.
      </p>
    </section>

    <section class="onboarding card" aria-label="Get started in three steps">
      <h2>Get started in 3 steps</h2>
      <ol class="steps">
        <li class="step">
          <span class="step-no">1</span>
          <div class="step-body">
            <strong>Paste or speak a family voice memory</strong>
            <p>Drop a conversation transcript into Live Capture on the dashboard, or explicitly opt in to
              microphone capture with the Web Speech API in Chrome. Depending on the browser, speech audio
              may be processed locally or by the browser vendor's service.</p>
          </div>
        </li>
        <li class="step">
          <span class="step-no">2</span>
          <div class="step-body">
            <strong>Watch the on-device summary &amp; sentiment tags appear instantly</strong>
            <p>The lexicon engine tags emotion (#nostalgic #tender #joyful…) and the extractive summarizer writes
              the headline + summary in-page — milliseconds, fully offline, nothing uploaded.</p>
          </div>
        </li>
        <li class="step">
          <span class="step-no">3</span>
          <div class="step-body">
            <strong>Open Settings → save your Firebase project → enable Firebase AI Logic</strong>
            <p>The sponsor channel (Gemini Developer API backend, hybrid mode PREFER_ON_DEVICE) then serves
              summaries with real provenance — the SDK reports each response as on-device or in-cloud, which
              lands in the pipeline badge. The local engine keeps working either way.</p>
          </div>
        </li>
      </ol>
    </section>

    <CloudSetupGuide />

    <section class="channels card">
      <h2>Processing Channels — what is live today</h2>
      <div class="channel-grid">
        <div class="channel">
          <span class="dot ok" aria-hidden="true"></span>
          <div>
            <strong>Browser transcription · Web Speech API</strong>
            <p>Browser-native SpeechRecognition — no API key or Gemini quota. Microphone use is opt-in;
              network behavior depends on the browser and its settings.</p>
          </div>
        </div>
        <div class="channel">
          <span class="dot ok" aria-hidden="true"></span>
          <div>
            <strong>Local summary + sentiment engine</strong>
            <p>Deterministic extractive summarizer and lexicon sentiment tags — fully offline, always available as fallback.</p>
          </div>
        </div>
        <div class="channel">
          <span :class="['dot', fbReady ? 'ok' : 'muted']" aria-hidden="true"></span>
          <div>
            <strong>Firebase AI Logic · Gemini (sponsor SDK)</strong>
            <p>{{ fbReady ? 'Project configured — Gemini Developer API backend, PREFER_ON_DEVICE hybrid mode: each response reports real on-device/in-cloud provenance.' : 'Not configured yet. Save your Firebase project in Settings to enable the Gemini hybrid channel; the local engine keeps working.' }}</p>
          </div>
        </div>
        <div class="channel">
          <span class="dot muted" aria-hidden="true"></span>
          <div>
            <strong>Guest mode · local floor</strong>
            <p>No account, no key, no quota — the full chain runs offline until a Firebase project is saved.</p>
          </div>
        </div>
      </div>
    </section>

    <section class="features">
      <div v-for="f in features" :key="f.title" class="feature-card card">
        <span class="icon" aria-hidden="true">{{ f.icon }}</span>
        <h3>{{ f.title }}</h3>
        <p>{{ f.desc }}</p>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ensureFirebase } from '@/config/firebase.init'
import CloudSetupGuide from '@/components/CloudSetupGuide.vue'

// fbReady tracks the REAL init outcome: true only when the SDK reports a usable project
// ('ready'). Guest/unconfigured ('placeholder') and rejected configs ('invalid') keep it
// false so the channel card + setup guide describe the honest state — previously this flag
// flipped true after any ensureFirebase() call, mislabeling guest mode as "Project configured".
const fbReady = ref(false)
onMounted(async () => {
  const status = await ensureFirebase(false)
  fbReady.value = status === 'ready'
})

const features = [
  { icon: '🎙', title: 'Opt-in Transcription', desc: 'Web Speech API streams words live into the transcript area after explicit microphone consent; browser networking behavior varies.' },
  { icon: '✨', title: 'Local-first Summaries', desc: 'Extractive summarizer + sentiment tags run in-page. The chain works with the network cable unplugged.' },
  { icon: '☁️', title: 'Firebase AI Logic (Gemini)', desc: 'The sponsor SDK hybrid channel: Gemini Developer API backend with PREFER_ON_DEVICE mode. The SDK reports each response as on-device or in-cloud — shown in the pipeline badge.' },
  { icon: '🔐', title: 'Family-scoped Memories', desc: 'Member chips control visibility; Firestore security rules mirror this when a project is configured.' },
  { icon: '🔍', title: 'Archive Q&A', desc: 'Ask questions over your timeline — retrieval returns cited excerpts scored from stored memories.' },
  { icon: '⚡', title: 'Graceful Degradation', desc: 'Every channel has a fallback badge. Offline mode is a first-class state, not an error screen.' }
]
</script>

<style scoped>
.home-view { max-width: 1080px; margin: 0 auto; padding: 2rem 1.5rem 4rem; display: flex; flex-direction: column; gap: 2rem; }
.hero { text-align: center; padding: 3.5rem 1rem 1rem; }
.eyebrow {
  font-size: 0.75rem;
  color: var(--accent);
  border: 1px solid rgba(129, 140, 248, 0.35);
  background: rgba(129, 140, 248, 0.08);
  padding: 0.25rem 0.9rem;
  border-radius: 999px;
  letter-spacing: 0.06em;
}
.hero h1 { font-size: 3rem; margin: 1rem 0 0.5rem; background: linear-gradient(120deg, #e7ecff, #818cf8); -webkit-background-clip: text; background-clip: text; color: transparent; }
.tagline { color: var(--text-muted); font-size: 1.05rem; line-height: 1.7; max-width: 560px; margin: 0 auto; }
.hero-cta { display: flex; gap: 1rem; justify-content: center; margin-top: 1.8rem; flex-wrap: wrap; }
.cta {
  padding: 0.7rem 1.6rem;
  background: var(--accent-strong);
  color: white;
  text-decoration: none;
  font-weight: 600;
  border-radius: 10px;
}
.cta:hover { background: var(--accent); }
.cta.secondary { background: var(--bg-input); color: var(--text-muted); border: 1px solid var(--border-strong); }
.guest-note {
  display: flex; align-items: center; gap: 0.55rem;
  margin: 1.5rem auto 0; max-width: 640px;
  font-size: 0.82rem; color: var(--text-muted); line-height: 1.6;
  text-align: left;
}
.onboarding { padding: 1.5rem; }
.onboarding h2 { margin: 0 0 1.2rem; font-size: 1.1rem; color: var(--text); }
.steps { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.9rem; }
.step {
  display: flex; gap: 1rem; align-items: flex-start;
  padding: 1rem 1.1rem;
  background: rgba(255,255,255,0.03);
  border: 1px solid var(--border);
  border-radius: 12px;
}
.step-no {
  flex: none;
  width: 2rem; height: 2rem;
  display: grid; place-items: center;
  border-radius: 999px;
  font-weight: 700; font-size: 0.9rem;
  color: var(--accent);
  background: rgba(129, 140, 248, 0.12);
  border: 1px solid rgba(129, 140, 248, 0.35);
}
.step-body strong { display: block; font-size: 0.92rem; color: var(--text); margin-bottom: 0.3rem; }
.step-body p { margin: 0; font-size: 0.8rem; color: var(--text-dim); line-height: 1.55; }
.channels { padding: 1.5rem; }
.channels h2 { margin-top: 0; font-size: 1.1rem; color: var(--text); }
.channel-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 1rem; }
.channel { display: flex; gap: 0.8rem; align-items: flex-start; padding: 1rem; background: rgba(255,255,255,0.03); border: 1px solid var(--border); border-radius: 12px; }
.channel strong { display: block; font-size: 0.92rem; margin-bottom: 0.3rem; }
.channel p { margin: 0; font-size: 0.82rem; color: var(--text-dim); line-height: 1.55; }
.features { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; }
.feature-card { padding: 1.5rem; }
.icon { font-size: 1.8rem; }
.feature-card h3 { margin: 0.8rem 0 0.4rem; font-size: 1rem; color: var(--text); }
.feature-card p { margin: 0; font-size: 0.86rem; color: var(--text-muted); line-height: 1.55; }
</style>