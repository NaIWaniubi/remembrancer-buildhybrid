import type { DegradationPolicy } from '@/config/remote-config.strategy'

export function shouldAttemptCloud(preferCloud: boolean, policy: DegradationPolicy): boolean {
  return preferCloud && policy !== 'local_only' && policy !== 'offline'
}

export function shouldUseLocalOnly(policy: DegradationPolicy): boolean {
  return policy === 'local_only' || policy === 'offline'
}

/** Only graceful degradation may replace a failed cloud result with a local result. */
export function canFallbackAfterCloudFailure(policy: DegradationPolicy): boolean {
  return policy === 'graceful'
}
