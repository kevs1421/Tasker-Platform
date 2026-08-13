import { create } from 'zustand'
import type { User, AppRoute } from '@/types'

// ─── localStorage persistence key ───────────────────────
const STORAGE_KEY = 'taskflow-auth'

function loadPersistedUser(): User | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as User
    if (parsed && parsed.id && parsed.email && parsed.role) return parsed
    return null
  } catch {
    return null
  }
}

function persistUser(user: User | null) {
  if (typeof window === 'undefined') return
  try {
    if (user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  } catch {
    // localStorage unavailable (e.g. private browsing quota)
  }
}

// ─── Hash-based tab routing ─────────────────────────────

const HASH_ROUTES: Record<string, AppRoute> = {
  // Admin
  'admin': { page: 'admin-dashboard', tab: 'overview' },
  'admin/overview': { page: 'admin-dashboard', tab: 'overview' },
  'admin/users': { page: 'admin-dashboard', tab: 'users' },
  'admin/onboarding': { page: 'admin-dashboard', tab: 'onboarding' },
  'admin/projects': { page: 'admin-dashboard', tab: 'project' },
  'admin/tasks': { page: 'admin-dashboard', tab: 'task-dashboard' },
  'admin/kanban': { page: 'admin-dashboard', tab: 'task-view' },
  'admin/time': { page: 'admin-dashboard', tab: 'time-tracking' },
  'admin/messages': { page: 'admin-dashboard', tab: 'messages' },
  'admin/screenshots': { page: 'admin-dashboard', tab: 'screenshots' },
  'admin/profile': { page: 'admin-dashboard', tab: 'profile' },
  // Team
  'team': { page: 'team-dashboard', tab: 'project' },
  'team/projects': { page: 'team-dashboard', tab: 'project' },
  'team/tasks': { page: 'team-dashboard', tab: 'task' },
  'team/time': { page: 'team-dashboard', tab: 'time-tracking' },
  'team/messages': { page: 'team-dashboard', tab: 'messages' },
  'team/screenshots': { page: 'team-dashboard', tab: 'screenshots' },
  'team/profile': { page: 'team-dashboard', tab: 'profile' },
  // Client
  'client': { page: 'client-dashboard', tab: 'project' },
  'client/onboarding': { page: 'client-dashboard', tab: 'onboarding' },
  'client/projects': { page: 'client-dashboard', tab: 'project' },
  'client/messages': { page: 'client-dashboard', tab: 'messages' },
  'client/profile': { page: 'client-dashboard', tab: 'profile' },
}

function parseHash(hash: string): AppRoute | null {
  const clean = hash.replace(/^#\/?/, '').replace(/\/$/, '')
  if (!clean) return null
  return HASH_ROUTES[clean] ?? null
}

function routeToHash(route: AppRoute): string {
  if (route.page === 'login') return ''
  const page = route.page.replace('-dashboard', '')
  const tabMap: Record<string, string> = {
    overview: 'overview', users: 'users', onboarding: 'onboarding',
    project: 'projects', 'task-dashboard': 'tasks', 'task-view': 'kanban',
    'time-tracking': 'time', messages: 'messages', screenshots: 'screenshots', profile: 'profile', task: 'tasks',
  }
  const tab = tabMap[route.tab] || route.tab
  return `#/${page}/${tab}`
}

// ─── Store ──────────────────────────────────────────────

interface AuthState {
  user: User | null
  route: AppRoute
  selectedProjectId: string | null
  selectedTaskId: string | null
  sidebarOpen: boolean
  _hydrated: boolean

  login: (user: User) => void
  logout: () => void
  setRoute: (route: AppRoute) => void
  setSelectedProjectId: (id: string | null) => void
  setSelectedTaskId: (id: string | null) => void
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  /** Restore user from localStorage (call once on client mount) */
  hydrateFromStorage: () => void
}

function getDefaultRoute(role: string): AppRoute {
  if (role === 'admin') return { page: 'admin-dashboard', tab: 'overview' }
  if (role === 'client') return { page: 'client-dashboard', tab: 'project' }
  // both 'team' and 'training' use the team dashboard
  return { page: 'team-dashboard', tab: 'project' }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  route: { page: 'login' },
  selectedProjectId: null,
  selectedTaskId: null,
  sidebarOpen: false,
  _hydrated: false,

  hydrateFromStorage: () => {
    if (get()._hydrated) return
    const persisted = loadPersistedUser()
    if (persisted) {
      // Restore the correct tab from the URL hash if it matches the user's role
      const hash = typeof window !== 'undefined' ? window.location.hash : ''
      let route = getDefaultRoute(persisted.role)
      if (hash && hash !== '#') {
        const parsed = parseHash(hash)
        if (parsed && parsed.page.includes(persisted.role)) {
          route = parsed
        }
      }
      set({ user: persisted, route, _hydrated: true })
    } else {
      set({ _hydrated: true })
    }
  },

  login: (user) => {
    const route = getDefaultRoute(user.role)
    window.location.hash = routeToHash(route)
    persistUser(user)
    set({ user, route, selectedProjectId: null, selectedTaskId: null, _hydrated: true })
  },
  logout: () => {
    window.location.hash = ''
    persistUser(null)
    set({ user: null, route: { page: 'login' }, selectedProjectId: null, selectedTaskId: null, sidebarOpen: false })
  },
  setRoute: (route) => {
    const prev = get().route
    if ('tab' in prev && 'tab' in route && prev.page === route.page && prev.tab === route.tab) return
    window.location.hash = routeToHash(route)
    set({ route, selectedProjectId: null, selectedTaskId: null })
  },
  setSelectedProjectId: (id) => set({ selectedProjectId: id }),
  setSelectedTaskId: (id) => set({ selectedTaskId: id }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}))

// ─── Browser back/forward support ───────────────────────

if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => {
    const hash = window.location.hash
    if (!hash || hash === '#') return
    const parsed = parseHash(hash)
    if (parsed && parsed.page !== 'login') {
      useAuthStore.setState({ route: parsed, selectedProjectId: null, selectedTaskId: null })
    }
  })
}