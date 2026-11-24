import test, { afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { deleteApp, getApps } from 'firebase/app'

const sourceUrl = new URL('../src/lib/firebase-ai-logic.js', import.meta.url)
const bundleUrl = new URL('../src/lib/firebase-ai-logic.bundle.js', import.meta.url)
const source = readFileSync(sourceUrl, 'utf8')
const bundle = readFileSync(bundleUrl, 'utf8')

let importCounter = 0
async function importFresh() {
  importCounter += 1
  return import(`${sourceUrl.href}?test=${importCounter}`)
}

function installChrome(storage = {}) {
  globalThis.chrome = {
    storage: {
      local: {
        async get(keys) {
          if (typeof keys === 'string') return { [keys]: storage[keys] }
          const result = {}
          for (const key of keys ?? Object.keys(storage)) {
            if (Object.hasOwn(storage, key)) result[key] = storage[key]
          }
          return result
        },
        async set(values) {
          Object.assign(storage, values)
        },
        async remove(key) {
          delete storage[key]
        }
      }
    }
  }
  return storage
}

afterEach(async () => {
  delete globalThis.chrome
  await Promise.all(getApps().map((app) => deleteApp(app)))
})

test('isAiLogicConfigured requires a non-placeholder appId', async () => {
  installChrome({
    firebase_project: {
      apiKey: 'real-api-key',
      projectId: 'real-project',
      appId: ''
    }
  })
  const mod = await importFresh()
  assert.equal(await mod.isAiLogicConfigured(), false)
})

test('ensureHybridService reports the missing appId instead of using a placeholder', async () => {
  installChrome({
    firebase_project: {
      apiKey: 'real-api-key',
      projectId: 'real-project',
      appId: ''
    }
  })
  const mod = await importFresh()
  await assert.rejects(mod.ensureHybridService(), /appId/i)
})

test('production App Check fails clearly when no provider endpoint is configured', async () => {
  installChrome({
    firebase_project: {
      apiKey: 'real-api-key',
      projectId: 'real-project',
      appId: '1:123:web:abc'
    },
    appcheck_debug: false
  })
  const mod = await importFresh()
  await assert.rejects(mod.ensureHybridService(), /App Check.*(endpoint|provider)/i)
})

test('debug App Check fails clearly when no registered token is saved', async () => {
  installChrome({
    firebase_project: {
      apiKey: 'real-api-key',
      projectId: 'real-project',
      appId: '1:123:web:abc'
    },
    appcheck_debug: true,
    appcheck_debug_token: ''
  })
  const mod = await importFresh()
  await assert.rejects(mod.ensureHybridService(), /debug token/i)
})

test('App Check initialization receives a provider and auto-refresh option', () => {
  assert.match(source, /initializeAppCheck\(app,\s*\{/)
  assert.match(source, /provider\s*:/)
  assert.match(source, /isTokenAutoRefreshEnabled:\s*true/)
  assert.doesNotMatch(source, /initializeAppCheck\(app\)/)
})

test('debug token mode reads the registered token from extension storage before initialization', () => {
  const debugRead = source.indexOf("'appcheck_debug_token'")
  const debugAssignment = source.indexOf('FIREBASE_APPCHECK_DEBUG_TOKEN = token')
  const appCheckCall = source.indexOf('initializeAppCheck(app,')
  assert.ok(debugRead >= 0, 'debug token storage read is missing')
  assert.ok(debugAssignment >= 0, 'debug token assignment is missing')
  assert.ok(appCheckCall > debugAssignment, 'debug token must be set before initializeAppCheck')
  assert.doesNotMatch(source, /remembrancer-web-app-check-debug/)
  assert.match(source, /console\.(?:log|info|warn)\([^\n]*App Check debug/i)
})

test('generated bundle contains the same App Check options as the source', () => {
  assert.doesNotMatch(bundle, /initializeAppCheck\(app\)\s*;/)
  assert.match(bundle, /isTokenAutoRefreshEnabled:\s*true/)
  assert.match(bundle, /appcheck_debug_token/)
  assert.doesNotMatch(bundle, /remembrancer-web-app-check-debug/)
})

test('bundle source map points at the reviewed wrapper source', () => {
  const map = JSON.parse(readFileSync(new URL('../src/lib/firebase-ai-logic.bundle.js.map', import.meta.url), 'utf8'))
  assert.ok(map.sources.some((entry) => entry.endsWith('firebase-ai-logic.js')))
  assert.ok(map.sourcesContent.some((entry) => typeof entry === 'string' && entry.includes('isTokenAutoRefreshEnabled: true')))
})
