'use client'

import { useAuthStore } from '@/stores/auth'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { LogOut, User, LayoutDashboard, Menu, X, Shield, FolderKanban, ListTodo, MessageSquare, ClipboardCheck, UserCircle, Users, Sun, Moon, Kanban, Clock, Play, Square, Loader2, Timer, WifiOff, Camera, CameraOff, Hourglass } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { getInitials, getRoleBadgeClasses } from '@/features/route-guard'
import type { AppRoute } from '@/types'
import { cn } from '@/lib/utils'
import { useState, useEffect, useCallback, useRef, useSyncExternalStore } from 'react'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'

// ─── Time In/Out Widget ──────────────────────────────────

interface ActiveTimeEntry {
  id: string
  timeIn: string
  projectId?: string | null
  project?: { id: string; name: string } | null
  task?: { id: string; title: string } | null
  description?: string | null
}

interface Project {
  id: string
  name: string
}

interface Task {
  id: string
  title: string
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function TimeInOutWidget({ userId }: { userId: string }) {
  const [activeEntry, setActiveEntry] = useState<ActiveTimeEntry | null>(null)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [loading, setLoading] = useState(true)
  const [clockingIn, setClockingIn] = useState(false)
  const [clockingOut, setClockingOut] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)

  // Time In dialog state
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [tasks, setTasks] = useState<Task[]>([])
  const [selectedTaskId, setSelectedTaskId] = useState<string>('')
  const [description, setDescription] = useState('')
  const [loadingProjects, setLoadingProjects] = useState(false)
  const [loadingTasks, setLoadingTasks] = useState(false)

  // Auto-screenshot state
  const [autoScreenshot, setAutoScreenshot] = useState(true)
  const [screenshotDelay, setScreenshotDelay] = useState('0')
  const [capturingScreenshot, setCapturingScreenshot] = useState(false)
  const screenshotTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number>(0)

  // Fetch active timer on mount
  const fetchActiveTimer = useCallback(async () => {
    try {
      const res = await fetch(`/api/time-entries?userId=${userId}&active=true`)
      if (res.ok) {
        const data = await res.json()
        const entries = data.timeEntries || []
        const entry: ActiveTimeEntry | null = entries.find((e: ActiveTimeEntry) => e.timeIn) || null
        setActiveEntry(entry)
        if (entry) {
          startTimeRef.current = new Date(entry.timeIn).getTime()
          setElapsedMs(Date.now() - startTimeRef.current)
        }
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    fetchActiveTimer()
  }, [fetchActiveTimer])

  // 1-second interval for elapsed display
  useEffect(() => {
    if (activeEntry) {
      intervalRef.current = setInterval(() => {
        setElapsedMs(Date.now() - startTimeRef.current)
      }, 1000)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [activeEntry])

  // Open time-in dialog and fetch projects
  const handleOpenDialog = async () => {
    setDialogOpen(true)
    setSelectedProjectId('')
    setSelectedTaskId('')
    setDescription('')
    setTasks([])
    setLoadingProjects(true)
    try {
      const res = await fetch('/api/projects')
      if (res.ok) {
        const data = await res.json()
        setProjects(data.projects ?? [])
      }
    } catch {
      // silent
    } finally {
      setLoadingProjects(false)
    }
  }

  // Fetch tasks when project changes
  const handleProjectChange = async (projectId: string) => {
    setSelectedProjectId(projectId)
    setSelectedTaskId('')
    setTasks([])
    if (!projectId) return
    setLoadingTasks(true)
    try {
      const res = await fetch(`/api/projects/${projectId}`)
      if (res.ok) {
        const data = await res.json()
        setTasks(data.project?.tasks ?? [])
      }
    } catch {
      // silent
    } finally {
      setLoadingTasks(false)
    }
  }

  // Capture auto-screenshot after optional delay
  const captureAutoScreenshot = useCallback(async (projId: string, taskId: string, desc: string, delay: number, userRole: string) => {
    if (delay > 0) {
      setCapturingScreenshot(true)
      // Show countdown toast
      toast.info(`Screenshot will be captured in ${delay} second${delay > 1 ? 's' : ''}...`, { duration: (delay * 1000) - 500 })
      await new Promise(resolve => {
        screenshotTimerRef.current = setTimeout(resolve, delay * 1000)
      })
    }
    try {
      const res = await fetch('/api/screenshots/auto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          userRole,
          projectId: projId || null,
          taskId: taskId || null,
          description: desc || null,
          delaySeconds: delay,
        }),
      })
      if (res.ok) {
        toast.success('Screenshot captured', { description: 'Proof-of-work screenshot saved' })
      } else {
        // Non-blocking — don't fail the whole clock-in
        toast.error('Auto-screenshot failed', { description: 'Time-in was still recorded' })
      }
    } catch {
      // Silent fail — screenshot is optional
    } finally {
      setCapturingScreenshot(false)
    }
  }, [userId])

  // Clock in
  const handleClockIn = async () => {
    const user = useAuthStore.getState().user
    setClockingIn(true)
    try {
      const body: Record<string, unknown> = { action: 'time_in', userId }
      if (selectedProjectId) body.projectId = selectedProjectId
      if (selectedTaskId) body.taskId = selectedTaskId
      if (description.trim()) body.description = description.trim()

      const res = await fetch('/api/time-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to clock in')
      }
      const data = await res.json()
      const entry = data.timeEntry
      if (entry) {
        setActiveEntry(entry)
        startTimeRef.current = new Date(entry.timeIn).getTime()
        setElapsedMs(Date.now() - startTimeRef.current)
      }
      setDialogOpen(false)
      toast.success('Clocked in successfully')

      // Auto-screenshot (fire-and-forget, after dialog closes)
      if (autoScreenshot && user && user.role !== 'client') {
        const delay = parseInt(screenshotDelay) || 0
        captureAutoScreenshot(selectedProjectId, selectedTaskId, description, delay, user.role)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to clock in')
    } finally {
      setClockingIn(false)
    }
  }

  // Clock out
  const handleClockOut = async () => {
    if (!activeEntry) return
    setClockingOut(true)
    try {
      const res = await fetch(`/api/time-entries/${activeEntry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'time_out' }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to clock out')
      }
      setActiveEntry(null)
      setElapsedMs(0)
      toast.success('Clocked out successfully')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to clock out')
    } finally {
      setClockingOut(false)
    }
  }

  if (loading) {
    return (
      <div className="mb-3 rounded-lg border bg-muted/30 px-3 py-2 flex items-center justify-center gap-2">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Loading timer…</span>
      </div>
    )
  }

  if (activeEntry) {
    return (
      <>
        {capturingScreenshot && (
          <div className="mb-2 rounded-lg border border-primary/30 bg-primary/5 dark:bg-primary/10 px-3 py-1.5 flex items-center gap-2 animate-pulse">
            <Camera className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="text-[11px] text-primary font-medium">Capturing screenshot in {screenshotDelay}s...</span>
            <Loader2 className="w-3 h-3 animate-spin text-primary ml-auto" />
          </div>
        )}
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30 px-3 py-2 flex items-center gap-2">
          <Timer className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-[10px] text-red-600 dark:text-red-400 font-medium leading-none mb-0.5">
              {activeEntry.project?.name || 'No Project'}
            </div>
            <div className="text-xs font-mono font-semibold text-red-700 dark:text-red-300 tabular-nums">
              {formatElapsed(elapsedMs)}
            </div>
          </div>
          <Button
            size="sm"
            variant="destructive"
            className="h-7 px-2 text-[11px] shrink-0"
            onClick={handleClockOut}
            disabled={clockingOut}
          >
            {clockingOut ? <Loader2 className="w-3 h-3 animate-spin" /> : <Square className="w-3 h-3 mr-1" />}
            Out
          </Button>
        </div>
      </>
    )
  }

  return (
    <>
      <button
        onClick={handleOpenDialog}
        className="mb-3 w-full rounded-lg border border-green-200 bg-green-50 dark:border-green-900/50 dark:bg-green-950/30 px-3 py-2 flex items-center justify-center gap-2 hover:bg-green-100 dark:hover:bg-green-950/50 transition-colors cursor-pointer"
      >
        <Play className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
        <Clock className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
        <span className="text-xs font-medium text-green-700 dark:text-green-300">Time In</span>
      </button>

      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open)
        // Cleanup timer if dialog is closed
        if (!open && screenshotTimerRef.current) {
          clearTimeout(screenshotTimerRef.current)
          screenshotTimerRef.current = null
          setCapturingScreenshot(false)
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Clock In</DialogTitle>
            <DialogDescription>Optionally select a project, task, and add a description before clocking in.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-sm">Project (optional)</Label>
              <Select value={selectedProjectId} onValueChange={handleProjectChange} disabled={loadingProjects}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder={loadingProjects ? 'Loading…' : 'Select project'} />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedProjectId && (
              <div className="space-y-2">
                <Label className="text-sm">Task (optional)</Label>
                <Select value={selectedTaskId} onValueChange={setSelectedTaskId} disabled={loadingTasks}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder={loadingTasks ? 'Loading…' : 'Select task'} />
                  </SelectTrigger>
                  <SelectContent>
                    {tasks.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                    ))}
                    </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label className="text-sm">Description (optional)</Label>
              <Input
                placeholder="What are you working on?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="h-9"
              />
            </div>

            {/* Auto-screenshot section */}
            <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {autoScreenshot
                    ? <Camera className="w-4 h-4 text-primary" />
                    : <CameraOff className="w-4 h-4 text-muted-foreground" />}
                  <Label className="text-sm font-medium cursor-pointer" onClick={() => setAutoScreenshot(!autoScreenshot)}>
                    Auto Screenshot
                  </Label>
                </div>
                <Checkbox
                  checked={autoScreenshot}
                  onCheckedChange={(checked) => setAutoScreenshot(checked === true)}
                  className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                />
              </div>
              {autoScreenshot && (
                <div className="flex items-center gap-2 pl-6">
                  <Hourglass className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <Label className="text-xs text-muted-foreground whitespace-nowrap">Capture delay:</Label>
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      min="0"
                      max="300"
                      step="5"
                      value={screenshotDelay}
                      onChange={(e) => setScreenshotDelay(e.target.value)}
                      className="h-8 w-20 text-center text-sm"
                    />
                    <span className="text-xs text-muted-foreground">sec</span>
                  </div>
                  <Select
                    value={
                      screenshotDelay === '0' ? 'instant' :
                      screenshotDelay === '5' ? '5s' :
                      screenshotDelay === '10' ? '10s' :
                      screenshotDelay === '30' ? '30s' :
                      screenshotDelay === '60' ? '60s' : 'custom'
                    }
                    onValueChange={(v) => {
                      if (v === 'custom') return
                      setScreenshotDelay(v === 'instant' ? '0' : v.replace('s', ''))
                    }}
                  >
                    <SelectTrigger className="h-8 w-24 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="instant">Instant</SelectItem>
                      <SelectItem value="5s">5 sec</SelectItem>
                      <SelectItem value="10s">10 sec</SelectItem>
                      <SelectItem value="30s">30 sec</SelectItem>
                      <SelectItem value="60s">1 min</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              {autoScreenshot && (
                <p className="text-[11px] text-muted-foreground pl-6">
                  A proof-of-work screenshot will be captured{parseInt(screenshotDelay) > 0 ? ` after ${screenshotDelay}s` : ' instantly'} when you clock in.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="h-9">Cancel</Button>
            <Button onClick={handleClockIn} disabled={clockingIn || capturingScreenshot} className="h-9 bg-green-600 hover:bg-green-700 text-white">
              {(clockingIn || capturingScreenshot) && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              <Play className="w-3.5 h-3.5 mr-1.5" />
              {capturingScreenshot ? `Capturing in ${screenshotDelay}s...` : 'Clock In'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ─── Header ─────────────────────────────────────────────
export function AppHeader() {
  const { user, logout } = useAuthStore()
  const { theme, setTheme } = useTheme()
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false)
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
          <img src="/logo.svg" alt="Yber Digitals" className="w-8 h-8 rounded-lg object-contain" />
          <span className="font-semibold text-lg hidden sm:block">Yber Digitals</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {mounted && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                {theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              <DropdownMenuItem onClick={() => setTheme('light')} className={cn(theme === 'light' && 'bg-accent')}>
                <Sun className="mr-2 h-4 w-4" />Light
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme('dark')} className={cn(theme === 'dark' && 'bg-accent')}>
                <Moon className="mr-2 h-4 w-4" />Dark
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
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
    { id: 'users', label: 'Users', icon: Users, route: { page: 'admin-dashboard', tab: 'users' } },
    { id: 'onboarding', label: 'Onboarding', icon: ClipboardCheck, route: { page: 'admin-dashboard', tab: 'onboarding' } },
    { id: 'projects', label: 'Projects', icon: FolderKanban, route: { page: 'admin-dashboard', tab: 'project' } },
    { id: 'task-dashboard', label: 'Task Dashboard', icon: ListTodo, route: { page: 'admin-dashboard', tab: 'task-dashboard' } },
    { id: 'task-view', label: 'Task', icon: Kanban, route: { page: 'admin-dashboard', tab: 'task-view' } },
    { id: 'time-tracking', label: 'Time Tracking', icon: Clock, route: { page: 'admin-dashboard', tab: 'time-tracking' } },
    { id: 'messages', label: 'Messages', icon: MessageSquare, route: { page: 'admin-dashboard', tab: 'messages' } },
    { id: 'screenshots', label: 'Screenshot Report', icon: Camera, route: { page: 'admin-dashboard', tab: 'screenshots' } },
    { id: 'profile', label: 'Profile', icon: UserCircle, route: { page: 'admin-dashboard', tab: 'profile' } },
  ]
  if (role === 'team' || role === 'training') return [
    { id: 'projects', label: 'Projects', icon: FolderKanban, route: { page: 'team-dashboard', tab: 'project' } },
    { id: 'task', label: 'Task', icon: Kanban, route: { page: 'team-dashboard', tab: 'task' } },
    { id: 'time-tracking', label: 'Time Tracking', icon: Clock, route: { page: 'team-dashboard', tab: 'time-tracking' } },
    { id: 'messages', label: 'Messages', icon: MessageSquare, route: { page: 'team-dashboard', tab: 'messages' } },
    { id: 'screenshots', label: 'Screenshots', icon: Camera, route: { page: 'team-dashboard', tab: 'screenshots' } },
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
  const showTimeWidget = user.role === 'admin' || user.role === 'team'

  const isCurrentTab = (item: NavItem) => route.page === item.route.page && route.tab === item.route.tab

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="p-4 flex items-center justify-between">
        <Badge variant="secondary" className="text-xs">
          {user.role === 'admin' ? 'Admin Panel' : user.role === 'client' ? 'Client Portal' : user.role === 'training' ? 'Training' : 'Team Workspace'}
        </Badge>
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(false)}>
          <X className="w-4 h-4" />
        </Button>
      </div>
      <Separator className="mx-4" />
      <ScrollArea className="flex-1 px-3 py-3">
        {showTimeWidget && (
          <TimeInOutWidget userId={user.id} />
        )}
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
            <Shield className="w-4 h-4 text-primary" />
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
function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(() => {
    if (typeof navigator === 'undefined') return false
    return !navigator.onLine
  })

  useEffect(() => {
    const handleOnline = () => setIsOffline(false)
    const handleOffline = () => setIsOffline(true)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (!isOffline) return null

  return (
    <div className="bg-amber-500 text-white text-center text-xs font-medium py-1.5 px-4 flex items-center justify-center gap-2">
      <WifiOff className="w-3.5 h-3.5 shrink-0" />
      <span>You are offline. Some features may be unavailable until connection is restored.</span>
    </div>
  )
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <OfflineBanner />
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