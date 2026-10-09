'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from 'sonner'
import { format, isPast, isToday } from 'date-fns'
import {
  Plus,
  LayoutGrid,
  List,
  Clock,
  FolderOpen,
  Calendar,
  Users,
  CheckCircle2,
  Circle,
  Eye,
  Loader2,
} from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { TaskCard, priorityConfig, getInitials } from './TaskCard'
import { TaskDetail } from './TaskDetail'
import { CreateTaskModal } from './CreateTaskModal'
import type { Task, Project, TeamView, User } from '@/types'

// ─── Column Configuration ────────────────────────────────────────────────────

type TaskStatus = Task['status']

interface ColumnConfig {
  key: TaskStatus
  label: string
  color: string
  dotColor: string
  borderColor: string
  icon: typeof Circle
}

const columns: ColumnConfig[] = [
  {
    key: 'todo',
    label: 'To Do',
    color: 'bg-slate-500',
    dotColor: 'bg-slate-400',
    borderColor: 'border-l-slate-400',
    icon: Circle,
  },
  {
    key: 'in_progress',
    label: 'In Progress',
    color: 'bg-amber-500',
    dotColor: 'bg-amber-500',
    borderColor: 'border-l-amber-500',
    icon: Clock,
  },
  {
    key: 'in_review',
    label: 'In Review',
    color: 'bg-purple-500',
    dotColor: 'bg-purple-500',
    borderColor: 'border-l-purple-500',
    icon: Eye,
  },
  {
    key: 'done',
    label: 'Done',
    color: 'bg-emerald-500',
    dotColor: 'bg-emerald-500',
    borderColor: 'border-l-emerald-500',
    icon: CheckCircle2,
  },
]

const statusBadgeConfig: Record<TaskStatus, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; className: string }> = {
  todo: { label: 'To Do', variant: 'outline', className: 'text-slate-500 border-slate-300' },
  in_progress: { label: 'In Progress', variant: 'outline', className: 'text-amber-600 border-amber-300 bg-amber-50' },
  in_review: { label: 'In Review', variant: 'outline', className: 'text-purple-600 border-purple-300 bg-purple-50' },
  done: { label: 'Done', variant: 'outline', className: 'text-emerald-600 border-emerald-300 bg-emerald-50' },
}

// ─── Animation Variants ──────────────────────────────────────────────────────

const viewTransition = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
  transition: { duration: 0.2, ease: 'easeOut' },
}

const cardStagger = {
  animate: { transition: { staggerChildren: 0.04 } },
}

const cardItem = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
}

// ─── Loading Skeletons ───────────────────────────────────────────────────────

function BoardSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, ci) => (
        <div key={ci} className="space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-3 w-3 rounded-full" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-6 rounded-full" />
          </div>
          <Separator />
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="p-4">
              <div className="space-y-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-20" />
                <div className="flex justify-between">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-3 rounded-full" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      ))}
    </div>
  )
}

function ListSkeleton() {
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40%]">Title</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Assignees</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Project</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 6 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function TimelineSkeleton() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-md" />
                <Skeleton className="h-5 w-36" />
              </div>
              <Skeleton className="h-4 w-20" />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Progress value={0} className="h-2" />
            <div className="space-y-2">
              {Array.from({ length: 2 }).map((_, j) => (
                <div key={j} className="flex items-center justify-between">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ─── Board Column ────────────────────────────────────────────────────────────

interface BoardColumnProps {
  config: ColumnConfig
  tasks: Task[]
  onTaskClick: (task: Task) => void
  onCreateTask: () => void
  showCreateButton: boolean
}

function BoardColumn({ config, tasks, onTaskClick, onCreateTask, showCreateButton }: BoardColumnProps) {
  const Icon = config.icon

  return (
    <motion.div
      className="flex flex-col rounded-lg bg-muted/30 border"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: columns.indexOf(config) * 0.08 }}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2.5">
          <div className={`w-2.5 h-2.5 rounded-full ${config.dotColor}`} />
          <span className="text-sm font-semibold">{config.label}</span>
          <Badge variant="secondary" className="h-5 min-w-[20px] flex items-center justify-center text-[11px] px-1.5">
            {tasks.length}
          </Badge>
        </div>
        <Icon className="w-4 h-4 text-muted-foreground" />
      </div>

      {/* Create Task Button */}
      {showCreateButton && (
        <div className="px-3 pt-3">
          <Button
            variant="ghost"
            size="sm"
            className="w-full h-8 text-xs text-muted-foreground border border-dashed hover:bg-accent hover:text-accent-foreground"
            onClick={onCreateTask}
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Create Task
          </Button>
        </div>
      )}

      {/* Task List */}
      <ScrollArea className="flex-1 max-h-[calc(100vh-320px)]">
        <motion.div
          className="p-3 space-y-2.5"
          variants={cardStagger}
          initial="initial"
          animate="animate"
        >
          <AnimatePresence mode="popLayout">
            {tasks.map((task) => (
              <motion.div key={task.id} variants={cardItem} layout>
                <TaskCard task={task} onClick={onTaskClick} />
              </motion.div>
            ))}
          </AnimatePresence>

          {tasks.length === 0 && (
            <div className="py-8 text-center">
              <p className="text-xs text-muted-foreground">No tasks</p>
            </div>
          )}
        </motion.div>
      </ScrollArea>
    </motion.div>
  )
}

// ─── List View Row ───────────────────────────────────────────────────────────

interface ListViewProps {
  tasks: Task[]
  projects: Project[]
  onTaskClick: (task: Task) => void
  onCreateTask: () => void
}

function ListView({ tasks, projects, onTaskClick, onCreateTask }: ListViewProps) {
  const projectMap = useMemo(() => {
    const map = new Map<string, Project>()
    for (const p of projects) map.set(p.id, p)
    return map
  }, [projects])

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="flex items-center gap-2">
          <List className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">All Tasks</h3>
          <Badge variant="secondary" className="text-[11px]">{tasks.length}</Badge>
        </div>
        <Button size="sm" className="h-8 text-xs" onClick={onCreateTask}>
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Create Task
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="max-h-[calc(100vh-260px)]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[35%] min-w-[200px]">Title</TableHead>
                <TableHead className="w-[12%]">Status</TableHead>
                <TableHead className="w-[10%]">Priority</TableHead>
                <TableHead className="w-[18%]">Assignees</TableHead>
                <TableHead className="w-[13%]">Due Date</TableHead>
                <TableHead className="w-[12%]">Project</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <AnimatePresence mode="popLayout">
                {tasks.map((task) => {
                  const statusCfg = statusBadgeConfig[task.status]
                  const priorityCfg = priorityConfig[task.priority]
                  const project = projectMap.get(task.projectId)
                  const isOverdue = task.dueDate && isPast(new Date(task.dueDate)) && !isToday(new Date(task.dueDate))

                  return (
                    <motion.tr
                      key={task.id}
                      variants={cardItem}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      className="cursor-pointer border-b hover:bg-muted/50 transition-colors"
                      onClick={() => onTaskClick(task)}
                    >
                      <TableCell className="py-3">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium ${task.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>
                            {task.title}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        <Badge variant={statusCfg.variant} className={`text-[10px] px-2 py-0.5 ${statusCfg.className}`}>
                          {statusCfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-3">
                        <Badge className={`text-[10px] px-2 py-0 border-0 ${priorityCfg.color}`}>
                          {priorityCfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="flex -space-x-1.5">
                          {task.assignees && task.assignees.length > 0 ? (
                            <>
                              {task.assignees.slice(0, 3).map((a) => (
                                <Avatar key={a.userId} className="w-6 h-6 border-2 border-background">
                                  <AvatarFallback className="text-[9px] bg-primary/10 text-primary">
                                    {a.user ? getInitials(a.user.name) : '?'}
                                  </AvatarFallback>
                                </Avatar>
                              ))}
                              {task.assignees.length > 3 && (
                                <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[9px] font-medium border-2 border-background">
                                  +{task.assignees.length - 3}
                                </div>
                              )}
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground">Unassigned</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        {task.dueDate ? (
                          <span className={`text-xs flex items-center gap-1.5 ${isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                            <Calendar className="w-3 h-3" />
                            {format(new Date(task.dueDate), 'MMM d, yyyy')}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="py-3">
                        {project ? (
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: project.color }} />
                            <span className="text-xs text-muted-foreground truncate max-w-[100px]">
                              {project.name}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </motion.tr>
                  )
                })}
              </AnimatePresence>

              {tasks.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground text-sm">
                    No tasks found. Create your first task to get started.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

// ─── Timeline View ───────────────────────────────────────────────────────────

interface TimelineViewProps {
  tasks: Task[]
  projects: Project[]
  onTaskClick: (task: Task) => void
  onCreateTask: () => void
}

function TimelineView({ tasks, projects, onTaskClick, onCreateTask }: TimelineViewProps) {
  const grouped = useMemo(() => {
    const map = new Map<string, { project: Project; tasks: Task[] }>()
    for (const project of projects) {
      map.set(project.id, { project, tasks: [] })
    }
    for (const task of tasks) {
      const group = map.get(task.projectId)
      if (group) group.tasks.push(task)
    }
    return Array.from(map.values()).filter((g) => g.tasks.length > 0)
  }, [tasks, projects])

  const overallCompleted = tasks.filter((t) => t.status === 'done').length
  const overallTotal = tasks.length
  const overallPercent = overallTotal > 0 ? Math.round((overallCompleted / overallTotal) * 100) : 0

  return (
    <motion.div {...viewTransition} className="space-y-6">
      {/* Overall Summary */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <FolderOpen className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">Overall Progress</h3>
                <p className="text-xs text-muted-foreground">
                  {overallCompleted} of {overallTotal} tasks completed
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-1 max-w-md">
              <Progress value={overallPercent} className="h-2.5 flex-1" />
              <span className="text-sm font-semibold w-10 text-right">{overallPercent}%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Per-Project Groups */}
      <div className="space-y-4">
        {grouped.map(({ project, tasks: projectTasks }) => {
          const completed = projectTasks.filter((t) => t.status === 'done').length
          const total = projectTasks.length
          const percent = total > 0 ? Math.round((completed / total) * 100) : 0
          const inProgress = projectTasks.filter((t) => t.status === 'in_progress').length
          const inReview = projectTasks.filter((t) => t.status === 'in_review').length
          const todo = projectTasks.filter((t) => t.status === 'todo').length

          return (
            <Card key={project.id}>
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${project.color}20` }}
                    >
                      <FolderOpen className="w-4 h-4" style={{ color: project.color }} />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold">{project.name}</h4>
                      <p className="text-xs text-muted-foreground">
                        {project._count?.tasks ?? total} tasks
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] text-slate-500">
                      {todo} To Do
                    </Badge>
                    <Badge variant="outline" className="text-[10px] text-amber-600">
                      {inProgress} Active
                    </Badge>
                    <Badge variant="outline" className="text-[10px] text-purple-600">
                      {inReview} Review
                    </Badge>
                    <Badge variant="outline" className="text-[10px] text-emerald-600">
                      {completed} Done
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Progress Bar */}
                <div className="flex items-center gap-3">
                  <Progress value={percent} className="h-2 flex-1" />
                  <span className="text-xs font-medium text-muted-foreground w-10 text-right">
                    {percent}%
                  </span>
                </div>

                {/* Task List */}
                <div className="space-y-1">
                  {projectTasks.map((task) => {
                    const statusCfg = statusBadgeConfig[task.status]
                    const isDone = task.status === 'done'
                    return (
                      <div
                        key={task.id}
                        className="flex items-center justify-between py-1.5 px-2 rounded-md cursor-pointer hover:bg-muted/60 transition-colors"
                        onClick={() => onTaskClick(task)}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${task.status === 'done' ? 'bg-emerald-500' : task.status === 'in_progress' ? 'bg-amber-500' : task.status === 'in_review' ? 'bg-purple-500' : 'bg-slate-400'}`} />
                          <span className={`text-sm truncate ${isDone ? 'line-through text-muted-foreground' : ''}`}>
                            {task.title}
                          </span>
                        </div>
                        <Badge variant={statusCfg.variant} className={`text-[10px] px-2 py-0 shrink-0 ml-2 ${statusCfg.className}`}>
                          {statusCfg.label}
                        </Badge>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )
        })}

        {grouped.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <FolderOpen className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No tasks across projects yet</p>
              <Button size="sm" className="mt-4 h-8 text-xs" onClick={onCreateTask}>
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Create Task
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </motion.div>
  )
}

// ─── Main TeamDashboard Component ────────────────────────────────────────────

export default function TeamDashboard() {
  const { user, teamView, selectedProjectId, setSelectedProjectId, setSelectedTaskId } = useAuthStore()

  const [projects, setProjects] = useState<Project[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [taskDetailOpen, setTaskDetailOpen] = useState(false)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [mobileColumn, setMobileColumn] = useState<TaskStatus>('todo')

  // ── Data Fetching ──

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/projects')
      if (!res.ok) throw new Error('Failed to fetch projects')
      const data = await res.json()
      let projectList: Project[] = data.projects || []

      // If user is team member, filter to only their projects
      if (user?.role === 'team') {
        projectList = projectList.filter((p: Project) =>
          p.members?.some((m) => m.userId === user.id)
        )
      }

      setProjects(projectList)

      // Auto-select first project if none selected
      if (!selectedProjectId && projectList.length > 0) {
        setSelectedProjectId(projectList[0].id)
      }
    } catch {
      toast.error('Failed to load projects')
    }
  }, [user, selectedProjectId, setSelectedProjectId])

  const fetchTasks = useCallback(async (projectId: string) => {
    if (!projectId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/tasks?projectId=${projectId}`)
      if (!res.ok) throw new Error('Failed to fetch tasks')
      const data = await res.json()
      setTasks(data.tasks || [])
    } catch {
      toast.error('Failed to load tasks')
      setTasks([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  useEffect(() => {
    if (selectedProjectId) {
      fetchTasks(selectedProjectId)
    }
  }, [selectedProjectId, fetchTasks])

  // ── Handlers ──

  const handleTaskClick = useCallback((task: Task) => {
    setSelectedTask(task)
    setSelectedTaskId(task.id)
    setTaskDetailOpen(true)
  }, [setSelectedTaskId])

  const handleTaskUpdate = useCallback(() => {
    if (selectedProjectId) {
      fetchTasks(selectedProjectId)
    }
    // Re-fetch the selected task for detail view
    if (selectedTask?.id) {
      fetch(`/api/tasks/${selectedTask.id}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.task) setSelectedTask(d.task)
        })
        .catch(() => {})
    }
  }, [selectedProjectId, selectedTask?.id])

  const handleTaskCreated = useCallback(() => {
    if (selectedProjectId) {
      fetchTasks(selectedProjectId)
    }
  }, [selectedProjectId, fetchTasks])

  const handleTaskDetailClose = useCallback(() => {
    setTaskDetailOpen(false)
    setSelectedTask(null)
    setSelectedTaskId(null)
  }, [setSelectedTaskId])

  // ── Derived Data ──

  const activeProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId),
    [projects, selectedProjectId]
  )

  const projectMembers = useMemo(() => {
    if (!activeProject?.members) return []
    return activeProject.members
      .map((m) => m.user)
      .filter((u): u is User => !!u)
  }, [activeProject])

  const tasksByStatus = useMemo(() => {
    const map = new Map<TaskStatus, Task[]>()
    for (const col of columns) {
      map.set(col.key, tasks.filter((t) => t.status === col.key))
    }
    return map
  }, [tasks])

  // ── Render ──

  if (projects.length === 0 && !loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <FolderOpen className="w-12 h-12 text-muted-foreground/40 mb-4" />
        <h3 className="text-lg font-semibold mb-1">No Projects Yet</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          You don&apos;t have any projects assigned to you. Contact your admin to get started.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* ── Toolbar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* Project Selector */}
          <Select
            value={selectedProjectId || ''}
            onValueChange={(val) => setSelectedProjectId(val)}
          >
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Select a project" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: project.color }}
                    />
                    {project.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {activeProject && (
            <Badge variant="outline" className="text-[11px] hidden sm:flex">
              <Users className="w-3 h-3 mr-1" />
              {activeProject.members?.length ?? 0} members
            </Badge>
          )}
        </div>

        <Button
          size="sm"
          className="h-8 text-xs"
          onClick={() => setCreateModalOpen(true)}
          disabled={!selectedProjectId}
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Create Task
        </Button>
      </div>

      {/* ── Mobile Column Tab Selector (Board view only) ── */}
      {teamView === 'board' && (
        <div className="md:hidden">
          <Tabs
            value={mobileColumn}
            onValueChange={(val) => setMobileColumn(val as TaskStatus)}
          >
            <TabsList className="w-full grid grid-cols-4 h-9">
              {columns.map((col) => (
                <TabsTrigger
                  key={col.key}
                  value={col.key}
                  className="text-xs gap-1.5 data-[state=active]:shadow-sm"
                >
                  <div className={`w-2 h-2 rounded-full ${col.dotColor}`} />
                  <span className="hidden xs:inline">{col.label}</span>
                  <span className="xs:hidden">{tasksByStatus.get(col.key)?.length ?? 0}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      )}

      {/* ── View Content ── */}
      <AnimatePresence mode="wait">
        {teamView === 'board' && (
          <motion.div
            key="board-view"
            {...viewTransition}
          >
            {loading ? (
              <BoardSkeleton />
            ) : (
              <>
                {/* Desktop: Full grid */}
                <div className="hidden md:grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                  {columns.map((col) => (
                    <BoardColumn
                      key={col.key}
                      config={col}
                      tasks={tasksByStatus.get(col.key) || []}
                      onTaskClick={handleTaskClick}
                      onCreateTask={() => setCreateModalOpen(true)}
                      showCreateButton={col.key === 'todo'}
                    />
                  ))}
                </div>

                {/* Mobile: Single column */}
                <div className="md:hidden">
                  {columns
                    .filter((col) => col.key === mobileColumn)
                    .map((col) => (
                      <BoardColumn
                        key={col.key}
                        config={col}
                        tasks={tasksByStatus.get(col.key) || []}
                        onTaskClick={handleTaskClick}
                        onCreateTask={() => setCreateModalOpen(true)}
                        showCreateButton={col.key === 'todo'}
                      />
                    ))}
                </div>
              </>
            )}
          </motion.div>
        )}

        {teamView === 'list' && (
          <motion.div key="list-view" {...viewTransition}>
            {loading ? (
              <ListSkeleton />
            ) : (
              <ListView
                tasks={tasks}
                projects={projects}
                onTaskClick={handleTaskClick}
                onCreateTask={() => setCreateModalOpen(true)}
              />
            )}
          </motion.div>
        )}

        {teamView === 'timeline' && (
          <motion.div key="timeline-view" {...viewTransition}>
            {loading ? (
              <TimelineSkeleton />
            ) : (
              <TimelineView
                tasks={tasks}
                projects={projects}
                onTaskClick={handleTaskClick}
                onCreateTask={() => setCreateModalOpen(true)}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Task Detail Dialog ── */}
      <TaskDetail
        task={selectedTask}
        open={taskDetailOpen}
        onClose={handleTaskDetailClose}
        onUpdate={handleTaskUpdate}
      />

      {/* ── Create Task Modal ── */}
      <CreateTaskModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        projectId={selectedProjectId || ''}
        projectMembers={projectMembers}
        onCreated={handleTaskCreated}
      />
    </div>
  )
}