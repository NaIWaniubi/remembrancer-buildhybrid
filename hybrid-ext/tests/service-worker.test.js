import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const serviceWorker = readFileSync(new URL('../src/background/service-worker.js', import.meta.url), 'utf8')

function blockFor(messageType) {
  const marker = `if (message.type === '${messageType}') {`
  const start = serviceWorker.indexOf(marker)
  assert.ok(start >= 0, `missing ${messageType} handler`)
  const end = serviceWorker.indexOf('\n  }', start)
  assert.ok(end > start, `unterminated ${messageType} handler`)
  return serviceWorker.slice(start, end)
}

test('CLOUD_LONGTEXT enforces the degradation policy before summarizing', () => {
  const block = blockFor('CLOUD_LONGTEXT')
  assert.match(block, /assertCloudRequestAllowed\(/)
  assert.ok(
    block.indexOf('assertCloudRequestAllowed(') < block.indexOf('summarizeText('),
    'policy must be checked before any cloud/local fallback work'
  )
  assert.doesNotMatch(block, /degrade[s]? to the local engine automatically/i)
})

test('LOCAL_SUMMARIZE remains available regardless of cloud degradation policy', () => {
  const block = blockFor('LOCAL_SUMMARIZE')
  assert.match(block, /summarizeText\([^\n]*false\)/)
  assert.doesNotMatch(block, /assertCloudRequestAllowed/)
})

test('service worker reads remote_config for policy enforcement', () => {
  assert.match(serviceWorker, /chrome\.storage\.local\.get\(['"]remote_config['"]\)/)
  assert.match(serviceWorker, /degradation_policy/)
})
