<template>
  <section class="retrieval-qa card" aria-label="Archive question answering">
    <div class="qa-head">
      <h3>Archive Q&amp;A</h3>
      <span :class="['badge', lastAnswer?.grounded ? 'ok' : 'warn']">
        {{ lastAnswer?.grounded ? 'grounded in archive' : 'no match' }}
      </span>
    </div>

    <div class="qa-input-row">
      <input
        v-model="question"
        type="text"
        placeholder="Ask your archive: e.g. what did grandma say about dumplings?"
        @keyup.enter="ask"
        aria-label="Question for the archive"
      />
      <button @click="ask" :disabled="asking || !question.trim()" class="ask-btn">
        {{ asking ? 'Searching…' : 'Ask' }}
      </button>
    </div>

    <div v-if="lastAnswer" class="answer-block" role="status">
      <p class="answer-text">{{ lastAnswer.answer }}</p>

      <div v-if="lastAnswer.hits.length" class="citations">
        <div v-for="hit in lastAnswer.hits" :key="hit.memoryId + hit.title" class="citation">
          <div class="cite-head">
            <span class="cite-title">{{ hit.title }}</span>
            <span class="cite-score">{{ Math.round(hit.score * 100) }}% match</span>
          </div>
          <blockquote class="cite-excerpt">“{{ hit.excerpt }}”</blockquote>
          <div class="cite-terms">
            matched terms:
            <span v-for="term in hit.matchedTerms" :key="term" class="term">{{ term }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="suggest">
      <span>Try:</span>
      <button v-for="s in suggestions" :key="s" @click="useSuggestion(s)" class="suggest-btn">{{ s }}</button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { retrieveAndAnswer, type RetrievalAnswer } from '@/lib/retriever'
import { useMemoryStore } from '@/stores/memoryStore'

const store = useMemoryStore()
const question = ref('')
const asking = ref(false)
const lastAnswer = ref<RetrievalAnswer | null>(null)

async function ask() {
  const q = question.value.trim()
  if (!q) return
  asking.value = true
  // retrieval is synchronous & offline; keep a microtask so UI can render the searching state
  await new Promise((r) => setTimeout(r, 60))
  lastAnswer.value = retrieveAndAnswer(store.memories, q)
  asking.value = false
}

function useSuggestion(s: string) {
  question.value = s
  void ask()
}

const suggestions = [
  'what did grandma say about dumplings',
  'orchestra recital',
  'grandpa orchard pears',
  'who taught this family to cook'
]
</script>

<style scoped>
.retrieval-qa { padding: 1.25rem 1.5rem; display: flex; flex-direction: column; gap: 0.9rem; }
.qa-head { display: flex; align-items: center; justify-content: space-between; gap: 0.7rem; }
.qa-head h3 { margin: 0; font-size: 1.02rem; }
.qa-input-row { display: flex; gap: 0.6rem; }
.qa-input-row input { flex: 1; font-size: 0.86rem; }
.ask-btn { padding: 0.55rem 1.2rem; background: var(--accent-strong); color: white; border-color: transparent; font-weight: 600; }
.ask-btn:hover:not(:disabled) { background: var(--accent); }
.answer-block {
  background: rgba(255,255,255,0.025); border: 1px solid var(--border);
  border-radius: 12px; padding: 1rem;
}
.answer-text { margin: 0; white-space: pre-line; font-size: 0.88rem; color: var(--text); line-height: 1.6; }
.citations { margin-top: 0.9rem; display: flex; flex-direction: column; gap: 0.7rem; }
.citation { border-left: 2px solid var(--accent-strong); padding-left: 0.8rem; }
.cite-head { display: flex; justify-content: space-between; gap: 0.6rem; align-items: baseline; }
.cite-title { font-size: 0.82rem; color: var(--text-muted); font-weight: 600; }
.cite-score { font-size: 0.68rem; color: var(--success); }
.cite-excerpt { margin: 0.35rem 0 0.3rem; font-size: 0.84rem; color: var(--text-dim); line-height: 1.55; font-style: italic; }
.cite-terms { font-size: 0.68rem; color: var(--text-dim); }
.term { color: var(--accent); margin-right: 0.4rem; }
.suggest { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; font-size: 0.74rem; color: var(--text-dim); }
.suggest-btn { background: transparent; border: 1px solid var(--border); color: var(--text-muted); padding: 0.28rem 0.7rem; border-radius: 999px; font-size: 0.72rem; }
.suggest-btn:hover { border-color: var(--accent-strong); color: var(--accent); }
</style>