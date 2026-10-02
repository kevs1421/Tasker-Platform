'use client'

import { useAuthStore } from '@/stores/auth'
import { authFetch } from '@/lib/client-fetch'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { LogOut, User, LayoutDashboard, Menu, X, Shield, FolderKanban, MessageSquare, ClipboardCheck, UserCircle, Users, Sun, Moon, Kanban, Clock, Play, Square, Loader2, Timer, WifiOff, Camera, RefreshCw, ArrowRightLeft, ListTodo, CalendarDays } from 'lucide-react'
import { getInitials, getRoleBadgeClasses } from '@/features/route-guard'
import type { AppRoute } from '@/types'
import { cn } from '@/lib/utils'
import { formatElapsed, formatCountdown } from '@/lib/format'
import { useState, useEffect, useCallback, useRef, useSyncExternalStore } from 'react'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import { screenshotSession } from '@/lib/screenshot-capture'
import { useTimeTrackingStore, useScreenshotStore } from '@/stores/time-tracking'
import type { ActiveTimeSession } from '@/stores/time-tracking'

// ─── Time In/Out Widget ──────────────────────────────────

type ActiveTimeEntry = ActiveTimeSession

type Project = Pick<import('@/types').Project, 'id' | 'name'>
type Task = Pick<{ id: string; title: string }, 'id' | 'title'>

// formatElapsed and formatCountdown are now imported from @/lib/format

function TimeInOutWidget({ userId }: { userId: string }) {
  // Shared stores
  const {
    activeSession,
    clockingIn,
    clockingOut,
    setActiveSession,
    setClockingIn,
    setClockingOut,
    initialized,
    setInitialized,
  } = useTimeTrackingStore()
  const {
    isCapturing,
    captureCount,
    nextCaptureInMs,
    setIsCapturing,
    setCaptureCount,
    setNextCaptureInMs,
    resetScreenshotState,
  } = useScreenshotStore()

  const [elapsedMs, setElapsedMs] = useState(0)
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)

  // Time In dialog state
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [tasks, setTasks] = useState<Task[]>([])
  const [selectedTaskId, setSelectedTaskId] = useState<string>('')
  const [description, setDescription] = useState('')
  const [loadingProjects, setLoadingProjects] = useState(false)
  const [loadingTasks, setLoadingTasks] = useState(false)

  // Switch task dialog state
  const [switchOpen, setSwitchOpen] = useState(false)
  const [switchProjects, setSwitchProjects] = useState<Project[]>([])
  const [switchProjectId, setSwitchProjectId] = useState('')
  const [switchTasks, setSwitchTasks] = useState<Task[]>([])
  const [switchTaskId, setSwitchTaskId] = useState('')
  const [switching, setSwitching] = useState(false)
  const [loadingSwitchTasks, setLoadingSwitchTasks] = useState(false)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Open switch-task dialog
  const handleOpenSwitch = async () => {
    if (!activeSession) return
    setSwitchOpen(true)
    setSwitchProjectId(activeSession.projectId || '')
    setSwitchTaskId(activeSession.task?.id || '')
    setSwitchTasks([])
    setLoadingSwitchTasks(false)
    try {
      const res = await authFetch('/api/projects')
      if (res.ok) {
        const data = await res.json()
        setSwitchProjects(data.projects ?? [])
      }
    } catch {
      // silent
    }
    // If current project is set, pre-load its tasks
    if (activeSession.projectId) {
      setLoadingSwitchTasks(true)
      try {
        const res = await authFetch(`/api/projects/${activeSession.projectId}`)
        if (res.ok) {
          const data = await res.json()
          setSwitchTasks(data.project?.tasks ?? [])
        }
      } catch {
        // silent
      } finally {
        setLoadingSwitchTasks(false)
      }
    }
  }

  // Handle switch-task project change
  const handleSwitchProjectChange = async (projectId: string) => {
    setSwitchProjectId(projectId)
    setSwitchTaskId('')
    setSwitchTasks([])
    if (!projectId) return
    setLoadingSwitchTasks(true)
    try {
      const res = await authFetch(`/api/projects/${projectId}`)
      if (res.ok) {
        const data = await res.json()
        setSwitchTasks(data.project?.tasks ?? [])
      }
    } catch {
      // silent
    } finally {
      setLoadingSwitchTasks(false)
    }
  }

  // Execute task switch — update the time entry, screenshot context, and store
  const handleSwitchTask = async () => {
    if (!activeSession) return
    setSwitching(true)
    try {
      const body: Record<string, unknown> = { action: 'switch_task' }
      if (switchProjectId) body.projectId = switchProjectId
      if (switchTaskId) body.taskId = switchTaskId

      const res = await authFetch(`/api/time-entries/${activeSession.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to switch task')
      }
      const data = await res.json()
      const updated = data.timeEntry
      if (updated) {
        const session: ActiveTimeSession = {
          id: updated.id,
          timeIn: updated.timeIn,
          projectId: updated.projectId,
          project: updated.project,
          task: updated.task,
          description: updated.description,
        }
        setActiveSession(session)

        // Update screenshot session context and capture immediately
        screenshotSession.updateContext({
          projectId: switchProjectId || undefined,
          taskId: switchTaskId || undefined,
        })
      }
      setSwitchOpen(false)
      toast.success('Switched task — timer continues', {
        description: switchTaskId ? 'Screenshot captured for new task' : undefined,
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to switch task')
    } finally {
      setSwitching(false)
    }
  }

  // Fetch screenshot config on mount (for interval)
  useEffect(() => {
    authFetch(`/api/screenshot-config?userId=${userId}`)
      .then(r => r.json())
      .then(d => {
        if (d.intervalMinutes) useScreenshotStore.getState().setIntervalMinutes(d.intervalMinutes)
      })
      .catch(() => {})
  }, [userId])

  // Countdown timer for next screenshot
  useEffect(() => {
    if (activeSession && screenshotSession.getIsRunning()) {
      countdownRef.current = setInterval(() => {
        setNextCaptureInMs(screenshotSession.getTimeUntilNextCapture())
      }, 1000)
    } else {
      if (countdownRef.current) {
        clearInterval(countdownRef.current)
        countdownRef.current = null
      }
      setNextCaptureInMs(0)
    }
    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current)
        countdownRef.current = null
      }
    }
  }, [activeSession])

  // Fetch active timer on mount
  const fetchActiveTimer = useCallback(async () => {
    try {
      const res = await authFetch(`/api/time-entries?userId=${userId}&active=true`)
      if (res.ok) {
        const data = await res.json()
        const entries = data.timeEntries || []
        const entry: ActiveTimeEntry | null = entries.find((e: ActiveTimeEntry) => e.timeIn) || null

        if (entry) {
          const session: ActiveTimeSession = {
            id: entry.id,
            timeIn: entry.timeIn,
            projectId: entry.projectId,
            project: entry.project,
            task: entry.task,
            description: entry.description,
          }
          setActiveSession(session)

          // Re-start screenshot session if we find an active timer (page reload)
          const user = useAuthStore.getState().user
          if (user && user.role !== 'client') {
            authFetch(`/api/screenshot-config?userId=${userId}`)
              .then(r => r.json())
              .then(config => {
                if (config.autoEnabled) {
                  screenshotSession.start({
                    projectId: entry.projectId || undefined,
                    taskId: entry.task?.id || undefined,
                    intervalMinutes: config.intervalMinutes || 5,
                    quality: 0.6,
                    onCaptureStart: () => setIsCapturing(true),
                    onCaptureComplete: (count) => {
                      setCaptureCount(count)
                      setIsCapturing(false)
                    },
                    onCaptureError: () => setIsCapturing(false),
                  })
                }
              })
              .catch(() => {})
          }
        } else {
          setActiveSession(null)
        }
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
      setInitialized(true)
    }
  }, [userId, setActiveSession, setInitialized, setIsCapturing, setCaptureCount])

  useEffect(() => {
    if (!initialized) {
      fetchActiveTimer()
    }
    // Cleanup screenshot session on unmount
    return () => {
      screenshotSession.stop()
    }
  }, [fetchActiveTimer, initialized])

  // 1-second interval for elapsed display — derived from shared store
  useEffect(() => {
    const startTimeMs = useTimeTrackingStore.getState().startTimeMs
    if (activeSession && startTimeMs) {
      setElapsedMs(Date.now() - startTimeMs)
      intervalRef.current = setInterval(() => {
        setElapsedMs(Date.now() - useTimeTrackingStore.getState().startTimeMs)
      }, 1000)
    } else {
      setElapsedMs(0)
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
  }, [activeSession])

  // Open time-in dialog and fetch projects
  const handleOpenDialog = async () => {
    setDialogOpen(true)
    setSelectedProjectId('')
    setSelectedTaskId('')
    setDescription('')
    setTasks([])
    setLoadingProjects(true)
    try {
      const res = await authFetch('/api/projects')
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
      const res = await authFetch(`/api/projects/${projectId}`)
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

  // Clock in
  const handleClockIn = async () => {
    const user = useAuthStore.getState().user
    setClockingIn(true)
    try {
      const body: Record<string, unknown> = { action: 'time_in', userId }
      if (selectedProjectId) body.projectId = selectedProjectId
      if (selectedTaskId) body.taskId = selectedTaskId
      if (description.trim()) body.description = description.trim()

      const res = await authFetch('/api/time-entries', {
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
        const session: ActiveTimeSession = {
          id: entry.id,
          timeIn: entry.timeIn,
          projectId: entry.projectId,
          project: entry.project,
          task: entry.task,
          description: entry.description,
        }
        setActiveSession(session)
      }
      setDialogOpen(false)
      toast.success('Clocked in successfully')

      // Start periodic screenshot session in background (admin-controlled)
      if (user && user.role !== 'client') {
        const currentInterval = useScreenshotStore.getState().intervalMinutes
        authFetch(`/api/screenshot-config?userId=${userId}`)
          .then(r => r.json())
          .then(config => {
            if (config.autoEnabled) {
              setCaptureCount(0)
              const interval = config.intervalMinutes || currentInterval
              screenshotSession.start({
                projectId: selectedProjectId || undefined,
                taskId: selectedTaskId || undefined,
                intervalMinutes: interval,
                quality: 0.6,
                onCaptureStart: () => setIsCapturing(true),
                onCaptureComplete: (count) => {
                  setCaptureCount(count)
                  setIsCapturing(false)
                },
                onCaptureError: () => setIsCapturing(false),
              })
            }
          })
          .catch(() => {})
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to clock in')
    } finally {
      setClockingIn(false)
    }
  }

  // Clock out
  const handleClockOut = async () => {
    if (!activeSession) return
    setClockingOut(true)

    // Stop screenshot session immediately
    screenshotSession.stop()
    const finalCount = screenshotSession.getCaptureCount()
    resetScreenshotState()

    try {
      const res = await authFetch(`/api/time-entries/${activeSession.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'time_out' }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to clock out')
      }
      setActiveSession(null)
      setElapsedMs(0)
      toast.success('Clocked out successfully', {
        ...(finalCount > 0 && {
          description: `${finalCount} screenshot${finalCount > 1 ? 's' : ''} saved during this session`,
        }),
      })
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

  if (activeSession) {
    return (
      <>
        {/* Screenshot monitoring status (shown when active, admin-controlled) */}
        {screenshotSession.getIsRunning() && (
          <div className={cn(
            'mb-2 rounded-lg border px-3 py-1.5 flex items-center gap-2',
            isCapturing
              ? 'border-primary/40 bg-primary/5 dark:bg-primary/10 animate-pulse'
              : 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/30'
          )}>
            {isCapturing ? (
              <>
                <Camera className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="text-[11px] text-primary font-medium flex-1">Capturing screenshot…</span>
                <Loader2 className="w-3 h-3 animate-spin text-primary" />
              </>
            ) : (
              <>
                <Camera className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-[11px] text-emerald-700 dark:text-emerald-300 font-medium">
                    Monitoring • {captureCount} captured
                  </span>
                  {nextCaptureInMs > 0 && (
                    <span className="text-[10px] text-emerald-600/70 dark:text-emerald-400/70 ml-1.5">
                      Next in {formatCountdown(nextCaptureInMs)}
                    </span>
                  )}
                </div>
                <RefreshCw className="w-3 h-3 text-emerald-500 dark:text-emerald-400 animate-[spin_3s_linear_infinite]" />
              </>
            )}
          </div>
        )}
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30 px-3 py-2 flex items-center gap-2">
          <Timer className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-[10px] text-red-600 dark:text-red-400 font-medium leading-none mb-0.5">
              {activeSession.project?.name || 'No Project'}
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
        {/* Switch Task button */}
        <button
          onClick={handleOpenSwitch}
          className="mb-3 w-full rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900/50 dark:bg-blue-950/30 px-3 py-1.5 flex items-center justify-center gap-1.5 hover:bg-blue-100 dark:hover:bg-blue-950/50 transition-colors cursor-pointer"
        >
          <ArrowRightLeft className="w-3 h-3 text-blue-600 dark:text-blue-400" />
          <span className="text-[11px] font-medium text-blue-700 dark:text-blue-300">Switch Task</span>
        </button>

        {/* Switch Task Dialog */}
        <Dialog open={switchOpen} onOpenChange={(open) => { setSwitchOpen(open) }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ArrowRightLeft className="h-5 w-5 text-blue-600" />
                Switch Task
              </DialogTitle>
              <DialogDescription>Change your project or task. Your timer will continue without interruption.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label className="text-sm">Project</Label>
                <Select value={switchProjectId} onValueChange={handleSwitchProjectChange}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent>
                    {switchProjects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {switchProjectId && (
                <div className="space-y-2">
                  <Label className="text-sm">Task</Label>
                  <Select value={switchTaskId} onValueChange={setSwitchTaskId} disabled={loadingSwitchTasks}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder={loadingSwitchTasks ? 'Loading…' : 'Select task'} />
                    </SelectTrigger>
                    <SelectContent>
                      {switchTasks.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSwitchOpen(false)} className="h-9">Cancel</Button>
              <Button onClick={handleSwitchTask} disabled={switching} className="h-9 bg-blue-600 hover:bg-blue-700 text-white">
                {switching && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                <ArrowRightLeft className="w-3.5 h-3.5 mr-1.5" />
                Switch
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    )
  }

  return (
    <>
      <button
        data-time-in-btn
        onClick={handleOpenDialog}
        className="mb-3 w-full rounded-lg border border-green-200 bg-green-50 dark:border-green-900/50 dark:bg-green-950/30 px-3 py-2 flex items-center justify-center gap-2 hover:bg-green-100 dark:hover:bg-green-950/50 transition-colors cursor-pointer"
      >
        <Play className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
        <Clock className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
        <span className="text-xs font-medium text-green-700 dark:text-green-300">Time In</span>
      </button>

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open) }}>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="h-9">Cancel</Button>
            <Button onClick={handleClockIn} disabled={clockingIn} className="h-9 bg-green-600 hover:bg-green-700 text-white">
              {clockingIn && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              <Play className="w-3.5 h-3.5 mr-1.5" />
              Clock In
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
      authFetch(`/api/messages?userId=${user.id}`)
        .then(r => r.json())
        .then(d => setUnreadCount(d.conversations?.reduce((sum: number, c: { unread: number }) => sum + c.unread, 0) || 0))
        .catch(() => {})
    }
  }, [user])

  // Stop screenshot session on logout
  const handleLogout = () => {
    screenshotSession.stop()
    logout()
  }

  if (!user) return null
  const roleInfo = getRoleBadgeClasses(user.role)

  return (
    <header className="h-14 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex items-center justify-between px-4 lg:px-6 z-10">
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
                {user.avatar && <AvatarImage src={user.avatar} alt={user.name} />}
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
            <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
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
    { id: 'calendar', label: 'Calendar Notes', icon: CalendarDays, route: { page: 'admin-dashboard', tab: 'calendar' } },
    { id: 'profile', label: 'Profile', icon: UserCircle, route: { page: 'admin-dashboard', tab: 'profile' } },
  ]
  if (role === 'team') return [
    { id: 'projects', label: 'Projects', icon: FolderKanban, route: { page: 'team-dashboard', tab: 'project' } },
    { id: 'task', label: 'Task', icon: Kanban, route: { page: 'team-dashboard', tab: 'task' } },
    { id: 'time-tracking', label: 'Time Tracking', icon: Clock, route: { page: 'team-dashboard', tab: 'time-tracking' } },
    { id: 'messages', label: 'Messages', icon: MessageSquare, route: { page: 'team-dashboard', tab: 'messages' } },
    { id: 'screenshots', label: 'Screenshots', icon: Camera, route: { page: 'team-dashboard', tab: 'screenshots' } },
    { id: 'calendar', label: 'Calendar Notes', icon: CalendarDays, route: { page: 'team-dashboard', tab: 'calendar' } },
    { id: 'profile', label: 'Profile', icon: UserCircle, route: { page: 'team-dashboard', tab: 'profile' } },
  ]
  if (role === 'training') return [
    { id: 'projects', label: 'Projects', icon: FolderKanban, route: { page: 'team-dashboard', tab: 'project' } },
    { id: 'task', label: 'Task', icon: Kanban, route: { page: 'team-dashboard', tab: 'task' } },
    { id: 'time-tracking', label: 'Time Tracking', icon: Clock, route: { page: 'team-dashboard', tab: 'time-tracking' } },
    { id: 'messages', label: 'Messages', icon: MessageSquare, route: { page: 'team-dashboard', tab: 'messages' } },
    { id: 'calendar', label: 'Calendar Notes', icon: CalendarDays, route: { page: 'team-dashboard', tab: 'calendar' } },
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
  const showTimeWidget = user.role === 'admin' || user.role === 'team' || user.role === 'training'

  const isCurrentTab = (item: NavItem) => 'tab' in route && route.page === item.route.page && route.tab === item.route.tab

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
      <div className="flex flex-1 overflow-hidden">
        <AppSidebar />
        <div className="flex flex-1 flex-col min-w-0">
          <AppHeader />
          <main className="flex-1 overflow-y-auto">
            <div className="p-4 lg:p-6 max-w-[1400px] mx-auto">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}