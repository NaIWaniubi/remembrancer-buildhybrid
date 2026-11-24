<template>
  <section class="member-selector card" aria-label="Family member permissions">
    <div class="ms-head">
      <h3>Family Members &amp; Visibility</h3>
      <span class="badge">per-member access demo</span>
    </div>

    <div class="member-grid">
      <button
        v-for="m in members"
        :key="m.id"
        @click="toggle(m.id)"
        :class="['chip', { active: activeIds.includes(m.id) }]"
      >
        <span class="avatar" aria-hidden="true">{{ initials(m.name) }}</span>
        <span class="name">{{ m.name }}</span>
        <span :class="['role', m.role]">{{ m.role }}</span>
      </button>
    </div>

    <p class="hint">
      Highlighted members receive the next recorded memory. In the default local archive this is a visible,
      client-side scope; when a Firebase project is configured the same list maps onto
      Firestore security rules ({{ rulesNote }}).
    </p>

    <div class="rules-demo">
      <strong>How the boundary is enforced today:</strong>
      <ul>
        <li>Admin — full read/write of all family memories.</li>
        <li>Viewer — only memories whose <code>visibleTo</code> array contains their member id.</li>
        <li>Removal from <code>activeMemberIds</code> hides those entries from this browser immediately.</li>
      </ul>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useMemoryStore } from '@/stores/memoryStore'

interface Member { id: string; name: string; role: 'admin' | 'viewer' }

const store = useMemoryStore()
const activeIds = computed(() => store.activeMemberIds)

const members = ref<Member[]>([
  { id: 'dad', name: 'Dad', role: 'admin' },
  { id: 'mom', name: 'Mom', role: 'admin' },
  { id: 'teen', name: 'Teenager', role: 'viewer' },
  { id: 'grandma', name: 'Grandma', role: 'viewer' }
])

function toggle(id: string) {
  const next = activeIds.value.includes(id)
    ? activeIds.value.filter((memberId) => memberId !== id)
    : [...activeIds.value, id]
  store.setActiveMemberIds(next)
}

function initials(name: string): string {
  return name.slice(0, 1).toUpperCase()
}

const rulesNote = computed(() =>
  store.backend === 'firestore'
    ? 'Firestore rules: match /databases/{db}/documents/families/{family}/memories/{id} with request.resource.visibleTo hasAny userId'
    : 'client-side visibility filter (local-first)'
)
</script>

<style scoped>
.member-selector { padding: 1.25rem 1.5rem; display: flex; flex-direction: column; gap: 0.9rem; }
.ms-head { display: flex; align-items: center; justify-content: space-between; gap: 0.7rem; flex-wrap: wrap; }
.ms-head h3 { margin: 0; font-size: 1.02rem; }
.member-grid { display: flex; gap: 0.6rem; flex-wrap: wrap; }
.chip {
  display: inline-flex; align-items: center; gap: 0.5rem;
  padding: 0.45rem 0.85rem; border-radius: 999px;
  border: 1px solid var(--border-strong);
  background: var(--bg-input); color: var(--text-muted);
  font-size: 0.85rem;
}
.chip.active { background: rgba(129, 140, 248, 0.18); color: var(--text); border-color: var(--accent-strong); box-shadow: 0 0 12px rgba(99, 102, 241, 0.35); }
.avatar {
  width: 1.4rem; height: 1.4rem; border-radius: 50%;
  background: linear-gradient(135deg, var(--accent-strong), #38bdf8);
  color: white; display: inline-flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 0.68rem;
}
.name { font-weight: 600; }
.role { font-size: 0.62rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-dim); border: 1px solid var(--border); padding: 0.05rem 0.4rem; border-radius: 999px; }
.role.admin { color: var(--success); border-color: rgba(52,211,153,0.35); }
.hint { font-size: 0.78rem; color: var(--text-dim); line-height: 1.55; margin: 0; }
.rules-demo { border-top: 1px solid var(--border); padding-top: 0.8rem; font-size: 0.78rem; color: var(--text-dim); }
.rules-demo ul { margin: 0.4rem 0 0; padding-left: 1.1rem; line-height: 1.6; }
.rules-demo code { color: var(--accent); background: rgba(129,140,248,0.1); padding: 0.05rem 0.35rem; border-radius: 4px; }
</style>