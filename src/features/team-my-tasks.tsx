'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuthStore } from '@/stores/auth'
import type { Task, User, Subtask, Comment } from '@/types'
import { getInitials, getPriorityConfig, getStatusConfig, formatDate, formatRelativeTime } from '@/features/route-guard'
import { cn } from '@/lib/utils'

// shadcn/ui
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'

// date-fns
import { format, parseISO, isPast, isToday } from 'date-fns'

// framer-motion
import { motion, AnimatePresence } from 'framer-motion'

// lucide-react
import {
  CheckCircle2, MessageSquare, ListTodo, CircleDot,
  Clock, Eye, Circle, CalendarIcon, FolderKanban,
  ListChecks, Inbox,
} from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────

interface TaskWithProject extends Task {
  projectName?: string
  projectColor?: string
}

type FilterTab = 'all' | 'todo' | 'in_progress' | 'in_review' | 'done'

// ─── Constants ──────────────────────────────────────────────

const FILTER_TABS: { key: FilterTab; label: string; icon: React.ElementType }[] = [
  { key: 'all', label: 'All', icon: Inbox },
  { key: 'todo', label: 'To Do', icon: Circle },
  { key: 'in_progress', label: 'In Progress', icon: Clock },
  { key: 'in_review', label: 'In Review', icon: Eye },
  { key: 'done', label: 'Done', icon: CheckCircle2 },
]

// ─── Sub-components ─────────────────────────────────────────

function TaskCardSkeleton() {
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <Skeleton className="h-6 w-6 rounded-full shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0 space-y-2.5">
          <Skeleton className="h-4 w-3/4" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-14 rounded-full" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-20 rounded-full" />
          </div>
        </div>
        <Skeleton className="h-7 w-7 rounded-full shrink-0" />
      </div>
    </Card>
  )
}

function EmptyTasksState({ filter }: { filter: FilterTab }) {
  const filterLabel = FILTER_TABS.find((t) => t.key === filter)?.label || 'this category'
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16 text-center"
    >
      <div className="h-14 w-14 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
        <ListTodo className="h-7 w-7 text-slate-400" />
      </div>
      <h3 className="text-base font-semibold text-foreground mb-1">
        {filter === 'all' ? 'No tasks found' : `No ${filterLabel.toLowerCase()} tasks`}
      </h3>
      <p className="text-sm text-muted-foreground max-w-sm">
        {filter === 'all'
          ? "You don't have any tasks assigned to you yet. Tasks assigned across all your projects will appear here."
          : `You don't have any ${filterLabel.toLowerCase()} tasks right now.`}
      </p>
    </motion.div>
  )
}

// ─── Main Component ─────────────────────────────────────────

export function TeamMyTasks() {
  const { user } = useAuthStore()
  const [tasks, setTasks] = useState<TaskWithProject[]>([])
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all')

  // Fetch all tasks assigned to the current user across all their projects
  const fetchMyTasks = useCallback(async () => {
    if (!user?.id) {
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      // Step 1: Get all projects the user is a member of
      const projectsRes = await fetch('/api/projects')
      const projectsData = await projectsRes.json()
      const userProjects = (projectsData.projects || []).filter((p: { members?: { userId: string }[] }) =>
        p.members?.some((m) => m.userId === user.id)
      )

      // Step 2: Fetch tasks from each project in parallel
      const taskPromises = userProjects.map(async (project: { id: string; name: string; color: string }) => {
        try {
          const res = await fetch(`/api/tasks?projectId=${project.id}`)
          const data = await res.json()
          const projectTasks: TaskWithProject[] = (data.tasks || [])
            .filter((t: Task) => t.assignees?.some((a) => a.userId === user.id))
            .map((t: Task) => ({
              ...t,
              projectName: project.name,
              projectColor: project.color,
            }))
          return projectTasks
        } catch {
          return [] as TaskWithProject[]
        }
      })

      const results = await Promise.all(taskPromises)
      const allTasks = results.flat()

      // Sort by priority weight (urgent first) then by due date
      const priorityWeight: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 }
      allTasks.sort((a, b) => {
        const pw = (priorityWeight[a.priority] ?? 2) - (priorityWeight[b.priority] ?? 2)
        if (pw !== 0) return pw
        // Non-done tasks before done
        const doneA = a.status === 'done' ? 1 : 0
        const doneB = b.status === 'done' ? 1 : 0
        if (doneA !== doneB) return doneA - doneB
        // Then by due date (nulls last)
        if (a.dueDate && b.dueDate) return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
        if (a.dueDate) return -1
        if (b.dueDate) return 1
        return 0
      })

      setTasks(allTasks)
    } catch {
      setTasks([])
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    fetchMyTasks()
  }, [fetchMyTasks])

  // Filter tasks by active tab
  const filteredTasks = useMemo(() => {
    if (activeFilter === 'all') return tasks
    return tasks.filter((t) => t.status === activeFilter)
  }, [tasks, activeFilter])

  // Count tasks per status
  const statusCounts = useMemo(() => {
    const counts: Record<FilterTab, number> = { all: tasks.length, todo: 0, in_progress: 0, in_review: 0, done: 0 }
    tasks.forEach((t) => {
      if (t.status in counts) counts[t.status as FilterTab]++
    })
    return counts
  }, [tasks])

  // Check if a task is overdue
  const isOverdue = (dueDate: string | null | undefined, status: string) => {
    if (!dueDate || status === 'done') return false
    const d = parseISO(dueDate)
    return isPast(d) && !isToday(d)
  }

  // Handle task click — navigate to Tasks Dashboard for the project
  const handleTaskClick = (task: TaskWithProject) => {
    useAuthStore.getState().setSelectedTaskId(task.id)
    useAuthStore.getState().setSelectedProjectId(task.projectId)
    useAuthStore.getState().setRoute({ page: 'team-dashboard', tab: 'task-dashboard' })
  }

  // ─── Render ─────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Header skeleton */}
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-5 w-5 rounded-full" />
        </div>
        <Skeleton className="h-4 w-72" />
        {/* Filter tabs skeleton */}
        <div className="flex gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-24 rounded-lg" />
          ))}
        </div>
        {/* Task list skeleton */}
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <TaskCardSkeleton key={i} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight">My Tasks</h1>
        <Badge variant="secondary" className="text-xs font-medium tabular-nums">
          {tasks.length}
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground -mt-3">
        Tasks assigned to you across all projects
      </p>

      {/* Filter tabs */}
      <div className="flex gap-1 flex-wrap">
        {FILTER_TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = activeFilter === tab.key
          const count = statusCounts[tab.key]
          return (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key)}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{tab.label}</span>
              {count > 0 && (
                <span
                  className={cn(
                    'text-xs tabular-nums',
                    isActive ? 'text-primary-foreground/80' : 'text-muted-foreground/70',
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Task list */}
      <ScrollArea className="max-h-[calc(100vh-320px)]">
        <div className="space-y-2 pr-2">
          {filteredTasks.length === 0 ? (
            <EmptyTasksState filter={activeFilter} />
          ) : (
            <AnimatePresence mode="popLayout">
              {filteredTasks.map((task) => {
                const statusConf = getStatusConfig(task.status)
                const priorityConf = getPriorityConfig(task.priority)
                const overdue = isOverdue(task.dueDate, task.status)
                const subtaskTotal = task._count?.subtasks ?? 0
                const subtaskDone = task._count?.completedSubtasks ?? 0
                const hasSubtasks = subtaskTotal > 0
                const commentCount = task._count?.comments ?? 0
                const hasDueDate = !!task.dueDate

                return (
                  <motion.div
                    key={task.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.15 }}
                  >
                    <Card
                      className="p-4 hover:shadow-md transition-all cursor-pointer border-border/60 hover:border-border group"
                      onClick={() => handleTaskClick(task)}
                    >
                      <div className="flex items-start gap-3">
                        {/* Status dot */}
                        <div className="shrink-0 mt-1">
                          <span className={cn('block h-2.5 w-2.5 rounded-full', statusConf.dotColor)} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          {/* Title row */}
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <h3
                              className={cn(
                                'text-sm font-medium leading-snug line-clamp-2 group-hover:text-primary transition-colors',
                                task.status === 'done' && 'line-through text-muted-foreground',
                              )}
                            >
                              {task.title}
                            </h3>

                            {/* Self avatar */}
                            <Avatar className="h-7 w-7 shrink-0 border border-border/50">
                              <AvatarFallback className="text-[10px] bg-slate-200 dark:bg-slate-700">
                                {user ? getInitials(user.name) : '?'}
                              </AvatarFallback>
                            </Avatar>
                          </div>

                          {/* Meta row: priority + due date */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge
                              variant="secondary"
                              className={cn('text-[11px] px-1.5 py-0 h-5 font-medium', priorityConf.color)}
                            >
                              {priorityConf.label}
                            </Badge>

                            {hasDueDate && (
                              <span
                                className={cn(
                                  'inline-flex items-center gap-1 text-xs',
                                  overdue
                                    ? 'text-red-500 font-medium'
                                    : 'text-muted-foreground',
                                )}
                              >
                                <CalendarIcon className="h-3 w-3" />
                                {format(parseISO(task.dueDate!), 'MMM d')}
                                {overdue && ' (overdue)'}
                              </span>
                            )}

                            {task.projectName && (
                              <Badge
                                variant="outline"
                                className="text-[11px] px-1.5 py-0 h-5 gap-1 font-normal"
                              >
                                <span
                                  className="h-2 w-2 rounded-full shrink-0"
                                  style={{ backgroundColor: task.projectColor || '#64748b' }}
                                />
                                <span className="truncate max-w-[120px]">{task.projectName}</span>
                              </Badge>
                            )}
                          </div>

                          {/* Indicators row: subtasks + comments */}
                          {(hasSubtasks || commentCount > 0) && (
                            <div className="flex items-center gap-3 mt-2">
                              {hasSubtasks && (
                                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                  <ListChecks className="h-3 w-3" />
                                  {subtaskDone}/{subtaskTotal} subtask{subtaskTotal !== 1 ? 's' : ''}
                                  {subtaskDone > 0 && (
                                    <span className="text-emerald-500 font-medium ml-0.5">
                                      ({Math.round((subtaskDone / subtaskTotal) * 100)}%)
                                    </span>
                                  )}
                                </span>
                              )}
                              {commentCount > 0 && (
                                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                  <MessageSquare className="h-3 w-3" />
                                  {commentCount}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}