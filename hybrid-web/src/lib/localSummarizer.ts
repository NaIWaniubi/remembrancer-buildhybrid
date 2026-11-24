// Offline extractive summarizer — the "on-device" summary engine for the
// degraded production route. Deterministic, dependency-free, runs fully in-browser.
// When a cloud endpoint is configured and reachable, summarizeViaCloud() is used first;
// this module is the guaranteed fallback (and the only engine without a key).

export interface SummaryResult {
  summary: string
  method: 'extractive-local'
  sentencesAnalyzed: number
}

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'if', 'then', 'of', 'to', 'in', 'on',
  'at', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
  'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
  'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
  'my', 'your', 'his', 'its', 'our', 'their', 'this', 'that', 'these', 'those',
  'so', 'just', 'very', 'really', 'about', 'for', 'with', 'as', 'by', 'from',
  '的', '了', '是', '在', '我', '你', '他', '她', '我们', '你们', '他们',
  '和', '也', '都', '就', '那', '这个', '那个', '一个'
])

export function splitSentences(text: string): string[] {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  if (!cleaned) return []
  // Split on sentence-ending punctuation (EN + ZH), keep them attached for output clarity
  const parts = cleaned.split(/(?<=[.!?。！？])\s+|(?<=[.!?。！？])/)
  return parts
    .map((s) => s.trim())
    .filter((s) => s.length >= 4)
}

function tokens(sentence: string): string[] {
  return sentence
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t))
}

export function summarizeLocally(text: string, maxSentences = 3): SummaryResult {
  const sentences = splitSentences(text)
  if (sentences.length === 0) {
    return { summary: '(empty transcript)', method: 'extractive-local', sentencesAnalyzed: 0 }
  }

  if (sentences.length <= maxSentences) {
    return { summary: sentences.join(' '), method: 'extractive-local', sentencesAnalyzed: sentences.length }
  }

  // Term frequency across the whole transcript
  const freq = new Map<string, number>()
  for (const sentence of sentences) {
    for (const token of tokens(sentence)) freq.set(token, (freq.get(token) ?? 0) + 1)
  }

  const scored = sentences.map((sentence, idx) => {
    const toks = tokens(sentence)
    let score = 0
    for (const t of toks) score += freq.get(t) ?? 0

    const lengthNorm = Math.min(toks.length / 12, 2) // reward substantive sentences
    score *= Math.max(0.35, lengthNorm)

    if (idx === 0) score *= 1.15 // opening sentences usually carry context
    if (idx === sentences.length - 1) score *= 1.05

    return { idx, sentence, score: score / Math.max(1, toks.length) * Math.max(1, toks.length) }
  })

  const picked = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSentences)
    .sort((a, b) => a.idx - b.idx)
    .map((s) => s.sentence)

  return { summary: picked.join(' '), method: 'extractive-local', sentencesAnalyzed: sentences.length }
}

// Short "title-like" headline derived from the first meaningful sentence.
export function deriveHeadline(text: string, maxLength = 48): string {
  const sentences = splitSentences(text)
  const candidate = sentences[0] ?? text.trim().slice(0, maxLength)
  if (candidate.length <= maxLength) return candidate.replace(/[.!?。！？]$/, '')
  return candidate.slice(0, maxLength - 3).replace(/\s+\S*$/, '') + '…'
}