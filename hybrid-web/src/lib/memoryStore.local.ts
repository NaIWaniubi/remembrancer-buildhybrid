// Local-first memory persistence: a browser-side collection backed by
// localStorage that mirrors the Firestore memories collection shape.
// This is what makes the full chain (transcribe → summarize → tag → timeline →
// retrieval QA) run end-to-end with zero accounts and zero network.

import type { MemoryEntry } from '@/composables/useFirestoreMemory'

const STORAGE_KEY = 'remembrancer.memories.v1'
const SEED_FLAG_KEY = 'remembrancer.seeded.v1'

export interface StoredMemory extends MemoryEntry {
  id: string
  createdAtIso: string
}

const DEMO_MEMORIES: Array<Omit<StoredMemory, 'id' | 'createdAtIso'>> = [
  {
    familyId: 'demo-family',
    title: "Grandma's dumpling recipe, explained twice",
    transcript:
      "Dad says the dough has to rest for half an hour, or it tears when you pull it. Grandma laughs — she learned that from her own mother in the village. Teenager asks why the filling needs chives instead of green onions. Grandma says her mother only had chives, and you get the taste right with what your hands remember. Mom adds that this was recorded on a Sunday afternoon; everyone agrees to make these again next weekend.",
    summary:
      "A Sunday-afternoon dumpling lesson where Grandma explains the dough-rest rule, why chives matter, and how her mother kept recipes alive by hand memory alone.",
    emotionTags: ['nostalgic', 'warm', 'joyful'],
    audioRef: '',
    durationSec: 214,
    createdBy: 'dad',
    visibleTo: ['dad', 'mom', 'teen', 'grandma'],
    source: 'demo-local',
    summaryPath: 'demo-local'
  },
  {
    familyId: 'demo-family',
    title: "Teenager's first orchestra recital",
    transcript:
      "The recital hall smelled like old wood. Teenager's hands were shaking before the second movement, but Grandma said afterwards that she played the quiet parts best, the ones nobody claps for. Dad filmed exactly one minute of applause because the video file was too big otherwise. Everyone agreed the drive home was the loudest part — teenager narrating every mistake to make everyone laugh.",
    summary:
      "A shaky but heartfelt first recital; Grandma praised the quiet passages the most, and the drive home turned mistakes into laughter.",
    emotionTags: ['proud', 'nervous-brave', 'joyful'],
    audioRef: '',
    durationSec: 178,
    createdBy: 'mom',
    visibleTo: ['dad', 'mom', 'teen'],
    source: 'demo-local',
    summaryPath: 'demo-local'
  },
  {
    familyId: 'demo-family',
    title: "What Grandpa wants remembered about the orchard",
    transcript:
      "Grandpa says the orchard is not about the apples. It is about knowing which tree will give up early and which one will hold its fruit until October even after the frost. He asks his grandchildren to remember the smell of ripe pears more than any single harvest. Mom writes down the sentence because Grandpa believes nobody writes things down anymore.",
    summary:
      "Grandpa's orchard wisdom: what matters is the smell of ripe pears and patience, not any single harvest — recorded so someone writes it down.",
    emotionTags: ['nostalgic', 'tender', 'reflective'],
    audioRef: '',
    durationSec: 402,
    createdBy: 'grandma',
    visibleTo: ['dad', 'mom', 'grandma'],
    source: 'demo-local',
    summaryPath: 'demo-local'
  }
]

function nowIso(): string {
  return new Date().toISOString()
}

function loadAll(): StoredMemory[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as StoredMemory[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveAll(items: StoredMemory[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {
    /* storage unavailable */
  }
}

export function seedDemoMemoriesIfEmpty(): StoredMemory[] {
  if (localStorage.getItem(SEED_FLAG_KEY)) return loadAll()
  const seeded = DEMO_MEMORIES.map((entry, i) => ({
    ...entry,
    id: `seed-${i + 1}`,
    createdAtIso: new Date(Date.now() - (DEMO_MEMORIES.length - i) * 86_400_000).toISOString()
  }))
  saveAll(seeded)
  try {
    localStorage.setItem(SEED_FLAG_KEY, '1')
  } catch {
    /* ignore */
  }
  return seeded
}

export function listLocalMemories(familyId?: string): StoredMemory[] {
  const all = loadAll()
  const filtered = familyId ? all.filter((m) => m.familyId === familyId) : all
  return filtered.sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso))
}

export function createLocalMemory(
  entry: Omit<StoredMemory, 'id' | 'createdAtIso'>
): StoredMemory {
  const all = loadAll()
  const id = `mem-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
  const stored: StoredMemory = { ...entry, id, createdAtIso: nowIso() }
  all.unshift(stored)
  saveAll(all)
  return stored
}

export function updateLocalMemory(id: string, patch: Partial<Omit<StoredMemory, 'id'>>): void {
  const all = loadAll()
  const idx = all.findIndex((m) => m.id === id)
  if (idx === -1) return
  all[idx] = { ...all[idx], ...patch }
  saveAll(all)
}

export function deleteLocalMemory(id: string): void {
  const all = loadAll().filter((m) => m.id !== id)
  saveAll(all)
}

export function clearLocalMemories(): void {
  saveAll([])
  try {
    localStorage.removeItem(SEED_FLAG_KEY)
  } catch {
    /* ignore */
  }
}