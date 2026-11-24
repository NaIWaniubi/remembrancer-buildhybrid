<template>
  <div class="login-view">
    <div class="login-card card">
      <span class="logo-icon" aria-hidden="true">◉</span>
      <h1>Remembrancer</h1>
      <p class="subtitle">
        Sign-in is optional. The guest-first production route runs fully as a guest —
        transcription, summaries, sentiment tags, timeline and archive Q&amp;A all work offline.
      </p>

      <button @click="continueGuest" class="cta primary">
        Continue as guest (offline-ready)
      </button>

      <div v-if="firebaseReady" class="divider"><span>or</span></div>
      <button v-if="firebaseReady" @click="signInWithGoogle" class="cta google">
        <span aria-hidden="true">G</span> Sign in with Google (Firebase Auth)
      </button>

      <p v-if="error" class="error">{{ error }}</p>

      <ul class="notes">
        <li>🔒 No account needed · typed/paste and local processing stay in the browser · microphone and cloud use are opt-in.</li>
        <li>☁️ Firebase AI Logic (the Gemini hybrid channel) activates once a real Firebase project is saved in Settings; the deterministic local engine always remains available underneath.</li>
        <li>📴 Guest mode is the first-class default — the full chain runs offline today.</li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useFirebaseAuth } from '@/composables/useFirebaseAuth'

const router = useRouter()
const { firebaseReady, error, signInWithGoogle } = useFirebaseAuth()

function continueGuest() {
  router.push('/dashboard')
}
</script>

<style scoped>
.login-view { display: flex; align-items: center; justify-content: center; min-height: 70vh; padding: 2rem 1rem; }
.login-card {
  width: 100%;
  max-width: 480px;
  padding: 2.5rem 2rem;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  align-items: center;
}
.logo-icon { color: var(--accent); font-size: 2.4rem; text-shadow: 0 0 18px rgba(129, 140, 248, 0.8); }
h1 { margin: 0; font-size: 1.8rem; }
.subtitle { color: var(--text-muted); font-size: 0.92rem; line-height: 1.6; margin: 0 0 0.5rem; }
.cta { width: 100%; padding: 0.85rem 1.4rem; border-radius: 10px; font-weight: 600; font-size: 0.95rem; border: 1px solid transparent; }
.cta.primary { background: var(--accent-strong); color: white; }
.cta.primary:hover { background: var(--accent); }
.cta.google { background: var(--bg-input); color: var(--text); border-color: var(--border-strong); display: flex; align-items: center; justify-content: center; gap: 0.6rem; }
.cta.google span { width: 1.1rem; height: 1.1rem; border-radius: 50%; background: #e07a00; color: white; display: inline-flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.75rem; }
.divider { position: relative; width: 100%; height: 1px; background: var(--border); margin: 0.4rem 0; }
.divider span { position: absolute; top: -0.65rem; left: 50%; transform: translateX(-50%); background: var(--bg-card); padding: 0 0.8rem; font-size: 0.75rem; color: var(--text-dim); }
.error { color: var(--danger); font-size: 0.82rem; margin: 0; }
.notes { list-style: none; padding: 0; margin: 0.6rem 0 0; display: flex; flex-direction: column; gap: 0.45rem; text-align: left; }
.notes li { font-size: 0.78rem; color: var(--text-dim); line-height: 1.5; }
</style>