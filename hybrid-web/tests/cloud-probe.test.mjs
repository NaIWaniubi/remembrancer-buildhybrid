import test from 'node:test'
import assert from 'node:assert/strict'
import { probeGenerativeModel } from '../src/lib/aiProbe.ts'

test('probe sends one minimal generateContent request and records SDK inference source', async () => {
  const calls = []
  const model = {
    async generateContent(prompt) {
      calls.push(prompt)
      return { response: { inferenceSource: 'in_cloud', text: () => 'OK' } }
    }
  }

  const result = await probeGenerativeModel(model)
  assert.equal(calls.length, 1)
  assert.equal(calls[0], 'Reply with OK.')
  assert.equal(result.reachable, true)
  assert.equal(result.inferenceSource, 'in_cloud')
  assert.equal(result.error, undefined)
  assert.ok(result.elapsedMs >= 0)
})

test('probe returns a explicit error instead of pretending the channel is ready', async () => {
  const model = {
    async generateContent() {
      throw new Error('permission denied')
    }
  }

  const result = await probeGenerativeModel(model)
  assert.equal(result.reachable, false)
  assert.match(result.error, /permission denied/)
  assert.ok(result.elapsedMs >= 0)
})

test('probe timeout is reported as a failure', async () => {
  const model = {
    generateContent() {
      return new Promise(() => {})
    }
  }

  const result = await probeGenerativeModel(model, 5)
  assert.equal(result.reachable, false)
  assert.match(result.error, /timed out/i)
})

test('manual probe initializes the device model before generateContent', async () => {
  const calls = []
  const model = {
    async initializeDeviceModel() {
      calls.push('initialize')
    },
    async generateContent(prompt) {
      calls.push(`generate:${prompt}`)
      return { response: { inferenceSource: 'on_device', text: () => 'OK' } }
    }
  }

  const result = await probeGenerativeModel(model, 1000, true)
  assert.deepEqual(calls, ['initialize', 'generate:Reply with OK.'])
  assert.equal(result.reachable, true)
  assert.equal(result.inferenceSource, 'on_device')
})
