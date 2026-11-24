import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './styles/theme.css'

const app = createApp(App)

// No-white-screen guard: an unexpected render/hook error must degrade visibly, never leave
// a blank page. The hybrid app's designed failure mode is "local floor keeps running"; the
// handler logs the problem and keeps the mounted tree alive instead of aborting the session.
app.config.errorHandler = (err, _instance, info) => {
  // eslint-disable-next-line no-console
  console.error(`[Remembrancer] UI error (${info}). Local chain is unaffected — no data lost.`, err)
}
window.addEventListener('unhandledrejection', (event) => {
  // Lazy SDK imports / probe failures must not surface as browser-crash dialogs.
  // eslint-disable-next-line no-console
  console.warn('[Remembrancer] Unhandled promise rejected (app continues in local mode):', event.reason)
})

app.use(createPinia())
app.use(router)
try {
  app.mount('#app')
} catch (err) {
  // Mount itself failed (catastrophic): leave a readable message instead of a white screen.
  document.getElementById('app')?.insertAdjacentHTML(
    'afterbegin',
    '<div style="padding:2rem;font-family:system-ui;color:#e7ecff;background:#0b1020;min-height:100vh">' +
      '<h2>Remembrancer could not start</h2>' +
      '<p>The UI failed to mount. The local engines remain available via the standalone scripts.</p>' +
      '<p style="opacity:.7">See the browser console for the error detail.</p></div>'
  )
  // eslint-disable-next-line no-console
  console.error('[Remembrancer] mount failed', err)
}
