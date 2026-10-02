import { create } from 'zustand'
import type { User, AppRoute } from '@/types'

// ─── localStorage persistence key ───────────────────────

/** Maps user roles to their dashboard page. */
const ROLE_PAGE_MAP: Record<string, string> = {
  admin: 'admin-dashboard',
  team: 'team-dashboard',
  training: 'team-dashboard',
  client: 'client-dashboard',
}

const STORAGE_KEY = 'taskflow-auth'
const TOKEN_KEY = 'taskflow-token'

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

function loadPersistedToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY)
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

function persistToken(token: string | null) {
  if (typeof window === 'undefined') return
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token)
    } else {
      localStorage.removeItem(TOKEN_KEY)
    }
  } catch {
    // localStorage unavailable
  }
}

/**
 * Get the stored auth token (for use in fetch calls)
 */
export function getAuthToken(): string | null {
  return loadPersistedToken()
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
  'admin/calendar': { page: 'admin-dashboard', tab: 'calendar' },
  'admin/profile': { page: 'admin-dashboard', tab: 'profile' },
  // Team
  'team': { page: 'team-dashboard', tab: 'project' },
  'team/projects': { page: 'team-dashboard', tab: 'project' },
  'team/tasks': { page: 'team-dashboard', tab: 'task' },
  'team/time': { page: 'team-dashboard', tab: 'time-tracking' },
  'team/messages': { page: 'team-dashboard', tab: 'messages' },
  'team/screenshots': { page: 'team-dashboard', tab: 'screenshots' },
  'team/calendar': { page: 'team-dashboard', tab: 'calendar' },
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
    'time-tracking': 'time', messages: 'messages', screenshots: 'screenshots',
    calendar: 'calendar', profile: 'profile', task: 'tasks',
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

  login: (user: User, token: string) => void
  updateUser: (user: Partial<User>) => void
  logout: () => void
  /** Silent logout — clears auth state without calling the API (used when server rejects token) */
  forceLogout: () => void
  setRoute: (route: AppRoute) => void
  setSelectedProjectId: (id: string | null) => void
  setSelectedTaskId: (id: string | null) => void
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  /** Restore user from localStorage and verify the session token with the server */
  hydrateFromStorage: () => Promise<void>
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

  hydrateFromStorage: async () => {
    if (get()._hydrated) return

    const persisted = loadPersistedUser()
    const token = loadPersistedToken()

    // No persisted user at all — go straight to login
    if (!persisted || !token) {
      // Clean up any partial state
      persistUser(null)
      persistToken(null)
      set({ _hydrated: true })
      return
    }

    // We have a user + token in localStorage. Verify the session is still valid on the server.
    try {
      const res = await fetch('/api/auth/verify', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        if (data.valid && data.user) {
          // Session is valid — update user from server (may have role/name changes)
          const serverUser = data.user as User
          const hash = typeof window !== 'undefined' ? window.location.hash : ''
          let route = getDefaultRoute(serverUser.role)
          if (hash && hash !== '#') {
            const parsed = parseHash(hash)
            if (parsed && parsed.page === ROLE_PAGE_MAP[serverUser.role]) {
              route = parsed
            }
          }
          persistUser(serverUser)
          set({ user: serverUser, route, _hydrated: true })
          return
        }
      }
      // Token invalid/expired or any error — clear and go to login
      persistUser(null)
      persistToken(null)
      set({ user: null, route: { page: 'login' }, _hydrated: true })
    } catch {
      // Network error — allow offline use with cached user, but mark hydrated
      const hash = typeof window !== 'undefined' ? window.location.hash : ''
      let route = getDefaultRoute(persisted.role)
      if (hash && hash !== '#') {
        const parsed = parseHash(hash)
        if (parsed && parsed.page === ROLE_PAGE_MAP[persisted.role]) {
          route = parsed
        }
      }
      set({ user: persisted, route, _hydrated: true })
    }
  },

  login: (user, token) => {
    const route = getDefaultRoute(user.role)
    window.location.hash = routeToHash(route)
    persistUser(user)
    persistToken(token)
    set({ user, route, selectedProjectId: null, selectedTaskId: null, _hydrated: true })
  },
  updateUser: (updates) => {
    const current = get().user
    if (!current) return
    const updated = { ...current, ...updates }
    persistUser(updated)
    set({ user: updated })
  },
  logout: () => {
    // Call logout API to invalidate the server session
    const token = loadPersistedToken()
    if (token) {
      fetch('/api/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {}) // fire-and-forget
    }
    window.location.hash = ''
    persistUser(null)
    persistToken(null)
    set({ user: null, route: { page: 'login' }, selectedProjectId: null, selectedTaskId: null, sidebarOpen: false })
  },
  forceLogout: () => {
    window.location.hash = ''
    persistUser(null)
    persistToken(null)
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
      // Enforce role-based route access
      const user = useAuthStore.getState().user
      if (user) {
        const allowedPage = ROLE_PAGE_MAP[user.role]
        if (parsed.page === allowedPage) {
          // Additional tab-level enforcement for client users (no 'task' tab)
          if (user.role === 'client' && parsed.tab === 'task') {
            const defaultRoute = getDefaultRoute(user.role)
            window.location.hash = routeToHash(defaultRoute)
          } else {
            useAuthStore.setState({ route: parsed, selectedProjectId: null, selectedTaskId: null })
          }
        } else {
          // Redirect to the default route for this role
          const defaultRoute = getDefaultRoute(user.role)
          window.location.hash = routeToHash(defaultRoute)
        }
      } else {
        useAuthStore.setState({ route: parsed, selectedProjectId: null, selectedTaskId: null })
      }
    }
  })
}
