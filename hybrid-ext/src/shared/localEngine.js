// Shared local-first engine for the Remembrancer MV3 extension.
// Pure functions — importable from both the popup page and the service worker module.
// No network access by itself; this is the guaranteed fallback channel.

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'if', 'then', 'of', 'to', 'in', 'on',
  'at', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
  'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
  'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
  'my', 'your', 'his', 'its', 'our', 'their', 'this', 'that', 'these', 'those',
  'so', 'just', 'very', 'really', 'about', 'for', 'with', 'as', 'by', 'from'
])

export function splitSentences(text) {
  const cleaned = String(text ?? '').replace(/\s+/g, ' ').trim()
  if (!cleaned) return []
  return cleaned
    .split(/(?<=[.!?。！？])\s+|(?<=[.!?。！？])/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 4)
}

function tokens(sentence) {
  return sentence
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t))
}

/** Extractive summary — deterministic, offline, no key required. */
export function summarizeLocally(text, maxSentences = 3) {
  const sentences = splitSentences(text)
  if (sentences.length === 0) return { summary: '(empty text)', method: 'extractive-local', sentencesAnalyzed: 0 }
  if (sentences.length <= maxSentences) {
    return { summary: sentences.join(' '), method: 'extractive-local', sentencesAnalyzed: sentences.length }
  }

  const freq = new Map()
  for (const sentence of sentences) {
    for (const token of tokens(sentence)) freq.set(token, (freq.get(token) ?? 0) + 1)
  }

  const scored = sentences.map((sentence, idx) => {
    const toks = tokens(sentence)
    let score = 0
    for (const t of toks) score += freq.get(t) ?? 0
    const lengthNorm = Math.min(toks.length / 12, 2)
    score *= Math.max(0.35, lengthNorm)
    if (idx === 0) score *= 1.15
    if (idx === sentences.length - 1) score *= 1.05
    return { idx, sentence, score }
  })

  const picked = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSentences)
    .sort((a, b) => a.idx - b.idx)
    .map((s) => s.sentence)

  return { summary: picked.join(' '), method: 'extractive-local', sentencesAnalyzed: sentences.length }
}

export function deriveHeadline(text, maxLength = 48) {
  const sentences = splitSentences(text)
  const candidate = sentences[0] ?? String(text ?? '').trim().slice(0, maxLength)
  if (candidate.length <= maxLength) return candidate.replace(/[.!?。！？]$/, '')
  return candidate.slice(0, maxLength - 3).replace(/\s+\S*$/, '') + '…'
}

// ---------------- sentiment lexicon engine ----------------

const POSITIVE_WORDS = {
  happy: ['joyful', 'warm'], joy: ['joyful'], delighted: ['joyful'], laugh: ['joyful'],
  laughing: ['joyful'], smiling: ['joyful'], glad: ['joyful'], wonderful: ['joyful'],
  love: ['tender', 'warm'], loving: ['tender'], caring: ['tender'], sweet: ['tender'],
  hug: ['tender', 'warm'], embrace: ['tender'], gentle: ['tender'], family: ['warm'],
  home: ['warm'], memory: ['nostalgic'], remember: ['nostalgic'], recalled: ['nostalgic'],
  childhood: ['nostalgic'], grandpa: ['nostalgic'], grandma: ['nostalgic'],
  mom: ['tender'], dad: ['warm'], thankful: ['grateful'], grateful: ['grateful'],
  proud: ['proud'], achievement: ['proud'], accomplished: ['proud'],
  excited: ['excited'], amazing: ['excited', 'joyful'], hopeful: ['hopeful'],
  dream: ['hopeful', 'nostalgic'], cherish: ['tender', 'grateful'], enjoy: ['joyful', 'warm']
}

const NEGATIVE_WORDS = {
  sad: ['sad'], miss: ['sad', 'nostalgic'], missing: ['sad', 'nostalgic'],
  grief: ['sad'], cry: ['sad'], tears: ['sad'], lonely: ['sad'],
  worry: ['anxious'], worried: ['anxious'], anxious: ['anxious'], stress: ['anxious'],
  fear: ['anxious'], scared: ['anxious'], nervous: ['anxious'],
  angry: ['angry'], frustrated: ['angry'], upset: ['angry'],
  tired: ['reflective'], exhausted: ['reflective'], think: ['reflective'],
  thought: ['reflective'], meaning: ['reflective'], nostalgia: ['nostalgic']
}

function normalizeWords(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[。！？!?,，、;；:"'`~()\[\]{}<>\-_/\\]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

export function analyzeSentiment(text) {
  const words = normalizeWords(text)
  if (words.length === 0) return { tags: ['neutral'], dominant: 'neutral', valence: 0 }

  const scores = new Map()
  const bump = (tag, weight = 1) => scores.set(tag, (scores.get(tag) ?? 0) + weight)

  for (const word of words) {
    for (const [key, tags] of Object.entries(POSITIVE_WORDS)) {
      if (word === key || (key.length >= 4 && word.includes(key))) tags.forEach((t) => bump(t, word === key ? 2 : 1))
    }
    for (const [key, tags] of Object.entries(NEGATIVE_WORDS)) {
      if (word === key || (key.length >= 4 && word.includes(key))) tags.forEach((t) => bump(t, word === key ? 2 : 1))
    }
  }

  let positive = 0
  let negative = 0
  for (const [tag, v] of scores) {
    if (['sad', 'anxious', 'angry'].includes(tag)) negative += v
    else positive += v
  }

  const sorted = [...scores.entries()].sort((a, b) => b[1] - a[1])
  if (sorted.length === 0) return { tags: ['neutral'], dominant: 'neutral', valence: 0 }

  const tags = sorted.slice(0, 3).map(([tag]) => tag)
  const valenceRaw = positive + negative === 0 ? 0 : (positive - negative) / (positive + negative)
  return { tags, dominant: tags[0], valence: Math.round((valenceRaw * 10) / 10) }
}