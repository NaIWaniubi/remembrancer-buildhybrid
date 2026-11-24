export interface MemoryBadgeInput {
  summaryPath?: string
  inferenceSource?: string
}

export interface MemoryBadge {
  tone: 'cloud' | 'neutral'
  label: string
}

/** Only SDK-reported on_device/in_cloud values are allowed to claim AI Logic provenance. */
export function memoryBadge(memory: MemoryBadgeInput): MemoryBadge {
  if (memory.summaryPath === 'firebase-ai-logic') {
    if (memory.inferenceSource === 'on_device') {
      return { tone: 'cloud', label: 'Firebase AI Logic · on-device' }
    }
    if (memory.inferenceSource === 'in_cloud') {
      return { tone: 'cloud', label: 'Firebase AI Logic · in-cloud' }
    }
    return { tone: 'neutral', label: 'Firebase AI Logic · source unavailable' }
  }
  if (memory.summaryPath === 'extractive-local') {
    return { tone: 'neutral', label: 'extractive-local' }
  }
  if (memory.summaryPath === 'demo-local') {
    return { tone: 'neutral', label: 'demo-local' }
  }
  return { tone: 'neutral', label: 'local · unspecified' }
}
