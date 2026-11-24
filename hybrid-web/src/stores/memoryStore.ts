import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useFirestoreMemory, type MemoryEntry } from '@/composables/useFirestoreMemory'
import { useRemoteConfig } from '@/composables/useRemoteConfig'
import { analyzeSentiment, type EmotionTag } from '@/lib/sentiment'
import { summarizeLocally, deriveHeadline } from '@/lib/localSummarizer'
import {
  summarizeTranscriptWithFallback,
  probeAiLogic,
  type LongTextResult
} from '@/lib/cloudClient'
import { memoryBadge } from '@/lib/memoryPresentation'
import { filterMemoriesByMembers } from '@/lib/memoryVisibility'
import { shouldAttemptCloud } from '@/lib/degradationPolicy'
import type { InferenceSource } from 'firebase/ai'

export interface PipelineOutcome {
  memoryId: string
  headline: string
  summary: string
  tags: EmotionTag[]
  summaryPath: 'firebase-ai-logic' | 'extractive-local'
  /** SDK-reported provenance ('on_device' | 'in_cloud') when Firebase AI Logic served this run. */
  inferenceSource?: InferenceSource | undefined
  degraded: boolean
  elapsedMs: number
}

export const useMemoryStore = defineStore('memory', () => {
  const {
    memories, loading, backend, pendingSync, syncError,
    loadMemories, subscribeRemote, createMemory, updateMemory
  } = useFirestoreMemory()
  const { config, ready, fetchAndActivate } = useRemoteConfig()

  const currentFamilyId = ref<string>('demo-family')
  const activeMemberIds = ref<string[]>(['dad', 'mom', 'teen', 'grandma'])

  // ----- Derived status for UI badges -----
  const cloudProbe = ref<{
    reachable: boolean
    configured: boolean
    detail: string
    elapsedMs: number
    inferenceSource?: InferenceSource
    error?: string
  } | null>(null)

  const degradationPolicyLabel = computed(() => {
    switch (config.value.degradationPolicy) {
      case 'none': return 'none · fail loudly'
      case 'local_only': return 'local_only · no cloud calls'
      case 'graceful': return 'graceful · local fallback'
      case 'offline': return 'offline · storage only'
      default: return String(config.value.degradationPolicy)
    }
  })

  async function refreshCloudStatus() {
    try {
      cloudProbe.value = await probeAiLogic()
    } catch {
      cloudProbe.value = { reachable: false, configured: false, detail: 'probe-failed', elapsedMs: 0 }
    }
  }

  const visibleMemories = computed(() =>
    filterMemoriesByMembers(memories.value, activeMemberIds.value)
  )

  function setActiveMemberIds(ids: string[]) {
    activeMemberIds.value = [...new Set(ids)]
  }

  async function init(familyId: string = currentFamilyId.value) {
    currentFamilyId.value = familyId
    await Promise.all([loadMemories(familyId), fetchAndActivate()])
    void refreshCloudStatus()
  }

  /**
   * The full hybrid chain, entirely in-browser:
   * transcript → sentiment tags (lexicon engine) → summary (Firebase AI Logic with on-device or
   * in-cloud inference per the SDK's own report, falling back to the local engine) → memory entry
   * → timeline + retrieval QA corpus.
   */
  async function runPipeline(input: {
    transcript: string
    preferCloud: boolean
    visibleTo?: string[]
    createdBy?: string
  }): Promise<PipelineOutcome> {
    const started = performance.now()
    const transcript = input.transcript.trim()
    if (!transcript) throw new Error('Nothing to process — start transcription first.')

    // Always-tag locally (deterministic, offline).
    const sentiment = analyzeSentiment(transcript)

    let summaryText = ''
    let summaryPath: 'firebase-ai-logic' | 'extractive-local' = 'extractive-local'
    let inferenceSource: InferenceSource | undefined
    let degraded = false

    const policy = config.value.degradationPolicy
    const preferCloud = shouldAttemptCloud(
      input.preferCloud && config.value.cloudSummaryEnabled,
      policy
    )

    if (preferCloud) {
      // The cloud client enforces policy: none/fail-loudly throws before anything is saved;
      // only graceful may replace a failed cloud result with a local summary.
      const outcome = await summarizeTranscriptWithFallback(transcript, true, policy)
      summaryText = outcome.summary
      summaryPath = outcome.path
      inferenceSource = outcome.inferenceSource
      degraded = outcome.degraded
    }

    if (!summaryText) {
      const local = summarizeLocally(transcript, 3)
      summaryText = local.summary
      summaryPath = 'extractive-local'
      // The local engine is the designed default — not a degradation.
      degraded = false
    }

    const headline = deriveHeadline(transcript)
    const id = await createMemory({
      familyId: currentFamilyId.value,
      title: headline,
      transcript,
      summary: summaryText,
      emotionTags: sentiment.tags,
      durationSec: estimateDuration(transcript),
      createdBy: input.createdBy ?? 'guest',
      visibleTo: input.visibleTo ?? activeMemberIds.value,
      source: 'web-speech-local',
      summaryPath,
      inferenceSource
    })

    return {
      memoryId: id,
      headline,
      summary: summaryText,
      tags: sentiment.tags,
      summaryPath,
      inferenceSource,
      degraded,
      elapsedMs: Math.round(performance.now() - started)
    }
  }

  /** Long-text mode with headline+tags contract (SDK provenance carried through). */
  async function processLongText(text: string, preferCloud: boolean): Promise<LongTextResult & { degraded: boolean }> {
    return summarizeTranscriptWithFallback(text, preferCloud, config.value.degradationPolicy)
  }

  /** Provenance badge helper bound to this store's pipeline semantics. */
  function badgeFor(path: 'firebase-ai-logic' | 'extractive-local', source?: InferenceSource): string {
    return memoryBadge({ summaryPath: path, inferenceSource: source }).label
  }

  function estimateDuration(transcript: string): number {
    // Rough proxy: ~15 CJK/Latin chars per spoken second.
    return Math.max(1, Math.round(transcript.length / 15))
  }

  function initSubscription(familyId: string = currentFamilyId.value) {
    return subscribeRemote(familyId)
  }

  return {
    memories,
    visibleMemories,
    loading,
    backend,
    pendingSync,
    syncError,
    config,
    ready,
    currentFamilyId,
    activeMemberIds,
    setActiveMemberIds,
    cloudProbe,
    degradationPolicyLabel,
    init,
    refreshCloudStatus,
    runPipeline,
    processLongText,
    badgeFor,
    addMemory: createMemory,
    patchMemory: updateMemory,
    initSubscription
  }
})