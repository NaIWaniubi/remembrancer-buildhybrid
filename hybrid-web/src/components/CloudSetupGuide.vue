<template>
  <section
    v-if="status === 'placeholder' || status === 'invalid'"
    :class="['cloud-setup card', { compact }]"
    :aria-label="invalid ? 'Firebase setup guide — saved project is invalid' : 'Firebase setup guide'"
  >
    <div class="cs-head">
      <span class="cs-icon" aria-hidden="true">☁️</span>
      <div class="cs-title-block">
        <h3 class="cs-title">Configure Firebase to enable cloud inference</h3>
        <p class="cs-sub" v-if="!invalid">
          No Firebase project is configured yet, so the <strong>Gemini hybrid channel
          (Firebase AI Logic)</strong> stays dormant. Everything else is already live — the local
          engine runs the full chain offline right now.
        </p>
        <p class="cs-sub" v-else>
          The saved Firebase project was rejected by the SDK during init, so the cloud channel
          stays dormant and the app fell back to the <strong>local engine (offline floor)</strong>.
        </p>
        <p class="cs-error" v-if="invalid" role="alert">Init error: {{ setupError }}</p>
      </div>
    </div>

    <ol class="cs-steps" v-if="!compact">
      <li>
        Open <router-link to="/dashboard">Dashboard → Settings</router-link> and paste your
        Firebase project's <em>API key</em> + <em>Project ID</em> + <em>App ID</em>, then “Save project &amp; activate
        AI Logic”.
      </li>
      <li>
        Or bake the values in at build time: copy <code>.env.example</code> to <code>.env</code> and
        fill <code>VITE_FIREBASE_API_KEY</code> / <code>VITE_FIREBASE_PROJECT_ID</code> /
        <code>VITE_FIREBASE_APP_ID</code> / <code>VITE_FIREBASE_RECAPTCHA_SITE_KEY</code>.
      </li>
      <li>
        Follow the step-by-step guide in the repo root:
        <a href="https://firebase.google.com/docs/ai-logic/hybrid/web/get-started" target="_blank" rel="noopener noreferrer">Firebase AI Logic hybrid quickstart</a>
        · <code>firebase-project-setup.md</code> (project creation, App Check debug token, quota windows).
      </li>
    </ol>
    <p class="cs-oneline" v-else>
      Local chain is fully live. To switch on the Gemini hybrid channel:
      <router-link to="/dashboard">Settings → save your Firebase project</router-link>
      · guide: <code>firebase-project-setup.md</code>
    </p>

    <p class="cs-note" role="note">
      Guest mode needs <strong>no key, no account, no quota</strong> — this card is guidance only,
      never a blocker. Nothing you paste here is uploaded until you save a real project.
    </p>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ensureFirebase, firebaseSetupError, type FirebaseStatus } from '@/config/firebase.init'

withDefaults(defineProps<{ compact?: boolean }>(), { compact: false })

const status = ref<FirebaseStatus>('uninitialized')
const setupError = ref('')

onMounted(async () => {
  status.value = await ensureFirebase(false)
  setupError.value = firebaseSetupError()
})

const invalid = computed(() => status.value === 'invalid')
</script>

<style scoped>
.cloud-setup {
  padding: 1.25rem 1.4rem;
  border: 1px solid rgba(129, 140, 248, 0.45);
  background:
    linear-gradient(135deg, rgba(129, 140, 248, 0.10), rgba(129, 140, 248, 0.02)),
    var(--bg-card);
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}
.cloud-setup.compact { padding: 0.8rem 1.1rem; gap: 0.45rem; }
.cs-head { display: flex; gap: 0.9rem; align-items: flex-start; }
.cs-icon { font-size: 1.5rem; line-height: 1.2; }
.cs-title-block { flex: 1; }
.cs-title { margin: 0 0 0.35rem; font-size: 1.02rem; color: var(--text); }
.cs-sub { margin: 0; font-size: 0.84rem; color: var(--text-muted); line-height: 1.6; }
.cs-sub strong { color: var(--text); }
.cs-error {
  margin: 0.5rem 0 0;
  font-size: 0.76rem;
  color: var(--danger);
  font-family: ui-monospace, 'Cascadia Mono', Consolas, monospace;
  word-break: break-word;
}
.cs-steps { list-style: decimal; margin: 0; padding-left: 1.3rem; display: flex; flex-direction: column; gap: 0.45rem; }
.cs-steps li { font-size: 0.82rem; color: var(--text-muted); line-height: 1.6; }
.cs-steps code, .cs-oneline code {
  color: var(--accent);
  font-family: ui-monospace, 'Cascadia Mono', Consolas, monospace;
  font-size: 0.78rem;
}
.cs-oneline { margin: 0; font-size: 0.82rem; color: var(--text-muted); line-height: 1.6; }
.cs-note {
  margin: 0;
  font-size: 0.74rem;
  color: var(--text-dim);
  border-top: 1px solid var(--border);
  padding-top: 0.6rem;
  line-height: 1.55;
}
</style>
