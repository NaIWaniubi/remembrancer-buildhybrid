import { createRouter, createWebHistory } from 'vue-router'

// Guest-first routing: /dashboard is reachable without signing in.
// Firebase Auth (when a real project is configured) is an optional upgrade,
// not an entry barrier — this is core to the degraded production route.
const routes = [
  {
    path: '/',
    name: 'home',
    component: () => import('@/views/HomeView.vue'),
    meta: { title: 'Remembrancer — Home' }
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { title: 'Enter — Guest or Sign In' }
  },
  {
    path: '/dashboard/:familyId?',
    name: 'dashboard',
    component: () => import('@/views/DashboardView.vue'),
    meta: { title: 'Family Dashboard', guestOk: true }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to) => {
  if (to.meta.title) document.title = String(to.meta.title)
  // no auth wall — guests always pass; auth state lives in the layout only
  return true
})

export default router