import { ref, onMounted } from 'vue'
import { ensureFirebase, useFirebaseState } from '@/config/firebase.init'

// Guest-first auth: the app works fully signed out. Google sign-in is only
// offered when a real Firebase project is configured (otherwise it would fail).
export function useFirebaseAuth() {
  const user = ref<any>(null)
  const loading = ref(true)
  const error = ref<string | null>(null)
  const firebaseReady = ref(false)

  async function init() {
    const status = await ensureFirebase()
    firebaseReady.value = status === 'ready'
    if (!firebaseReady.value) {
      loading.value = false // guest mode — no auth needed at all
      return
    }
    try {
      useFirebaseState().auth?.onAuthStateChanged((u) => {
        user.value = u
        loading.value = false
      })
    } catch {
      loading.value = false
    }
  }

  async function signInWithGoogle() {
    const fb = useFirebaseState()
    if (!fb.auth || !fb.googleProvider) {
      error.value = 'Firebase not configured — running in guest/offline mode.'
      return
    }
    try {
      const { signInWithPopup } = await import('firebase/auth')
      const result = await signInWithPopup(fb.auth, fb.googleProvider)
      user.value = result.user
    } catch (e: any) {
      error.value = e?.message || 'Sign-in failed'
    }
  }

  async function signOut() {
    try {
      const { signOut: firebaseSignOut } = await import('firebase/auth')
      await firebaseSignOut(useFirebaseState().auth!)
      user.value = null
    } catch (e: any) {
      error.value = e?.message || 'Sign-out failed'
    }
  }

  onMounted(() => {
    void init()
  })

  return { user, loading, error, firebaseReady, signInWithGoogle, signOut }
}