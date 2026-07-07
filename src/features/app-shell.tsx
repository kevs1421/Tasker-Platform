'use client'

import { useAuthStore } from '@/stores/auth'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { LogOut, Settings, User, LayoutDashboard, Menu, X, Bell, Shield, FolderKanban, ListTodo, MessageSquare, ClipboardCheck, UserCircle } from 'lucide-react'
import { getInitials, getRoleBadgeClasses } from '@/features/route-guard'
import type { AppRoute } from '@/types'
import { cn } from '@/lib/utils'
import { useState, useEffect } from 'react'

// ─── Header ─────────────────────────────────────────────
export function AppHeader() {
  const { user, logout } = useAuthStore()
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (user) {
      fetch(`/api/messages?userId=${user.id}`)
        .then(r => r.json())
        .then(d => setUnreadCount(d.conversations?.reduce((sum: number, c: { unread: number }) => sum + c.unread, 0) || 0))
        .catch(() => {})
    }
  }, [user])

  if (!user) return null
  const roleInfo = getRoleBadgeClasses(user.role)

  return (
    <header className="h-14 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex items-center justify-between px-4 lg:px-6 sticky top-0 z-50">
      <div className="flex items-center gap-3">
        <button onClick={() => useAuthStore.getState().toggleSidebar()} className="lg:hidden p-1.5 rounded-md hover:bg-accent">
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
            <LayoutDashboard className="w-4 h-4" />
          </div>
          <span className="font-semibold text-lg hidden sm:block">TaskFlow</span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="relative" onClick={() => useAuthStore.getState().setRoute(
          user.role === 'admin' ? { page: 'admin-dashboard', tab: 'messages' } :
          user.role === 'team' ? { page: 'team-dashboard', tab: 'messages' } :
          { page: 'client-dashboard', tab: 'messages' }
        )}>
          <MessageSquare className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-destructive text-destructive-foreground rounded-full text-[10px] font-bold flex items-center justify-center px-1">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 pl-2 pr-3">
              <Avatar className="w-7 h-7">
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">{getInitials(user.name)}</AvatarFallback>
              </Avatar>
              <div className="hidden sm:flex flex-col items-start">
                <span className="text-sm font-medium leading-tight">{user.name}</span>
                <Badge variant="secondary" className={cn('text-[10px] px-1.5 py-0', roleInfo)}>{user.role}</Badge>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">{user.name}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => useAuthStore.getState().setRoute(
              user.role === 'admin' ? { page: 'admin-dashboard', tab: 'profile' } :
              user.role === 'team' ? { page: 'team-dashboard', tab: 'profile' } :
              { page: 'client-dashboard', tab: 'profile' }
            )}>
              <User className="mr-2 h-4 w-4" />Profile
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}

// ─── Sidebar ────────────────────────────────────────────
interface NavItem {
  id: string
  label: string
  icon: React.ElementType
  route: AppRoute
  badge?: string
}

function getNavItems(role: string): NavItem[] {
  if (role === 'admin') return [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard, route: { page: 'admin-dashboard', tab: 'overview' } },
    { id: 'onboarding', label: 'Onboarding', icon: ClipboardCheck, route: { page: 'admin-dashboard', tab: 'onboarding' } },
    { id: 'projects', label: 'Projects', icon: FolderKanban, route: { page: 'admin-dashboard', tab: 'project' } },
    { id: 'tasks', label: 'Tasks', icon: ListTodo, route: { page: 'admin-dashboard', tab: 'task' } },
    { id: 'messages', label: 'Messages', icon: MessageSquare, route: { page: 'admin-dashboard', tab: 'messages' } },
    { id: 'profile', label: 'Profile', icon: UserCircle, route: { page: 'admin-dashboard', tab: 'profile' } },
  ]
  if (role === 'team') return [
    { id: 'projects', label: 'Projects', icon: FolderKanban, route: { page: 'team-dashboard', tab: 'project' } },
    { id: 'tasks', label: 'Tasks', icon: ListTodo, route: { page: 'team-dashboard', tab: 'task' } },
    { id: 'messages', label: 'Messages', icon: MessageSquare, route: { page: 'team-dashboard', tab: 'messages' } },
    { id: 'profile', label: 'Profile', icon: UserCircle, route: { page: 'team-dashboard', tab: 'profile' } },
  ]
  return [ // client
    { id: 'onboarding', label: 'Onboarding', icon: ClipboardCheck, route: { page: 'client-dashboard', tab: 'onboarding' } },
    { id: 'projects', label: 'Projects', icon: FolderKanban, route: { page: 'client-dashboard', tab: 'project' } },
    { id: 'messages', label: 'Messages', icon: MessageSquare, route: { page: 'client-dashboard', tab: 'messages' } },
    { id: 'profile', label: 'Profile', icon: UserCircle, route: { page: 'client-dashboard', tab: 'profile' } },
  ]
}

export function AppSidebar() {
  const { user, route, setRoute, sidebarOpen, setSidebarOpen } = useAuthStore()

  if (!user) return null
  const navItems = getNavItems(user.role)

  const isCurrentTab = (item: NavItem) => route.page === item.route.page && route.tab === item.route.tab

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="p-4 flex items-center justify-between">
        <Badge variant="secondary" className="text-xs">
          {user.role === 'admin' ? 'Admin Panel' : user.role === 'team' ? 'Team Workspace' : 'Client Portal'}
        </Badge>
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(false)}>
          <X className="w-4 h-4" />
        </Button>
      </div>
      <Separator className="mx-4" />
      <ScrollArea className="flex-1 px-3 py-3">
        <nav className="space-y-1">
          {navItems.map((item) => (
            <Button
              key={item.id}
              variant={isCurrentTab(item) ? 'secondary' : 'ghost'}
              className={cn('w-full justify-start gap-3 h-9', isCurrentTab(item) && 'font-medium')}
              onClick={() => { setRoute(item.route); setSidebarOpen(false) }}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </Button>
          ))}
        </nav>
      </ScrollArea>
      {user.role === 'admin' && (
        <>
          <Separator />
          <div className="p-4 flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-600" />
            <span className="text-xs text-muted-foreground">Admin Access</span>
          </div>
        </>
      )}
    </div>
  )

  return (
    <>
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      <aside className={cn(
        'fixed inset-y-0 left-0 z-50 w-64 bg-card border-r transform transition-transform duration-200 lg:hidden',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        {sidebarContent}
      </aside>
      <aside className="hidden lg:flex lg:w-60 lg:flex-col lg:border-r bg-card shrink-0">
        {sidebarContent}
      </aside>
    </>
  )
}

// ─── Dashboard Shell ────────────────────────────────────
export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AppHeader />
      <div className="flex flex-1 overflow-hidden">
        <AppSidebar />
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 lg:p-6 max-w-[1400px] mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}