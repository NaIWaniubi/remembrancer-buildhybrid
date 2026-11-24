import test, { afterEach, before } from 'node:test'
import assert from 'node:assert/strict'

let client

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

before(async () => {
  client = await import('../src/shared/cloudClient.js')
})

afterEach(() => {
  delete globalThis.chrome
})

test('graceful policy visibly degrades to local when Firebase is not configured', async () => {
  installChrome({ remote_config: { degradation_policy: 'graceful', cloud_summary_enabled: true } })
  const result = await client.summarizeText('Grandma made dumplings with the family.', true)
  assert.equal(result.ok, true)
  assert.equal(result.path, 'extractive-local')
  assert.equal(result.degraded, true)
  assert.match(result.degradeReason, /No Firebase project configured/i)
})

test('fail-loudly policy never returns a local fallback', async () => {
  installChrome({ remote_config: { degradation_policy: 'fail-loudly', cloud_summary_enabled: true } })
  await assert.rejects(
    client.summarizeText('Grandma made dumplings with the family.', true),
    /No Firebase project configured/i
  )
})

test('none policy is an alias for fail-loudly and never returns a local fallback', async () => {
  installChrome({ remote_config: { degradation_policy: 'none', cloud_summary_enabled: true } })
  await assert.rejects(
    client.summarizeText('Grandma made dumplings with the family.', true),
    /No Firebase project configured/i
  )
})

test('local_only policy rejects an explicit cloud request', async () => {
  installChrome({ remote_config: { degradation_policy: 'local_only', cloud_summary_enabled: true } })
  await assert.rejects(client.summarizeText('Grandma made dumplings.', true), /local_only|local only/i)
})

test('offline policy rejects an explicit cloud request', async () => {
  installChrome({ remote_config: { degradation_policy: 'offline', cloud_summary_enabled: true } })
  await assert.rejects(client.summarizeText('Grandma made dumplings.', true), /offline/i)
})

test('an unknown degradation policy fails closed', async () => {
  installChrome({ remote_config: { degradation_policy: 'mystery', cloud_summary_enabled: true } })
  await assert.rejects(client.summarizeText('Grandma made dumplings.', true), /unknown degradation policy/i)
})

test('disabled cloud summary is a strategy error rather than a silent local result', async () => {
  installChrome({ remote_config: { degradation_policy: 'graceful', cloud_summary_enabled: false } })
  await assert.rejects(client.summarizeText('Grandma made dumplings.', true), /disabled by strategy/i)
})

test('the explicit local action still works under fail-loudly', async () => {
  installChrome({ remote_config: { degradation_policy: 'fail-loudly', cloud_summary_enabled: true } })
  const result = await client.summarizeText('Grandma made dumplings.', false)
  assert.equal(result.ok, true)
  assert.equal(result.path, 'extractive-local')
  assert.equal(result.degraded, false)
})

test('prepareOnDeviceModel is silent only for graceful policy', async () => {
  installChrome({ remote_config: { degradation_policy: 'graceful', cloud_summary_enabled: true } })
  assert.equal(await client.prepareOnDeviceModel(), false)
})

test('prepareOnDeviceModel surfaces errors under fail-loudly', async () => {
  installChrome({ remote_config: { degradation_policy: 'fail-loudly', cloud_summary_enabled: true } })
  await assert.rejects(client.prepareOnDeviceModel(), /No Firebase project configured/i)
})

test('saveCloudConfigToStorage rejects a missing appId with a clear error', async () => {
  const storage = installChrome()
  await assert.rejects(
    client.saveCloudConfigToStorage({ apiKey: 'key', projectId: 'project', appId: '' }),
    /appId/i
  )
  assert.equal(storage.firebase_project, undefined)
})

test('saveCloudConfigToStorage persists App Check production settings explicitly', async () => {
  const storage = installChrome()
  await client.saveCloudConfigToStorage({
    apiKey: 'key',
    projectId: 'project',
    appId: '1:123:web:abc',
    appCheckTokenEndpoint: 'https://example.test/app-check-token',
    appcheck_debug: false
  })
  assert.deepEqual(storage.firebase_project, {
    apiKey: 'key',
    projectId: 'project',
    appId: '1:123:web:abc',
    appCheckTokenEndpoint: 'https://example.test/app-check-token'
  })
  assert.equal(storage.appcheck_debug, false)
})

test('saveCloudConfigToStorage rejects debug mode without a registered token', async () => {
  const storage = installChrome()
  await assert.rejects(
    client.saveCloudConfigToStorage({
      apiKey: 'key',
      projectId: 'project',
      appId: '1:123:web:abc',
      appcheck_debug: true,
      appcheck_debug_token: ''
    }),
    /debug token/i
  )
  assert.equal(storage.firebase_project, undefined)
})

test('saveCloudConfigToStorage persists the registered debug token and reset removes it', async () => {
  const storage = installChrome()
  await client.saveCloudConfigToStorage({
    apiKey: 'key',
    projectId: 'project',
    appId: '1:123:web:abc',
    appcheck_debug: true,
    appcheck_debug_token: '11111111-2222-4333-8444-555555555555'
  })
  assert.equal(storage.appcheck_debug, true)
  assert.equal(storage.appcheck_debug_token, '11111111-2222-4333-8444-555555555555')
  await client.resetCloudConfig()
  assert.equal(storage.appcheck_debug, undefined)
  assert.equal(storage.appcheck_debug_token, undefined)
})
