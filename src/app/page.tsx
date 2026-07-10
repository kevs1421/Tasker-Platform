'use client'

import { useAuthStore } from '@/stores/auth'
import { DashboardShell } from '@/features/app-shell'
import LoginPage from '@/features/login-page'
import { AdminOverview, AdminUsers, AdminOnboarding, AdminProjects, AdminTasks, AdminMessages, AdminProfile } from '@/features/admin-dashboard'
import { TeamProjects, TeamTasks, TeamMessages, TeamProfile } from '@/features/team-dashboard'
import { TeamMyTasks } from '@/features/team-my-tasks'
import { ClientOnboarding, ClientProjects, ClientMessages, ClientProfile } from '@/features/client-dashboard'
import { AnimatePresence, motion } from 'framer-motion'

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
        {route.tab === 'task' && <AdminTasks />}
        {route.tab === 'messages' && <AdminMessages />}
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
        {route.tab === 'tasks' && <TeamMyTasks />}
        {route.tab === 'task-dashboard' && <TeamTasks />}
        {route.tab === 'messages' && <TeamMessages />}
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
  const { user, route } = useAuthStore()

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