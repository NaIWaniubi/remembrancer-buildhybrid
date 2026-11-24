export interface ProbeResponse {
  inferenceSource?: string
  text?: () => string
}

export interface ProbeGenerativeModel {
  initializeDeviceModel?: (onProgress?: (value: number) => void) => Promise<void>
  generateContent(prompt: string): Promise<{ response: ProbeResponse }>
}

export interface AiProbeResult {
  reachable: boolean
  inferenceSource?: string
  elapsedMs: number
  error?: string
}

/**
 * Send one minimal, real generateContent request. A constructed SDK model is not proof that the
 * channel works; this result is based on the response or the explicit failure.
 */
export async function probeGenerativeModel(
  model: ProbeGenerativeModel,
  timeoutMs = 6000,
  initializeDevice = false
): Promise<AiProbeResult> {
  const started = performance.now()
  let timer: ReturnType<typeof setTimeout> | undefined

  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`AI Logic probe timed out after ${timeoutMs}ms`)), timeoutMs)
    })
    const request = (async () => {
      // The hybrid quickstart requires device-model initialization after a user interaction and
      // before the first query. Manual probes opt in so a cold on-device download is not mistaken
      // for a broken cloud channel by the short automatic probe.
      if (initializeDevice && model.initializeDeviceModel) {
        await model.initializeDeviceModel()
      }
      return model.generateContent('Reply with OK.')
    })()
    const result = await Promise.race([request, timeout])
    const inferenceSource = result.response.inferenceSource
    return {
      reachable: true,
      inferenceSource,
      elapsedMs: Math.round(performance.now() - started)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      reachable: false,
      elapsedMs: Math.round(performance.now() - started),
      error: message.slice(0, 240)
    }
  } finally {
    if (timer) clearTimeout(timer)
  }
}
