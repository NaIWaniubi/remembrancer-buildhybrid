import { ref } from 'vue'
import { useFirebaseState } from '@/config/firebase.init'
import {
  collection, query, orderBy, limit, onSnapshot,
  addDoc, updateDoc, doc, getDocs, serverTimestamp
} from 'firebase/firestore'
import {
  listLocalMemories,
  createLocalMemory,
  updateLocalMemory,
  seedDemoMemoriesIfEmpty,
  type StoredMemory
} from '@/lib/memoryStore.local'
import { memoryCollectionSegments, memoryDocumentSegments } from '@/lib/memoryPaths'

export interface MemoryEntry {
  id?: string
  familyId: string
  title: string
  transcript?: string
  summary?: string
  emotionTags?: string[]
  audioRef?: string
  durationSec?: number
  createdBy?: string
  createdAt?: ReturnType<typeof serverTimestamp> | string | null
  visibleTo?: string[]
  source?: string // transcription channel, e.g. web-speech-local / typed-paste / demo-local
  summaryPath?: string // firebase-ai-logic / extractive-local / demo-local
  inferenceSource?: 'on_device' | 'in_cloud'
}

export function toStored(m: MemoryEntry): StoredMemory {
  return {
    ...m,
    id: m.id ?? '',
    createdAtIso:
      typeof m.createdAt === 'string' && m.createdAt
        ? m.createdAt
        : m.createdAt instanceof Date
          ? m.createdAt.toISOString()
          : new Date().toISOString()
  } as StoredMemory
}

function isRemote(): boolean {
  const state = useFirebaseState()
  return state.ready && state.db !== null && Boolean(state.auth?.currentUser)
}

/**
 * Dual-backend memory collection. Firestore is used only when a real project and authenticated
 * user are present. Guest/auth-missing and Firestore failures use localStorage and stay marked
 * pendingSync so the UI never implies that a local-only write reached the cloud.
 */
export function useFirestoreMemory() {
  const memories = ref<MemoryEntry[]>([])
  const loading = ref(false)
  const backend = ref<'firestore' | 'local'>('local')
  const pendingSync = ref(false)
  const syncError = ref('')

  function markPendingSync(reason: string) {
    backend.value = 'local'
    pendingSync.value = true
    syncError.value = reason
  }

  function clearPendingSync() {
    pendingSync.value = false
    syncError.value = ''
  }

  function hydrateLocal(familyId: string) {
    backend.value = 'local'
    const stored = listLocalMemories(familyId)
    memories.value = stored.map((s) => stripStored(s))
  }

  function stripStored(s: StoredMemory): MemoryEntry {
    const { createdAtIso, ...rest } = s
    void createdAtIso
    return { ...rest, createdAt: rest.createdAt ?? null }
  }

  function seedLocalIfNeeded() {
    if (!localStorage.getItem('remembrancer.seeded.v1')) {
      seedDemoMemoriesIfEmpty()
    }
  }

  function handleLocalFallback(familyId: string, reason: string) {
    seedLocalIfNeeded()
    hydrateLocal(familyId)
    markPendingSync(reason)
  }

  async function loadMemories(familyId: string) {
    loading.value = true

    if (!isRemote()) {
      seedLocalIfNeeded()
      hydrateLocal(familyId)
      const state = useFirebaseState()
      if (state.ready && !state.auth?.currentUser) markPendingSync('auth-required')
      else clearPendingSync()
      loading.value = false
      return
    }

    backend.value = 'firestore'
    clearPendingSync()
    try {
      const q = query(
        collection(useFirebaseState().db!, ...memoryCollectionSegments(familyId)),
        orderBy('createdAt', 'desc'),
        limit(100)
      )
      const snap = await getDocs(q)
      memories.value = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as MemoryEntry)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      handleLocalFallback(familyId, `firestore-read-failed: ${message.slice(0, 160)}`)
    } finally {
      loading.value = false
    }
  }

  function subscribeRemote(familyId: string) {
    if (!isRemote()) {
      seedLocalIfNeeded()
      hydrateLocal(familyId)
      const state = useFirebaseState()
      if (state.ready && !state.auth?.currentUser) markPendingSync('auth-required')
      return () => {}
    }
    try {
      const q = query(
        collection(useFirebaseState().db!, ...memoryCollectionSegments(familyId)),
        orderBy('createdAt', 'desc'),
        limit(100)
      )
      return onSnapshot(
        q,
        (snap) => {
          backend.value = 'firestore'
          clearPendingSync()
          memories.value = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as MemoryEntry)
        },
        (err) => handleLocalFallback(familyId, `firestore-subscription-failed: ${err.message.slice(0, 160)}`)
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      handleLocalFallback(familyId, `firestore-subscription-failed: ${message.slice(0, 160)}`)
      return () => {}
    }
  }

  async function createMemory(entry: Omit<MemoryEntry, 'id' | 'createdAt'>) {
    if (isRemote()) {
      try {
        const refDoc = await addDoc(
          collection(useFirebaseState().db!, ...memoryCollectionSegments(entry.familyId)),
          { ...entry, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }
        )
        clearPendingSync()
        return String(refDoc.id)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        const stored = createLocalMemory(toStored({ ...entry, id: undefined }))
        memories.value = [stripStored(stored), ...memories.value]
        markPendingSync(`firestore-write-failed: ${message.slice(0, 160)}`)
        return stored.id
      }
    }
    const state = useFirebaseState()
    const stored = createLocalMemory(toStored({ ...entry, id: undefined }))
    memories.value = [stripStored(stored), ...memories.value]
    if (state.ready && !state.auth?.currentUser) markPendingSync('auth-required')
    return stored.id
  }

  async function updateMemory(id: string, patch: Partial<MemoryEntry>, familyId?: string) {
    const targetFamilyId = familyId ?? memories.value.find((memory) => memory.id === id)?.familyId
    if (!targetFamilyId) throw new Error('Cannot update memory without familyId.')

    if (isRemote()) {
      try {
        await updateDoc(doc(useFirebaseState().db!, ...memoryDocumentSegments(targetFamilyId, id)), {
          ...patch,
          updatedAt: serverTimestamp()
        })
        clearPendingSync()
        return
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        const existing = memories.value.find((memory) => memory.id === id)
        if (existing && !listLocalMemories(targetFamilyId).some((memory) => memory.id === id)) {
          createLocalMemory(toStored(existing))
        }
        updateLocalMemory(id, patch)
        markPendingSync(`firestore-update-failed: ${message.slice(0, 160)}`)
        return
      }
    }
    updateLocalMemory(id, patch)
  }

  async function fetchMemoriesLocal(familyId: string): Promise<MemoryEntry[]> {
    return listLocalMemories(familyId).map(stripStored)
  }

  return {
    memories,
    loading,
    backend,
    pendingSync,
    syncError,
    loadMemories,
    subscribeRemote,
    createMemory,
    updateMemory,
    fetchMemoriesLocal
  }
}
