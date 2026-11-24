// Cloud side of Remembrancer's hybrid architecture: **Firebase AI Logic** — the sponsor SDK,
// consumed exactly per its official hybrid quickstart
// (https://firebase.google.com/docs/ai-logic/hybrid/web/get-started):
//
//   import { getAI, getGenerativeModel, GoogleAIBackend, InferenceMode } from "firebase/ai";
//   const ai = getAI(firebaseApp, { backend: new GoogleAIBackend() });
//   const model = getGenerativeModel(ai, { mode: InferenceMode.PREFER_ON_DEVICE });
//   // after (or on) a user interaction, and before any query:
//   await model.initializeDeviceModel((val) => /* UI progress state */);
//   const result = await model.generateContent(prompt);
//   const text = result.response.text();
//   const source = result.response.inferenceSource; // "on_device" | "in_cloud" — real provenance
//
// Hackathon rules explicitly forbid calling other model APIs directly, so this module contains NO
// third-party chat-completions endpoints (the former Yunwu / OpenAI-compatible client was removed).
// The deterministic local engine (./localSummarizer + ./sentiment) remains the offline floor beneath
// every path: nothing here can make the pipeline unusable.

import { ensureFirebase, useFirebaseState, firebaseSetupError } from '@/config/firebase.init'
import { probeGenerativeModel } from '@/lib/aiProbe'
import { canFallbackAfterCloudFailure, shouldUseLocalOnly } from '@/lib/degradationPolicy'
import type { DegradationPolicy } from '@/config/remote-config.strategy'
import {
  getAI,
  getGenerativeModel,
  GoogleAIBackend,
  InferenceMode,
  type AI,
  type GenerativeModel,
  type InferenceSource
} from 'firebase/ai'

export class AiNotConfiguredError extends Error {
  constructor() {
    super(
      'No Firebase project configured. Set your Firebase config in Settings (or .env) to enable ' +
        'the Firebase AI Logic cloud channel, or choose the local-only policy.'
    )
  }
}

export type AiLogicPath = 'firebase-ai-logic' | 'extractive-local'

export interface LongTextResult {
  headline: string
  summary: string
  tags: string[]
  path: AiLogicPath
  /** SDK-reported provenance for this run ('on_device' | 'in_cloud'), when used. */
  inferenceSource?: InferenceSource | undefined
  degraded: boolean
  elapsedMs?: number
}

interface HybridService {
  app: NonNullable<ReturnType<typeof useFirebaseState>['app']>
  ai: AI
  model: GenerativeModel
}

let service: HybridService | null = null
let deviceInitialized = false

/** Human-readable provenance label for badges ("on-device" / "in-cloud"). */
export function inferenceLabel(source: InferenceSource | undefined): string {
  if (source === 'on_device') return 'on-device'
  if (source === 'in_cloud') return 'in-cloud'
  return 'unspecified'
}

async function ensureHybridService(): Promise<HybridService> {
  if (service) return service

  const status = await ensureFirebase(false)
  if (status !== 'ready') throw new AiNotConfiguredError()

  const fbApp = useFirebaseState().app
  if (!fbApp) throw new AiNotConfiguredError()
  if (!useFirebaseState().appCheck) {
    throw new Error(firebaseSetupError() || 'Firebase App Check is not initialized; AI Logic cannot attest requests.')
  }

  // Official quickstart wiring: Gemini Developer API backend + hybrid PREFER_ON_DEVICE mode.
  const ai = getAI(fbApp, { backend: new GoogleAIBackend() })
  const model = getGenerativeModel(ai, { mode: InferenceMode.PREFER_ON_DEVICE })
  service = { app: fbApp, ai, model }
  return service
}

/** True when a real Firebase project is configured (guest mode = false). */
export async function isAiLogicConfigured(): Promise<boolean> {
  return (await ensureFirebase(false)) === 'ready'
}

/**
 * Per the Chrome Prompt API requirement, `initializeDeviceModel()` must be called after or on a
 * user page interaction (a click) and before any query. Callers drive the UI progress state via
 * `onProgress`; the download can take several minutes.
 */
export async function initializeDeviceModel(onProgress?: (value: number) => void): Promise<void> {
  const { model } = await ensureHybridService()
  if (deviceInitialized) return
  deviceInitialized = true
  await model.initializeDeviceModel(onProgress)
}

/**
 * One summary request through Firebase AI Logic. Never leaves the browser until configured.
 * Returns the SDK's own `response.text()` plus the SDK-reported inference source so badges can
 * show TRUE provenance rather than a guessed channel label.
 */
export async function generateSummaryViaAiLogic(
  transcript: string
): Promise<{ text: string; inferenceSource: InferenceSource | undefined; elapsedMs: number }> {
  const started = performance.now()
  const { model } = await ensureHybridService()

  const prompt = `${SUMMARY_SYSTEM_PROMPT}\n\nFamily memory excerpt:\n${transcript.slice(0, 24_000)}`
  const result = await model.generateContent(prompt)
  const response = result.response
  const text = response.text()

  return {
    text,
    inferenceSource: response.inferenceSource,
    elapsedMs: Math.round(performance.now() - started)
  }
}

function parseLongTextContract(raw: string): { headline: string; summary: string; tags: string[] } {
  const pick = (key: string): string => {
    const m = raw.match(new RegExp(`${key}:\\s*([\\s\\S]*?)(?=\\n[A-Z]+:|$)`, 'i'))
    return m ? m[1].trim() : ''
  }
  const headline = pick('HEADLINE')
  const summary = pick('SUMMARY')
  let tags = pick('TAGS').split(',').map((t) => t.trim()).filter(Boolean)
  if (!tags.length && summary) tags = LOCAL_SENTIMENT_TAGS(summary)
  return { headline, summary, tags }
}

/** Tiny lexicon pass so the long-text contract degrades gracefully if the model omits TAGS. */
function LOCAL_SENTIMENT_TAGS(text: string): string[] {
  const lower = text.toLowerCase()
  if (lower.includes('laugh') || lower.includes('joy') || lower.includes('happy')) return ['joyful']
  if (lower.includes('warm') || lower.includes('love') || lower.includes('proud')) return ['tender']
  if (lower.includes('remember') || lower.includes('recipe') || lower.includes('grandma')) return ['nostalgic']
  return ['reflective']
}

/**
 * Full chain for cloud long-text processing with automatic local fallback.
 * Never throws to the UI: degrades deterministically and reports what happened.
 * A missing project is the designed local-only default, NOT a degradation; only a failed attempt
 * at a *configured* Firebase AI Logic channel counts as degraded.
 */
export async function summarizeTranscriptWithFallback(
  transcript: string,
  preferCloud = true,
  policy: DegradationPolicy = 'graceful'
): Promise<LongTextResult & { degraded: boolean; reason: string }> {
  const cloudAllowed = preferCloud && !shouldUseLocalOnly(policy)
  if (cloudAllowed) {
    try {
      const outcome = await generateSummaryViaAiLogic(transcript)
      return {
        headline: '',
        summary: outcome.text,
        tags: [],
        path: 'firebase-ai-logic',
        inferenceSource: outcome.inferenceSource,
        degraded: false,
        elapsedMs: outcome.elapsedMs,
        reason: ''
      }
    } catch (err) {
      const notConfigured = err instanceof AiNotConfiguredError
      if (!canFallbackAfterCloudFailure(policy)) throw err
      if (!notConfigured) {
        // A configured channel that failed → degradation, badged visibly below.
        const { summarizeLocally } = await import('./localSummarizer')
        const { analyzeSentiment } = await import('./sentiment')
        const local = summarizeLocally(transcript, 3)
        const sentiment = analyzeSentiment(transcript)
        return {
          headline: '',
          summary: local.summary,
          tags: sentiment.tags,
          path: 'extractive-local',
          degraded: true,
          reason: 'ai-logic-failed',
          elapsedMs: 0
        }
      }
      // not configured — the designed local-only default; fall through below
    }
  }

  const { summarizeLocally } = await import('./localSummarizer')
  const { analyzeSentiment } = await import('./sentiment')
  const local = summarizeLocally(transcript, 3)
  const sentiment = analyzeSentiment(transcript)
  return {
    headline: '',
    summary: local.summary,
    tags: sentiment.tags,
    path: 'extractive-local',
    degraded: false,
    reason: 'local-default',
    elapsedMs: 0
  }
}

/**
 * Long-text contract (headline + summary + tags), with optional local fallback.
 * Used by the extension-style paste flow.
 */
export async function processLongTextViaFallback(
  text: string,
  preferCloud = true,
  policy: DegradationPolicy = 'graceful'
): Promise<LongTextResult & { degraded: boolean; reason: string }> {
  const cloudAllowed = preferCloud && !shouldUseLocalOnly(policy)
  if (cloudAllowed) {
    try {
      const started = performance.now()
      const { model } = await ensureHybridService()
      const prompt = `${LONGTEXT_SYSTEM_PROMPT}\n\n${text.slice(0, 32_000)}`
      const result = await model.generateContent(prompt)
      const response = result.response
      const parsed = parseLongTextContract(response.text())
      return {
        headline: parsed.headline,
        summary: parsed.summary,
        tags: parsed.tags,
        path: 'firebase-ai-logic',
        inferenceSource: response.inferenceSource,
        degraded: false,
        elapsedMs: Math.round(performance.now() - started),
        reason: ''
      }
    } catch (err) {
      if (!canFallbackAfterCloudFailure(policy)) throw err
      if (!(err instanceof AiNotConfiguredError)) {
        const { summarizeLocally, deriveHeadline } = await import('./localSummarizer')
        const { analyzeSentiment } = await import('./sentiment')
        const local = summarizeLocally(text, 3)
        const sentiment = analyzeSentiment(text)
        return {
          headline: deriveHeadline(text),
          summary: local.summary,
          tags: sentiment.tags,
          path: 'extractive-local',
          degraded: true,
          reason: 'ai-logic-failed',
          elapsedMs: 0
        }
      }
    }
  }

  const { summarizeLocally, deriveHeadline } = await import('./localSummarizer')
  const { analyzeSentiment } = await import('./sentiment')
  const local = summarizeLocally(text, 3)
  const sentiment = analyzeSentiment(text)
  return {
    headline: deriveHeadline(text),
    summary: local.summary,
    tags: sentiment.tags,
    path: 'extractive-local',
    degraded: false,
    reason: 'local-default',
    elapsedMs: 0
  }
}

/**
 * Channel probe for the settings page / dashboard badge. This sends one minimal generateContent
 * request and records the SDK-reported inference source, latency, and explicit error.
 */
export async function probeAiLogic(
  timeoutMs = 6000,
  initializeDevice = false
): Promise<{
  reachable: boolean
  configured: boolean
  detail: string
  elapsedMs: number
  inferenceSource?: InferenceSource | undefined
  error?: string
}> {
  const started = performance.now()
  const configured = await isAiLogicConfigured()
  if (!configured) {
    return { reachable: false, configured: false, detail: 'not configured · guest mode (local floor)', elapsedMs: 0 }
  }
  try {
    const { model } = await ensureHybridService()
    const probe = await probeGenerativeModel(model, timeoutMs, initializeDevice)
    if (!probe.reachable) {
      return {
        reachable: false,
        configured: true,
        detail: probe.error || 'AI Logic probe failed',
        elapsedMs: probe.elapsedMs,
        error: probe.error
      }
    }
    const inferenceSource = probe.inferenceSource as InferenceSource | undefined
    return {
      reachable: true,
      configured: true,
      detail: `AI Logic responded · ${inferenceSource ?? 'source unspecified'}`,
      elapsedMs: probe.elapsedMs,
      inferenceSource
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      reachable: false,
      configured: true,
      detail: message.slice(0, 160),
      elapsedMs: Math.round(performance.now() - started),
      error: message.slice(0, 240)
    }
  }
}

export const SUMMARY_SYSTEM_PROMPT =
  'You are Remembrancer, a warm family memory assistant. Rewrite the transcript excerpt into ONE concise paragraph (max 90 words), preserving emotion and named people. Reply with only the summary text.'

export const LONGTEXT_SYSTEM_PROMPT =
  'You are Remembrancer, a warm family memory assistant. Process the pasted long text into: 1) a headline, 2) one concise summary paragraph, 3) three emotion tags. Format exactly:\nHEADLINE: …\nSUMMARY: …\nTAGS: tag1, tag2, tag3'