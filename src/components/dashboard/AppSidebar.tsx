'use client'

import { useAuthStore } from '@/stores/auth'
import type { AdminView, TeamView } from '@/types'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { 
  LayoutDashboard, Kanban, List, FolderKanban, Users, Activity, 
  BarChart3, Clock, CheckCircle2, AlertCircle, Menu, X
} from 'lucide-react'
import { useState } from 'react'

interface SidebarItem {
  id: string
  label: string
  icon: React.ElementType
}

const adminItems: SidebarItem[] = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'projects', label: 'Projects', icon: FolderKanban },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'activity', label: 'Activity', icon: Activity },
]

const teamItems: SidebarItem[] = [
  { id: 'board', label: 'Board', icon: Kanban },
  { id: 'list', label: 'List', icon: List },
  { id: 'timeline', label: 'Timeline', icon: Clock },
]

interface AppSidebarProps {
  className?: string
}

export function AppSidebar({ className }: AppSidebarProps) {
  const { user, adminView, setAdminView, teamView, setTeamView } = useAuthStore()
  const [mobileOpen, setMobileOpen] = useState(false)

  if (!user) return null

  const isAdmin = user.role === 'admin'
  const isTeam = user.role === 'team'
  const currentView = isAdmin ? adminView : isTeam ? teamView : null
  const setCurrentView = isAdmin ? (v: string) => setAdminView(v as AdminView) : 
                          isTeam ? (v: string) => setTeamView(v as TeamView) : null

  const navItems = isAdmin ? adminItems : isTeam ? teamItems : []

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="p-4 flex items-center justify-between lg:justify-start gap-2">
        <Badge variant="secondary" className="text-xs">
          {user.role === 'admin' ? 'Admin Panel' : user.role === 'team' ? 'Team Workspace' : 'Client Portal'}
        </Badge>
        <Button 
          variant="ghost" 
          size="icon" 
          className="lg:hidden"
          onClick={() => setMobileOpen(false)}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {isAdmin && (
        <div className="px-4 mb-2">
          <QuickStats />
        </div>
      )}

      <Separator className="mx-4" />

      <ScrollArea className="flex-1 px-3 py-3">
        <nav className="space-y-1">
          {navItems.map((item) => (
            <Button
              key={item.id}
              variant={currentView === item.id ? 'secondary' : 'ghost'}
              className={cn(
                'w-full justify-start gap-3 h-9',
                currentView === item.id && 'font-medium'
              )}
              onClick={() => {
                setCurrentView?.(item.id)
                setMobileOpen(false)
              }}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </Button>
          ))}
        </nav>
      </ScrollArea>

      {isTeam && (
        <>
          <Separator />
          <div className="p-4">
            <MyTasksSummary />
          </div>
        </>
      )}
    </div>
  )

  return (
    <>
      {/* Mobile toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-3 left-3 z-50 lg:hidden"
        onClick={() => setMobileOpen(true)}
      >
        <Menu className="w-5 h-5" />
      </Button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar - Mobile */}
      <aside className={cn(
        'fixed inset-y-0 left-0 z-50 w-64 bg-card border-r transform transition-transform duration-200 lg:hidden',
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        {sidebarContent}
      </aside>

      {/* Sidebar - Desktop */}
      <aside className={cn(
        'hidden lg:flex lg:w-60 lg:flex-col lg:border-r bg-card',
        className
      )}>
        {sidebarContent}
      </aside>
    </>
  )
}

function QuickStats() {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 p-2.5">
        <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span className="text-xs font-medium">Done</span>
        </div>
        <p className="text-lg font-bold mt-0.5">24</p>
      </div>
      <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 p-2.5">
        <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
          <AlertCircle className="w-3.5 h-3.5" />
          <span className="text-xs font-medium">Overdue</span>
        </div>
        <p className="text-lg font-bold mt-0.5">3</p>
      </div>
    </div>
  )
}

function MyTasksSummary() {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">My Tasks</p>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">To Do</span>
          <span className="font-medium">5</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">In Progress</span>
          <span className="font-medium">3</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Completed</span>
          <span className="font-medium text-emerald-600">8</span>
        </div>
      </div>
    </div>
  )
}