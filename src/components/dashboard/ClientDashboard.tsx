'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { TaskCard } from './TaskCard'
import { TaskDetail } from './TaskDetail'
import { useAuthStore } from '@/stores/auth'
import type { Project, Task, DashboardStats } from '@/types'
import { toast } from 'sonner'
import { format, isPast, isToday } from 'date-fns'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FolderOpen,
  CheckCircle2,
  Clock,
  BarChart3,
  ArrowLeft,
  X,
  Calendar,
  ChevronRight,
  ListChecks,
} from 'lucide-react'

// ─── Config Maps ────────────────────────────────────────────────────────────

const priorityConfig: Record<string, { label: string; color: string }> = {
  urgent: { label: 'Urgent', color: 'bg-red-500 text-white' },
  high: { label: 'High', color: 'bg-orange-500 text-white' },
  medium: { label: 'Medium', color: 'bg-amber-500 text-white' },
  low: { label: 'Low', color: 'bg-slate-400 text-white' },
}

const statusConfig: Record<string, { label: string; color: string }> = {
  todo: { label: 'To Do', color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  in_progress: { label: 'In Progress', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  in_review: { label: 'In Review', color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' },
  done: { label: 'Done', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

// ─── Stat Card Skeleton ─────────────────────────────────────────────────────

function StatCardSkeleton() {
  return (
    <Card className="py-4">
      <CardContent className="flex items-center gap-4">
        <Skeleton className="h-11 w-11 rounded-xl" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-7 w-12" />
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Project Card Skeleton ──────────────────────────────────────────────────

function ProjectCardSkeleton() {
  return (
    <Card className="py-4">
      <CardContent className="space-y-3">
        <div className="flex items-start gap-3">
          <Skeleton className="h-9 w-1.5 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-3.5 w-full max-w-[240px]" />
          </div>
        </div>
        <div className="flex items-center gap-3 pl-5">
          <Skeleton className="h-2 w-full rounded-full" />
        </div>
        <div className="flex items-center justify-between pl-5">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-3.5 w-20" />
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function ClientDashboard() {
  const { user } = useAuthStore()

  // State
  const [projects, setProjects] = useState<Project[]>([])
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [projectTasks, setProjectTasks] = useState<Record<string, Task[]>>({})
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [taskDetailOpen, setTaskDetailOpen] = useState(false)
  const [loadingProjects, setLoadingProjects] = useState(true)
  const [loadingStats, setLoadingStats] = useState(true)
  const [loadingTasks, setLoadingTasks] = useState<Record<string, boolean>>({})

  // ── Fetch stats ─────────────────────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    if (!user?.id) return
    try {
      setLoadingStats(true)
      const res = await fetch(`/api/dashboard/stats?userId=${user.id}`)
      if (!res.ok) throw new Error('Failed to fetch stats')
      const data = await res.json()
      setStats(data.stats)
    } catch {
      toast.error('Failed to load dashboard stats')
    } finally {
      setLoadingStats(false)
    }
  }, [user?.id])

  // ── Fetch projects ──────────────────────────────────────────────────────
  const fetchProjects = useCallback(async () => {
    try {
      setLoadingProjects(true)
      const res = await fetch('/api/projects')
      if (!res.ok) throw new Error('Failed to fetch projects')
      const data = await res.json()
      setProjects(data.projects || [])
    } catch {
      toast.error('Failed to load projects')
    } finally {
      setLoadingProjects(false)
    }
  }, [])

  // ── Fetch tasks for a project ──────────────────────────────────────────
  const fetchProjectTasks = useCallback(async (projectId: string) => {
    if (projectTasks[projectId]) return // already cached
    try {
      setLoadingTasks((prev) => ({ ...prev, [projectId]: true }))
      const res = await fetch(`/api/tasks?projectId=${projectId}`)
      if (!res.ok) throw new Error('Failed to fetch tasks')
      const data = await res.json()
      setProjectTasks((prev) => ({ ...prev, [projectId]: data.tasks || [] }))
    } catch {
      toast.error('Failed to load tasks for this project')
    } finally {
      setLoadingTasks((prev) => ({ ...prev, [projectId]: false }))
    }
  }, [projectTasks])

  // ── Refresh tasks (after detail modal update) ──────────────────────────
  const refreshTasks = useCallback(async (projectId: string) => {
    try {
      const res = await fetch(`/api/tasks?projectId=${projectId}`)
      if (!res.ok) return
      const data = await res.json()
      setProjectTasks((prev) => ({ ...prev, [projectId]: data.tasks || [] }))
    } catch {
      // silent
    }
    fetchStats()
  }, [fetchStats])

  // ── Effects ─────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchStats()
    fetchProjects()
  }, [fetchStats, fetchProjects])

  // When a project is expanded, fetch its tasks
  useEffect(() => {
    if (expandedProjectId) {
      fetchProjectTasks(expandedProjectId)
    }
  }, [expandedProjectId, fetchProjectTasks])

  // ── Handlers ────────────────────────────────────────────────────────────
  const handleProjectClick = (projectId: string) => {
    if (expandedProjectId === projectId) {
      setExpandedProjectId(null)
    } else {
      setExpandedProjectId(projectId)
      // Scroll to tasks section smoothly
      setTimeout(() => {
        document.getElementById(`project-tasks-${projectId}`)?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        })
      }, 100)
    }
  }

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task)
    setTaskDetailOpen(true)
  }

  const handleTaskDetailClose = () => {
    setTaskDetailOpen(false)
    setSelectedTask(null)
  }

  const handleTaskUpdate = () => {
    if (expandedProjectId) {
      refreshTasks(expandedProjectId)
    }
  }

  // ── Computed ────────────────────────────────────────────────────────────
  const expandedProject = projects.find((p) => p.id === expandedProjectId)
  const tasks = expandedProjectId ? projectTasks[expandedProjectId] || [] : []
  const totalTasks = tasks.length
  const completedTasks = tasks.filter((t) => t.status === 'done').length
  const taskCompletionPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

  const getProjectProgress = (project: Project): { completed: number; total: number; pct: number } => {
    const pTasks = projectTasks[project.id] || []
    const done = pTasks.filter((t) => t.status === 'done').length
    const total = pTasks.length
    return { completed: done, total, pct: total > 0 ? Math.round((done / total) * 100) : 0 }
  }

  // ── Due date formatting ─────────────────────────────────────────────────
  const formatDueDate = (dueDate: string | null) => {
    if (!dueDate) return null
    const date = new Date(dueDate)
    if (isToday(date)) return { text: 'Due today', className: 'text-amber-600 dark:text-amber-400' }
    if (isPast(date)) {
      const days = Math.ceil((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24))
      return { text: `${days}d overdue`, className: 'text-red-500' }
    }
    return { text: format(date, 'MMM d, yyyy'), className: 'text-muted-foreground' }
  }

  // ── Stat cards data ─────────────────────────────────────────────────────
  const statCards = [
    {
      label: 'My Projects',
      value: stats?.activeProjects ?? 0,
      icon: FolderOpen,
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-100 dark:bg-amber-900/30',
    },
    {
      label: 'Total Tasks',
      value: stats?.totalTasks ?? 0,
      icon: BarChart3,
      color: 'text-rose-600 dark:text-rose-400',
      bg: 'bg-rose-100 dark:bg-rose-900/30',
    },
    {
      label: 'Completed',
      value: stats?.completedTasks ?? 0,
      icon: CheckCircle2,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-100 dark:bg-emerald-900/30',
    },
    {
      label: 'In Progress',
      value: (stats?.inProgressTasks ?? 0) + (stats?.inReviewTasks ?? 0),
      icon: Clock,
      color: 'text-orange-600 dark:text-orange-400',
      bg: 'bg-orange-100 dark:bg-orange-900/30',
    },
  ]

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 lg:p-8 min-h-screen">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
          Welcome back{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm md:text-base">
          Here&apos;s an overview of your projects and tasks.
        </p>
      </div>

      {/* ─── Overview Stats ─────────────────────────────────────────────── */}
      <section aria-label="Dashboard overview statistics">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {loadingStats
            ? Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
            : statCards.map((stat) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                >
                  <Card className="py-4 hover:shadow-md transition-shadow">
                    <CardContent className="flex items-center gap-4">
                      <div
                        className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${stat.bg}`}
                      >
                        <stat.icon className={`h-5 w-5 ${stat.color}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground truncate">{stat.label}</p>
                        <p className="text-2xl font-bold tracking-tight leading-tight">
                          {stat.value}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
        </div>
      </section>

      <Separator />

      {/* ─── Projects Section ───────────────────────────────────────────── */}
      <section aria-label="My projects" className="flex-1">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            <h2 className="text-lg font-semibold">My Projects</h2>
            <Badge variant="secondary" className="text-xs ml-1">
              {loadingProjects ? '...' : projects.length}
            </Badge>
          </div>
        </div>

        {/* Project Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {loadingProjects
            ? Array.from({ length: 6 }).map((_, i) => <ProjectCardSkeleton key={i} />)
            : projects.map((project, idx) => {
                const progress = getProjectProgress(project)
                const priority = priorityConfig[project.priority] || priorityConfig.medium
                const dueInfo = formatDueDate(project.dueDate)
                const isExpanded = expandedProjectId === project.id

                return (
                  <motion.div
                    key={project.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: idx * 0.05, ease: 'easeOut' }}
                  >
                    <Card
                      className={`py-4 cursor-pointer hover:shadow-md transition-all duration-200 group border-l-4 ${
                        isExpanded
                          ? 'ring-2 ring-primary/20 shadow-lg'
                          : 'hover:ring-1 hover:ring-primary/10'
                      }`}
                      style={{ borderLeftColor: project.color || '#f59e0b' }}
                      onClick={() => handleProjectClick(project.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          handleProjectClick(project.id)
                        }
                      }}
                      aria-expanded={isExpanded}
                    >
                      <CardContent className="space-y-3">
                        {/* Project name + description */}
                        <div className="flex items-start gap-3">
                          <div
                            className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                            style={{ backgroundColor: `${project.color || '#f59e0b'}18` }}
                          >
                            <FolderOpen
                              className="h-4 w-4"
                              style={{ color: project.color || '#f59e0b' }}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-sm leading-tight truncate group-hover:text-primary transition-colors">
                              {project.name}
                            </h3>
                            {project.description && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                                {project.description}
                              </p>
                            )}
                          </div>
                          <ChevronRight
                            className={`h-4 w-4 text-muted-foreground shrink-0 mt-1 transition-transform duration-200 ${
                              isExpanded ? 'rotate-90' : ''
                            }`}
                          />
                        </div>

                        {/* Progress bar */}
                        <div className="space-y-1.5 pl-12">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>Progress</span>
                            <span className="font-medium">
                              {project._count?.tasks
                                ? `${progress.completed}/${project._count.tasks}`
                                : 'No tasks'}
                            </span>
                          </div>
                          <Progress
                            value={progress.pct}
                            className="h-1.5"
                          />
                        </div>

                        {/* Priority badge + Due date */}
                        <div className="flex items-center justify-between pl-12">
                          <Badge className={`text-[10px] px-2 py-0 border-0 ${priority.color}`}>
                            {priority.label} priority
                          </Badge>
                          {dueInfo && (
                            <div className={`flex items-center gap-1 text-xs ${dueInfo.className}`}>
                              <Calendar className="h-3 w-3" />
                              <span>{dueInfo.text}</span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )
              })}
        </div>

        {/* ─── Expanded Project Tasks ──────────────────────────────────── */}
        <AnimatePresence>
          {expandedProject && (
            <motion.div
              id={`project-tasks-${expandedProject.id}`}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <Card className="mt-6 overflow-hidden">
                <CardHeader className="pb-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={(e) => {
                          e.stopPropagation()
                          setExpandedProjectId(null)
                        }}
                        aria-label="Close task list"
                      >
                        <ArrowLeft className="h-4 w-4" />
                      </Button>
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          <ListChecks className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                          {expandedProject.name}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {totalTasks} task{totalTasks !== 1 ? 's' : ''} &middot;{' '}
                          {taskCompletionPct}% complete
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
                        <div className="w-24">
                          <div className="flex items-center justify-between mb-1">
                            <span>Completion</span>
                            <span className="font-medium">{taskCompletionPct}%</span>
                          </div>
                          <Progress value={taskCompletionPct} className="h-1.5" />
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation()
                          setExpandedProjectId(null)
                        }}
                        aria-label="Close task list"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <Separator />

                <CardContent className="p-0">
                  {loadingTasks[expandedProject.id] ? (
                    <div className="p-6 space-y-3">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-4">
                          <Skeleton className="h-4 w-48" />
                          <Skeleton className="h-5 w-20 rounded-full" />
                          <Skeleton className="h-5 w-16 rounded-full" />
                          <Skeleton className="h-4 w-24 ml-auto" />
                        </div>
                      ))}
                    </div>
                  ) : tasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <FolderOpen className="h-10 w-10 text-muted-foreground/40 mb-3" />
                      <p className="text-sm text-muted-foreground">No tasks in this project yet.</p>
                      <p className="text-xs text-muted-foreground/70 mt-1">
                        Tasks will appear here once they are created.
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Desktop Table View */}
                      <div className="hidden md:block">
                        <ScrollArea className="max-h-96">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="pl-6 w-[40%]">Title</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Priority</TableHead>
                                <TableHead>Due Date</TableHead>
                                <TableHead className="pr-6 text-right">Assignees</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {tasks.map((task) => {
                                const status = statusConfig[task.status] || statusConfig.todo
                                const priority = priorityConfig[task.priority] || priorityConfig.medium
                                const dueInfo = formatDueDate(task.dueDate)

                                return (
                                  <TableRow
                                    key={task.id}
                                    className="cursor-pointer"
                                    onClick={() => handleTaskClick(task)}
                                  >
                                    <TableCell className="pl-6 font-medium text-sm">
                                      <span className={task.status === 'done' ? 'line-through text-muted-foreground' : ''}>
                                        {task.title}
                                      </span>
                                    </TableCell>
                                    <TableCell>
                                      <Badge variant="outline" className={`text-[11px] border-0 ${status.color}`}>
                                        {status.label}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>
                                      <Badge className={`text-[10px] px-2 py-0 border-0 ${priority.color}`}>
                                        {priority.label}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>
                                      {dueInfo ? (
                                        <div className={`flex items-center gap-1.5 text-xs ${dueInfo.className}`}>
                                          <Calendar className="h-3 w-3" />
                                          {dueInfo.text}
                                        </div>
                                      ) : (
                                        <span className="text-xs text-muted-foreground">—</span>
                                      )}
                                    </TableCell>
                                    <TableCell className="pr-6 text-right">
                                      {task.assignees && task.assignees.length > 0 ? (
                                        <div className="flex items-center justify-end -space-x-1.5">
                                          {task.assignees.slice(0, 3).map((a) => (
                                            <Avatar
                                              key={a.userId}
                                              className="h-7 w-7 border-2 border-background"
                                            >
                                              <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                                                {a.user ? getInitials(a.user.name) : '?'}
                                              </AvatarFallback>
                                            </Avatar>
                                          ))}
                                          {task.assignees.length > 3 && (
                                            <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium border-2 border-background">
                                              +{task.assignees.length - 3}
                                            </div>
                                          )}
                                        </div>
                                      ) : (
                                        <span className="text-xs text-muted-foreground">Unassigned</span>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                )
                              })}
                            </TableBody>
                          </Table>
                        </ScrollArea>
                      </div>

                      {/* Mobile Card View */}
                      <div className="md:hidden p-4 space-y-3">
                        {tasks.map((task) => (
                          <div key={task.id} onClick={() => handleTaskClick(task)}>
                            <TaskCard task={task} onClick={handleTaskClick} compact />
                          </div>
                        ))}
                      </div>

                      {/* Footer summary */}
                      <div className="flex items-center justify-between px-6 py-3 border-t bg-muted/30">
                        <p className="text-xs text-muted-foreground">
                          {completedTasks} of {totalTasks} tasks completed
                        </p>
                        <div className="flex items-center gap-2">
                          <div className="w-20">
                            <Progress value={taskCompletionPct} className="h-1.5" />
                          </div>
                          <span className="text-xs font-medium text-muted-foreground">
                            {taskCompletionPct}%
                          </span>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* ─── Task Detail Modal ─────────────────────────────────────────── */}
      <TaskDetail
        task={selectedTask}
        open={taskDetailOpen}
        onClose={handleTaskDetailClose}
        onUpdate={handleTaskUpdate}
      />
    </div>
  )
}