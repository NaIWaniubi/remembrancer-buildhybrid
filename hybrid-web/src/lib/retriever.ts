// In-browser retrieval QA ("RAG-lite") over the memory timeline corpus.
// Deterministic term-frequency scoring with phrase boosting — zero network,
// zero quota. Answers the demo's "ask your family archive" moment honestly:
// citations come from actual stored memories.

import type { MemoryEntry } from '@/composables/useFirestoreMemory'

export interface RetrievalHit {
  memoryId: string
  title: string
  excerpt: string // window around the strongest match
  matchedTerms: string[]
  score: number // 0..1 normalized
  sourceText: string // full transcript snippet for citation display
}

export interface RetrievalAnswer {
  question: string
  hits: RetrievalHit[]
  answer: string
  grounded: boolean // true when at least one hit exists
}

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'of', 'to', 'in', 'on', 'for',
  'and', 'or', 'with', 'what', 'who', 'when', 'where', 'why', 'how', 'which',
  '的', '了', '是', '在', '和', '什么', '谁', '哪', '呢'
])

function tokenize(text: string): string[] {
  const lower = text.toLowerCase()
  const latin = lower.match(/[a-z][a-z'-]+/g) ?? []
  const cjk = Array.from(lower).filter((ch) => /[\u4e00-\u9fff]/.test(ch))
  return [...latin, ...cjk].filter((t) => t.length > 1 && !STOP_WORDS.has(t))
}

function corpusText(m: MemoryEntry): string {
  return `${m.title} ${m.transcript ?? ''} ${m.summary ?? ''}`.trim()
}

/**
 * Score each memory against the question and build a cited answer.
 * `memories` should already be scoped to the current family.
 */
export function retrieveAndAnswer(memories: MemoryEntry[], question: string): RetrievalAnswer {
  const queryTokens = tokenize(question)
  const phrases = extractPhrases(question)

  if (queryTokens.length === 0) {
    return { question, hits: [], answer: 'Please ask something about the recorded memories.', grounded: false }
  }

  if (memories.length === 0) {
    return {
      question,
      hits: [],
      answer: 'No memories recorded yet — record a family moment first, then ask.',
      grounded: false
    }
  }

  // Document frequency across corpus for IDF weighting
  const docFreq = new Map<string, number>()
  for (const token of queryTokens) {
    let count = 0
    for (const m of memories) {
      const toks = new Set(tokenize(corpusText(m)))
      if (toks.has(token)) count++
    }
    docFreq.set(token, count)
  }

  const scored = memories.map((m) => {
    const body = corpusText(m)
    const bodyTokens = tokenize(body)
    const bodySet = new Set(bodyTokens)

    let score = 0
    const matched: string[] = []

    for (const token of queryTokens) {
      const df = Math.max(1, docFreq.get(token) ?? 1)
      const idfWeight = 1 + Math.log(20 / (df + 5))
      const tf = bodyTokens.filter((t) => t === token).length
      if (tf > 0) {
        score += tf * idfWeight
        matched.push(token)
      }
    }

    for (const phrase of phrases) {
      if (phrase.length < 3) continue
      const occurrences = countOccurrences(body.toLowerCase(), phrase.toLowerCase())
      if (occurrences > 0) {
        score += occurrences * 6
        matched.push(`"${phrase}"`)
      }
    }

    return { memory: m, score, matched: [...new Set(matched)] }
  })

  const maxScore = Math.max(...scored.map((s) => s.score), 1)
  const hits: RetrievalHit[] = scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ memory, score, matched }) => ({
      memoryId: memory.id ?? '',
      title: memory.title,
      excerpt: bestExcerpt(memory, queryTokens),
      matchedTerms: matched.slice(0, 5),
      score: Math.round((score / maxScore) * 100) / 100,
      sourceText: (memory.transcript ?? '').slice(0, 240)
    }))

  if (hits.length === 0) {
    return {
      question,
      hits: [],
      answer: `Nothing in the archive matches "${question}". Try different words or record more context.`,
      grounded: false
    }
  }

  const top = hits[0]
  const related = hits.slice(1).map((h) => h.title).join(', ')
  const answer =
    `Best match — "${top.title}" (${Math.round(top.score * 100)}% relevance):\n` +
    `"${top.excerpt}"\n\n` +
    (related ? `Also relevant: ${related}.` : 'This was the closest match in the archive.')

  return { question, hits, answer, grounded: true }
}

function extractPhrases(question: string): string[] {
  const phrases: string[] = []
  const latinChunks = question.match(/[a-z][a-z'-]+(?:\s+[a-z][a-z'-]+){1,}/gi) ?? []
  for (const chunk of latinChunks) {
    const words = chunk.split(/\s+/)
    if (words.length >= 2 && !STOP_WORDS.has(chunk.toLowerCase())) phrases.push(chunk.toLowerCase())
  }
  // CJK two-gram phrases (only keep n-grams containing a verb/noun hint char set is too complex;
  // instead keep n-grams that also appear as full tokens' neighbors handled by single-char tokens above).
  const cjkRun = question.match(/[\u4e00-\u9fff]{2,}/g) ?? []
  for (const run of cjkRun) {
    if (run.length <= 8 && !STOP_WORDS.has(run)) phrases.push(run)
  }
  return phrases
}

function countOccurrences(haystack: string, needle: string): number {
  let count = 0
  let idx = haystack.indexOf(needle)
  while (idx !== -1) {
    count++
    idx = haystack.indexOf(needle, idx + needle.length)
  }
  return count
}

function bestExcerpt(memory: MemoryEntry, queryTokens: string[]): string {
  const text = (memory.transcript ?? memory.summary ?? memory.title ?? '').trim()
  if (!text) return memory.title

  const lower = text.toLowerCase()
  let bestPos = 0
  let bestRank = -1
  const sentences = splitKeepPunct(text)

  for (let i = 0; i < sentences.length; i++) {
    const sl = sentences[i].toLowerCase()
    let rank = 0
    for (const token of queryTokens) {
      if (sl.includes(token)) rank += 2
    }
    if (rank > bestRank) {
      bestRank = rank
      bestPos = i
    }
  }

  const window = sentences.slice(Math.max(0, bestPos), bestPos + 2).join(' ').trim()
  return window.length > 160 ? window.slice(0, 157) + '…' : window || text.slice(0, 160)
}

function splitKeepPunct(text: string): string[] {
  return text.replace(/\s+/g, ' ').split(/(?<=[.!?。！？\n])/).map((s) => s.trim()).filter(Boolean)
}