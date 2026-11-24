// Offline-first sentiment / emotion tagging engine.
// Deterministic lexicon + valence classifier — runs 100% in the browser,
// requires no API key, no quota, and no network access.
// This is the "on-device" emotion layer of the degraded production route.

export type EmotionTag =
  | 'warm'
  | 'joyful'
  | 'grateful'
  | 'excited'
  | 'tender'
  | 'nostalgic'
  | 'reflective'
  | 'hopeful'
  | 'proud'
  | 'sad'
  | 'anxious'
  | 'angry'
  | 'neutral'

const POSITIVE_WORDS: Record<string, EmotionTag[]> = {
  happy: ['joyful', 'warm'], joy: ['joyful'], delighted: ['joyful'], laugh: ['joyful', 'excited'],
  smiling: ['joyful', 'warm'], glad: ['joyful'], wonderful: ['joyful'], great: ['joyful', 'proud'],
  love: ['tender', 'warm'], loving: ['tender'], caring: ['tender'], sweet: ['tender', 'warm'],
  hug: ['tender', 'warm'], embrace: ['tender'], gentle: ['tender'], family: ['warm'],
  home: ['warm', 'nostalgic'], memory: ['nostalgic'], remember: ['nostalgic', 'reflective'],
  recall: ['nostalgic'], childhood: ['nostalgic'], grandpa: ['nostalgic', 'tender'],
  grandma: ['nostalgic', 'tender'], mom: ['tender', 'warm'], dad: ['warm'],
  thankful: ['grateful'], grateful: ['grateful'], appreciate: ['grateful'], blessing: ['grateful', 'hopeful'],
  proud: ['proud'], achievement: ['proud'], accomplished: ['proud'],
  excited: ['excited'], "can't wait": ['excited'], amazing: ['excited', 'joyful'],
  hopeful: ['hopeful'], future: ['hopeful'], dream: ['hopeful', 'nostalgic'],
  enjoy: ['joyful', 'warm'], enjoyed: ['joyful', 'warm'], cherish: ['tender', 'grateful']
}

const NEGATIVE_WORDS: Record<string, EmotionTag[]> = {
  sad: ['sad'], miss: ['sad', 'nostalgic'], missing: ['sad', 'nostalgic'],
  grief: ['sad'], cry: ['sad'], tears: ['sad'], lonely: ['sad'],
  worry: ['anxious'], worried: ['anxious'], anxious: ['anxious'], stress: ['anxious'],
  fear: ['anxious'], scared: ['anxious'], nervous: ['anxious'],
  angry: ['angry'], frustrated: ['angry'], upset: ['angry'],
  tired: ['reflective'], exhausted: ['reflective'], think: ['reflective'],
  thought: ['reflective'], meaning: ['reflective'], life: ['reflective'],
  nostalgia: ['nostalgic'], 'old days': ['nostalgic'], 'those days': ['nostalgic'],
  'used to': ['nostalgic'], 'back then': ['nostalgic']
}

function normalize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[。！？!?,，、;；:"'`~()\[\]{}<>\-_/\\]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

function scoreLexicon(tokens: string[]): Map<EmotionTag, number> {
  const scores = new Map<EmotionTag, number>()
  const bump = (tag: EmotionTag, weight = 1) => scores.set(tag, (scores.get(tag) ?? 0) + weight)

  for (const token of tokens) {
    const pos = POSITIVE_WORDS[token]
    const neg = NEGATIVE_WORDS[token]
    if (pos) pos.forEach((tag) => bump(tag, 2))
    if (neg) neg.forEach((tag) => bump(tag, 2))

    // Word-level phrases handled as single tokens; also scan substrings
    // so natural-language transcript fragments still match lexicons.
    for (const [word, tags] of Object.entries(POSITIVE_WORDS)) {
      if (word.length < 4 && token !== word) continue
      if (token.includes(word)) tags.forEach((tag) => bump(tag, 1))
    }
    for (const [word, tags] of Object.entries(NEGATIVE_WORDS)) {
      if (word.length < 4 && token !== word) continue
      if (token.includes(word)) tags.forEach((tag) => bump(tag, 1))
    }
  }
  return scores
}

export interface SentimentResult {
  tags: EmotionTag[]
  dominant: EmotionTag
  valence: number // -1 .. +1
}

export function analyzeSentiment(text: string): SentimentResult {
  const tokens = normalize(text)
  if (tokens.length === 0) {
    return { tags: ['neutral'], dominant: 'neutral', valence: 0 }
  }

  const scores = scoreLexicon(tokens)
  let positive = 0
  let negative = 0
  for (const [tag, v] of scores) {
    if (['sad', 'anxious', 'angry'].includes(tag)) negative += v
    else positive += v
  }

  const sorted = [...scores.entries()].sort((a, b) => b[1] - a[1])
  const top = sorted.slice(0, 3).map(([tag]) => tag)

  const valenceRaw = positive + negative === 0 ? 0 : (positive - negative) / (positive + negative)
  const valence = Math.round(variance(clamp01((valenceRaw + 1) / 2)) * 100) / 100 - 1

  if (top.length === 0 || top.every((t) => t === 'neutral')) {
    return { tags: ['neutral'], dominant: 'neutral', valence: 0 }
  }

  // Keep at most 3 tags, sorted by weight
  const tags: EmotionTag[] = sorted.slice(0, 3).map(([tag]) => tag)
  return { tags, dominant: tags[0], valence }
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x))
}

function variance(x: number): number {
  // small smoothing so neutral text does not produce extreme valence
  return x * 0.8 + 0.1
}