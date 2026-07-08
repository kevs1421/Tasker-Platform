import { create } from 'zustand'
import type { User, AppRoute } from '@/types'

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

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  route: { page: 'login' },
  selectedProjectId: null,
  selectedTaskId: null,
  sidebarOpen: false,

  login: (user) => set({ user, route: getDefaultRoute(user.role), selectedProjectId: null, selectedTaskId: null }),
  logout: () => set({ user: null, route: { page: 'login' }, selectedProjectId: null, selectedTaskId: null, sidebarOpen: false }),
  setRoute: (route) => set({ route }),
  setSelectedProjectId: (id) => set({ selectedProjectId: id }),
  setSelectedTaskId: (id) => set({ selectedTaskId: id }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}))