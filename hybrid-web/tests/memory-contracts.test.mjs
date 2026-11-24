import test from 'node:test'
import assert from 'node:assert/strict'
import { memoryBadge } from '../src/lib/memoryPresentation.ts'
import { memoryCollectionPath, memoryDocumentPath } from '../src/lib/memoryPaths.ts'
import { filterMemoriesByMembers } from '../src/lib/memoryVisibility.ts'
import {
  shouldAttemptCloud,
  shouldUseLocalOnly,
  canFallbackAfterCloudFailure
} from '../src/lib/degradationPolicy.ts'

test('only SDK-reported on_device/in_cloud provenance receives an AI badge', () => {
  assert.deepEqual(memoryBadge({ summaryPath: 'firebase-ai-logic', inferenceSource: 'on_device' }), {
    tone: 'cloud',
    label: 'Firebase AI Logic · on-device'
  })
  assert.deepEqual(memoryBadge({ summaryPath: 'firebase-ai-logic', inferenceSource: 'in_cloud' }), {
    tone: 'cloud',
    label: 'Firebase AI Logic · in-cloud'
  })
})

test('local, demo, and unknown paths never receive a cloud badge', () => {
  assert.deepEqual(memoryBadge({ summaryPath: 'extractive-local' }), {
    tone: 'neutral',
    label: 'extractive-local'
  })
  assert.deepEqual(memoryBadge({ summaryPath: 'demo-local' }), {
    tone: 'neutral',
    label: 'demo-local'
  })
  assert.deepEqual(memoryBadge({ summaryPath: 'firebase-ai-logic' }), {
    tone: 'neutral',
    label: 'Firebase AI Logic · source unavailable'
  })
  assert.deepEqual(memoryBadge({ summaryPath: 'mystery-engine' }), {
    tone: 'neutral',
    label: 'local · unspecified'
  })
})

test('Firestore memory paths use one families/{familyId}/memories/{id} contract', () => {
  assert.equal(memoryCollectionPath('family-42'), 'families/family-42/memories')
  assert.equal(memoryDocumentPath('family-42', 'memory-7'), 'families/family-42/memories/memory-7')
})

test('member visibility filters immediately and treats missing visibleTo as shared', () => {
  const memories = [
    { id: 'a', visibleTo: ['dad', 'mom'] },
    { id: 'b', visibleTo: ['teen'] },
    { id: 'c' }
  ]
  assert.deepEqual(filterMemoriesByMembers(memories, ['dad']).map((m) => m.id), ['a', 'c'])
  assert.deepEqual(filterMemoriesByMembers(memories, []), [])
})

test('degradation policy attempts cloud only when allowed and falls back only for graceful', () => {
  assert.equal(shouldAttemptCloud(true, 'graceful'), true)
  assert.equal(shouldAttemptCloud(true, 'none'), true)
  assert.equal(shouldAttemptCloud(true, 'local_only'), false)
  assert.equal(shouldAttemptCloud(true, 'offline'), false)
  assert.equal(shouldAttemptCloud(false, 'none'), false)

  assert.equal(shouldUseLocalOnly('local_only'), true)
  assert.equal(shouldUseLocalOnly('offline'), true)
  assert.equal(shouldUseLocalOnly('graceful'), false)

  assert.equal(canFallbackAfterCloudFailure('graceful'), true)
  assert.equal(canFallbackAfterCloudFailure('none'), false)
  assert.equal(canFallbackAfterCloudFailure('local_only'), false)
  assert.equal(canFallbackAfterCloudFailure('offline'), false)
})
