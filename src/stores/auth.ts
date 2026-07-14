import { create } from 'zustand'
import type { User, AppRoute } from '@/types'

const STORAGE_KEY = 'taskflow-session'

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

function loadSession(): User | null {
  if (typeof window === 'undefined') return null
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return JSON.parse(stored) as User
  } catch { /* ignore */ }
  return null
}

function saveSession(user: User | null) {
  if (typeof window === 'undefined') return
  try {
    if (user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  } catch { /* ignore */ }
}

const cachedUser = loadSession()

export const useAuthStore = create<AuthState>((set) => ({
  user: cachedUser,
  route: cachedUser ? getDefaultRoute(cachedUser.role) : { page: 'login' },
  selectedProjectId: null,
  selectedTaskId: null,
  sidebarOpen: false,

  login: (user) => {
    saveSession(user)
    set({ user, route: getDefaultRoute(user.role), selectedProjectId: null, selectedTaskId: null })
  },
  logout: () => {
    saveSession(null)
    set({ user: null, route: { page: 'login' }, selectedProjectId: null, selectedTaskId: null, sidebarOpen: false })
  },
  setRoute: (route) => set({ route }),
  setSelectedProjectId: (id) => set({ selectedProjectId: id }),
  setSelectedTaskId: (id) => set({ selectedTaskId: id }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}))