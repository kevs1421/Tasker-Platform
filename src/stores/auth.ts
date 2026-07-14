import { create } from 'zustand'
import type { User, AppRoute } from '@/types'

// ─── Demo users for auto-login via URL hash ─────────────
const DEMO_USERS: Record<string, User> = {
  admin: { id: 'demo-admin', email: 'admin@taskflow.com', name: 'Alex Morgan', role: 'admin', status: 'active', createdAt: '', updatedAt: '' },
  team: { id: 'demo-team', email: 'sarah@taskflow.com', name: 'Sarah Chen', role: 'team', status: 'active', createdAt: '', updatedAt: '' },
  client: { id: 'demo-client', email: 'john@client.com', name: 'John Smith', role: 'client', status: 'active', createdAt: '', updatedAt: '' },
}

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
  'admin/profile': { page: 'admin-dashboard', tab: 'profile' },
  // Team
  'team': { page: 'team-dashboard', tab: 'project' },
  'team/projects': { page: 'team-dashboard', tab: 'project' },
  'team/tasks': { page: 'team-dashboard', tab: 'task' },
  'team/time': { page: 'team-dashboard', tab: 'time-tracking' },
  'team/messages': { page: 'team-dashboard', tab: 'messages' },
  'team/profile': { page: 'team-dashboard', tab: 'profile' },
  // Client
  'client': { page: 'client-dashboard', tab: 'project' },
  'client/onboarding': { page: 'client-dashboard', tab: 'onboarding' },
  'client/projects': { page: 'client-dashboard', tab: 'project' },
  'client/messages': { page: 'client-dashboard', tab: 'messages' },
  'client/profile': { page: 'client-dashboard', tab: 'profile' },
}

function parseHash(hash: string): { user: User | null; route: AppRoute } {
  const clean = hash.replace(/^#\/?/, '').replace(/\/$/, '')
  if (!clean) return { user: null, route: { page: 'login' } }

  if (HASH_ROUTES[clean]) {
    const role = clean.split('/')[0]
    return { user: DEMO_USERS[role] || null, route: HASH_ROUTES[clean] }
  }

  const prefix = clean.split('/')[0]
  if (DEMO_USERS[prefix]) {
    return { user: DEMO_USERS[prefix], route: getDefaultRoute(prefix) }
  }

  return { user: null, route: { page: 'login' } }
}

function routeToHash(route: AppRoute): string {
  if (route.page === 'login') return ''
  const page = route.page.replace('-dashboard', '')
  const tabMap: Record<string, string> = {
    overview: 'overview', users: 'users', onboarding: 'onboarding',
    project: 'projects', 'task-dashboard': 'tasks', 'task-view': 'kanban',
    'time-tracking': 'time', messages: 'messages', profile: 'profile', task: 'tasks',
  }
  const tab = tabMap[route.tab] || route.tab
  return `#/${page}/${tab}`
}

// ─── Helpers ────────────────────────────────────────────

interface AuthState {
  user: User | null
  route: AppRoute
  selectedProjectId: string | null
  selectedTaskId: string | null
  sidebarOpen: boolean

  login: (user: User) => void
  logout: () => void
  setRoute: (route: AppRoute) => void
  setSelectedProjectId: (id: string | null) => void
  setSelectedTaskId: (id: string | null) => void
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
}

function getDefaultRoute(role: string): AppRoute {
  if (role === 'admin') return { page: 'admin-dashboard', tab: 'overview' }
  if (role === 'client') return { page: 'client-dashboard', tab: 'project' }
  return { page: 'team-dashboard', tab: 'project' }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  route: { page: 'login' },
  selectedProjectId: null,
  selectedTaskId: null,
  sidebarOpen: false,

  login: (user) => {
    const route = getDefaultRoute(user.role)
    window.location.hash = routeToHash(route)
    set({ user, route, selectedProjectId: null, selectedTaskId: null })
  },
  logout: () => {
    window.location.hash = ''
    set({ user: null, route: { page: 'login' }, selectedProjectId: null, selectedTaskId: null, sidebarOpen: false })
  },
  setRoute: (route) => {
    const prev = get().route
    if (prev.page === route.page && prev.tab === route.tab) return
    window.location.hash = routeToHash(route)
    set({ route, selectedProjectId: null, selectedTaskId: null })
  },
  setSelectedProjectId: (id) => set({ selectedProjectId: id }),
  setSelectedTaskId: (id) => set({ selectedTaskId: id }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}))

// ─── Browser back/forward: role switch needs reload ─────

if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => {
    const hash = window.location.hash
    if (!hash || hash === '#') return
    const parsed = parseHash(hash)
    if (parsed.user) {
      const current = get().user
      if (!current || current.role !== parsed.user.role) {
        window.location.reload()
        return
      }
    }
    if (parsed.route.page !== 'login') {
      set({ route: parsed.route, selectedProjectId: null, selectedTaskId: null })
    }
  })
}