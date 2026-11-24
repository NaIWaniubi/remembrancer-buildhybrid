<template>
  <div class="default-layout">
    <header class="site-header">
      <router-link to="/" class="logo">
        <span class="logo-icon" aria-hidden="true">◉</span>
        Remembrancer
      </router-link>
      <nav class="site-nav" aria-label="Primary">
        <router-link to="/dashboard" class="nav-link">Dashboard</router-link>
        <span class="badge" v-if="guest">Guest · offline-ready</span>
        <button v-if="!guest" @click="signOut" class="nav-signout">Sign Out</button>
      </nav>
    </header>
    <main>
      <router-view />
    </main>
    <footer class="site-footer">
      <span>Remembrancer — hybrid edge-cloud family memory engine · production build</span>
    </footer>

    <div v-if="demo.visible" :class="['demo-banner', { flow: !demo.fixed }]" role="note">
      <span class="demo-label">{{ demo.label || 'Demo' }}</span>
      <p class="demo-caption">{{ demo.caption }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useFirebaseAuth } from '@/composables/useFirebaseAuth'
import { useDemoBanner } from '@/composables/useDemoBanner'

const { user, signOut } = useFirebaseAuth()
const guest = computed(() => !user.value)
const demo = useDemoBanner()
</script>

<style scoped>
.default-layout { min-height: 100vh; display: flex; flex-direction: column; }
.site-header {
  padding: 0.9rem 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--border);
  background: rgba(13, 20, 48, 0.85);
  backdrop-filter: blur(8px);
  position: sticky;
  top: 0;
  z-index: 10;
}
.logo { text-decoration: none; font-weight: 700; font-size: 1.15rem; color: var(--text); display: flex; align-items: center; gap: 0.5rem; }
.logo-icon { color: var(--accent); font-size: 1.3rem; text-shadow: 0 0 14px rgba(129, 140, 248, 0.8); }
.site-nav { display: flex; align-items: center; gap: 1rem; }
.nav-link { text-decoration: none; color: var(--text-muted); font-size: 0.9rem; transition: color 140ms ease; }
.nav-link:hover, .nav-link.router-link-active { color: var(--accent); }
.nav-signout {
  background: transparent;
  border: 1px solid var(--border-strong);
  color: var(--text-muted);
  padding: 0.35rem 0.8rem;
  font-size: 0.82rem;
}
.nav-signout:hover { border-color: var(--danger); color: var(--danger); }
main { flex: 1; }
.demo-banner {
  position: fixed;
  bottom: 1.1rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 999;
  max-width: min(620px, calc(100vw - 2rem));
  background: rgba(13, 20, 48, 0.96);
  border: 1px solid rgba(129, 140, 248, 0.55);
  border-radius: 12px;
  padding: 0.8rem 1.1rem;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
}
.demo-banner.flow {
  position: static;
  transform: none;
  margin: 1.5rem auto 0;
  max-width: 620px;
}
.demo-label {
  display: inline-block;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--accent);
  border: 1px solid rgba(129, 140, 248, 0.4);
  background: rgba(129, 140, 248, 0.1);
  padding: 0.15rem 0.6rem;
  border-radius: 999px;
  margin-bottom: 0.4rem;
}
.demo-caption { margin: 0; font-size: 0.82rem; color: var(--text-muted); line-height: 1.5; }
.site-footer {
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--border);
  font-size: 0.78rem;
  color: var(--text-dim);
  text-align: center;
}
</style>