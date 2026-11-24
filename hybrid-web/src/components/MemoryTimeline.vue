<template>
  <section class="memory-timeline card" aria-label="Memory timeline">
    <div class="timeline-head">
      <h3>Family Timeline</h3>
      <span class="badge" v-if="filter">{{ filter }} · {{ filtered.length }} shown</span>
      <span class="badge ok" v-else>{{ memories.length }} memories</span>
    </div>

    <div class="search-row">
      <input
        v-model="filter"
        type="search"
        placeholder="Filter by title / tag / keyword…"
        aria-label="Filter timeline"
      />
    </div>

    <div v-if="loading" class="timeline-loading">Loading archive…</div>

    <div v-else-if="filtered.length === 0" class="timeline-empty">
      No matching memories. Clear the filter or record a new family moment above.
    </div>

    <ol v-else class="timeline-list">
      <li v-for="m in filtered" :key="m.id ?? m.title" class="timeline-item">
        <span class="rail"></span>
        <div class="item-body">
          <div class="item-meta">
            <time>{{ formatDate(m) }}</time>
            <span :class="['badge', badgeFor(m).tone]">
              {{ badgeFor(m).label }}
            </span>
            <span class="badge" v-if="m.durationSec">⏱ {{ Math.round(Number(m.durationSec)) }}s</span>
          </div>
          <h4 class="item-title">{{ m.title }}</h4>
          <p class="item-transcript">{{ m.transcript }}</p>
          <p class="item-summary" v-if="m.summary"><strong>Draft:</strong> {{ m.summary }}</p>
          <div class="item-tags" v-if="m.emotionTags?.length">
            <span v-for="tag in m.emotionTags" :key="tag" class="tag">#{{ tag }}</span>
          </div>
        </div>
      </li>
    </ol>
  </section>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useMemoryStore } from '@/stores/memoryStore'
import { memoryBadge } from '@/lib/memoryPresentation'

const store = useMemoryStore()
const memories = computed(() => store.visibleMemories)
const loading = computed(() => store.loading)

function badgeFor(memory: Parameters<typeof memoryBadge>[0]) {
  return memoryBadge(memory)
}

const filter = ref('')
const filtered = computed(() => {
  const q = filter.value.trim().toLowerCase()
  if (!q) return memories.value
  return memories.value.filter((m) => {
    const haystack = [
      m.title,
      m.transcript ?? '',
      m.summary ?? '',
      Array.isArray(m.emotionTags) ? m.emotionTags.join(' ') : ''
    ]
      .join(' ')
      .toLowerCase()
    return haystack.includes(q)
  })
})

function formatDate(m: any): string {
  const raw = m.createdAt
  let date: Date | null = null
  if (raw instanceof Date) date = raw
  else if (typeof raw === 'string' && raw) date = new Date(raw)
  else if (raw && typeof raw.toDate === 'function') {
    try { date = raw.toDate() } catch { date = null }
  }
  if (!date || Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}
</script>

<style scoped>
.memory-timeline { padding: 1.25rem 1.5rem; display: flex; flex-direction: column; gap: 0.9rem; }
.timeline-head { display: flex; align-items: center; gap: 0.7rem; flex-wrap: wrap; }
.timeline-head h3 { margin: 0; font-size: 1.02rem; }
.search-row input { width: 100%; font-size: 0.86rem; }
.timeline-loading, .timeline-empty { color: var(--text-dim); font-size: 0.85rem; padding: 1rem 0; }
.timeline-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 1rem; }
.timeline-item { display: flex; gap: 0.9rem; position: relative; padding-left: 0.2rem; }
.rail {
  width: 10px; height: 10px; border-radius: 50%;
  background: var(--accent-strong); margin-top: 0.45rem;
  box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.18);
  flex-shrink: 0;
}
.item-body {
  flex: 1; background: rgba(255,255,255,0.025);
  border: 1px solid var(--border); border-radius: 12px; padding: 0.8rem 1rem;
}
.item-meta { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
.item-meta time { font-size: 0.75rem; color: var(--text-dim); }
.item-title { margin: 0.35rem 0 0.3rem; font-size: 0.98rem; color: var(--text); }
.item-transcript {
  margin: 0; font-size: 0.84rem; color: var(--text-muted);
  line-height: 1.55; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
}
.item-summary { margin: 0.45rem 0 0; font-size: 0.82rem; color: var(--text-dim); line-height: 1.55; }
.item-summary strong { color: var(--accent); font-weight: 600; }
.item-tags { display: flex; gap: 0.4rem; flex-wrap: wrap; margin-top: 0.5rem; }
.tag {
  background: var(--tag-bg); color: var(--accent); font-size: 0.72rem;
  padding: 0.18rem 0.55rem; border-radius: 999px; border: 1px solid rgba(129,140,248,0.3);
}
</style>