'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { useAuthStore } from '@/stores/auth'
import { DashboardShell } from '@/features/app-shell'
import LoginPage from '@/features/login-page'
import { AdminOverview, AdminUsers, AdminOnboarding, AdminProjects, AdminTasks, AdminMessages, AdminProfile, AdminTimeTracking } from '@/features/admin-dashboard'
import { TeamProjects, TeamTasks, TeamMessages, TeamProfile, TeamTimeTracking } from '@/features/team-dashboard'
import { ClientOnboarding, ClientProjects, ClientMessages, ClientProfile } from '@/features/client-dashboard'
import { TeamScreenshots } from '@/features/screenshot-capture'
import { AdminScreenshotReport } from '@/features/screenshot-report'
import { CalendarNotesDashboard } from '@/features/calendar-note-widget'
import { AnimatePresence, motion } from 'framer-motion'

const emptySubscribe = () => () => {}
function useMounted() {
  return useSyncExternalStore(emptySubscribe, () => true, () => false)
}

function AdminDashboard() {
  const { route } = useAuthStore()
  if (route.page !== 'admin-dashboard') return null
  return (
    <AnimatePresence mode="wait">
      <motion.div key={route.tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
        {route.tab === 'overview' && <AdminOverview />}
        {route.tab === 'users' && <AdminUsers />}
        {route.tab === 'onboarding' && <AdminOnboarding />}
        {route.tab === 'project' && <AdminProjects />}
        {route.tab === 'task-dashboard' && <AdminTasks />}
        {route.tab === 'task-view' && <TeamTasks />}
        {route.tab === 'time-tracking' && <AdminTimeTracking />}
        {route.tab === 'messages' && <AdminMessages />}
        {route.tab === 'screenshots' && <AdminScreenshotReport />}
        {route.tab === 'calendar' && <CalendarNotesDashboard />}
        {route.tab === 'profile' && <AdminProfile />}
      </motion.div>
    </AnimatePresence>
  )
}

function TeamDashboard() {
  const { route } = useAuthStore()
  if (route.page !== 'team-dashboard') return null
  return (
    <AnimatePresence mode="wait">
      <motion.div key={route.tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
        {route.tab === 'project' && <TeamProjects />}
        {route.tab === 'task' && <TeamTasks />}
        {route.tab === 'time-tracking' && <TeamTimeTracking />}
        {route.tab === 'messages' && <TeamMessages />}
        {route.tab === 'screenshots' && <TeamScreenshots />}
        {route.tab === 'calendar' && <CalendarNotesDashboard />}
        {route.tab === 'profile' && <TeamProfile />}
      </motion.div>
    </AnimatePresence>
  )
}

function ClientDashboard() {
  const { route } = useAuthStore()
  if (route.page !== 'client-dashboard') return null
  return (
    <AnimatePresence mode="wait">
      <motion.div key={route.tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
        {route.tab === 'onboarding' && <ClientOnboarding />}
        {route.tab === 'project' && <ClientProjects />}
        {route.tab === 'messages' && <ClientMessages />}
        {route.tab === 'profile' && <ClientProfile />}
      </motion.div>
    </AnimatePresence>
  )
}

export default function Home() {
  const mounted = useMounted()
  const user = useAuthStore((s) => s.user)
  const route = useAuthStore((s) => s.route)
  const hydrated = useAuthStore((s) => s._hydrated)
  const hydrateFromStorage = useAuthStore((s) => s.hydrateFromStorage)

  // Hydrate user from localStorage and verify session token on first client mount
  useEffect(() => {
    hydrateFromStorage()
  }, [hydrateFromStorage])

  // Before hydration completes on client, show a loading state (avoids blank page)
  if (!mounted || !hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <img src="/logo.svg" alt="Yber Digitals" className="w-12 h-12 rounded-2xl object-contain animate-pulse" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user || route.page === 'login') {
    return <LoginPage />
  }

  return (
    <DashboardShell>
      <AdminDashboard />
      <TeamDashboard />
      <ClientDashboard />
    </DashboardShell>
  )
}
