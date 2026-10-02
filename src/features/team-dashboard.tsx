'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useAuthStore } from '@/stores/auth'
import { authFetch } from '@/lib/client-fetch'
import { useTimeTrackingStore } from '@/stores/time-tracking'
import type { Project, Task, Comment, User } from '@/types'
import {
  getRoleBadgeClasses, getInitials, getPriorityConfig, getStatusConfig,
  formatDate, formatRelativeTime,
} from '@/features/route-guard'

// shadcn/ui
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Calendar } from '@/components/ui/calendar'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
  DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

// date-fns
import { format, isPast, isToday, parseISO } from 'date-fns'

// toast
import { toast } from 'sonner'

// framer-motion
import { motion, AnimatePresence } from 'framer-motion'

// dnd-kit
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  useDroppable,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// lucide-react
import {
  Plus, Trash2, LayoutGrid, List, CheckCircle2,
  Send, CalendarIcon, Users, FolderKanban,
  Clock, Circle, Play,
  X, Loader2, Check, FileText, Pencil, Phone, Building2,
  Lock, Shield,
  MessageCircle, Hash, AlertCircle, UserPlus,
  Save, RotateCcw, Timer, GripVertical,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { formatDuration, formatElapsed } from '@/lib/format'
import { ProfileAvatarUpload } from '@/components/profile-avatar-upload'

// ─── Helpers ────────────────────────────────────────────────

const STATUS_COLUMNS = [
  { key: 'todo' as const, label: 'To Do', color: 'bg-slate-400', bgColor: 'bg-slate-50 dark:bg-slate-900/40', headerBg: 'bg-slate-100 dark:bg-slate-800/60' },
  { key: 'in_progress' as const, label: 'In Progress', color: 'bg-amber-500', bgColor: 'bg-amber-50/50 dark:bg-amber-900/20', headerBg: 'bg-amber-100 dark:bg-amber-900/40' },
  { key: 'in_review' as const, label: 'In Review', color: 'bg-purple-500', bgColor: 'bg-purple-50/50 dark:bg-purple-900/20', headerBg: 'bg-purple-100 dark:bg-purple-900/40' },
  { key: 'done' as const, label: 'Done', color: 'bg-emerald-500', bgColor: 'bg-emerald-50/50 dark:bg-emerald-900/20', headerBg: 'bg-emerald-100 dark:bg-emerald-900/40' },
]

// ─── Shared Sub-components ──────────────────────────────────

function LoadingCard() {
  return (
    <Card className="p-4">
      <Skeleton className="h-4 w-3/4 mb-3" />
      <Skeleton className="h-3 w-full mb-2" />
      <Skeleton className="h-2 w-full mb-3" />
      <div className="flex justify-between">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-16" />
      </div>
    </Card>
  )
}

function AvatarStack({ users, max = 3 }: { users: (User | undefined)[]; max?: number }) {
  const visible = users.slice(0, max)
  const extra = users.length - max
  return (
    <div className="flex -space-x-2">
      {visible.map((u, i) =>
        u ? (
          <Avatar key={u.id} className="h-6 w-6 border-2 border-background ring-1 ring-border/50" style={{ zIndex: visible.length - i }}>
            {u.avatar && <AvatarImage src={u.avatar} alt={u.name} />}
            <AvatarFallback className="text-[10px] bg-slate-200 dark:bg-slate-700">
              {getInitials(u.name)}
            </AvatarFallback>
          </Avatar>
        ) : null
      )}
      {extra > 0 && (
        <div className="h-6 w-6 rounded-full bg-slate-200 dark:bg-slate-700 border-2 border-background flex items-center justify-center text-[10px] font-medium text-slate-600 dark:text-slate-300" style={{ zIndex: 0 }}>
          +{extra}
        </div>
      )}
    </div>
  )
}

function MemberAvatar({ user, size = 'md' }: { user: User | undefined; size?: 'sm' | 'md' }) {
  const sizeClasses = size === 'sm' ? 'h-8 w-8 text-xs' : 'h-10 w-10 text-sm'
  if (!user) return null
  return (
    <Avatar className={sizeClasses}>
      {user.avatar && <AvatarImage src={user.avatar} alt={user.name} />}
      <AvatarFallback className={cn('bg-slate-200 dark:bg-slate-700 font-medium')}>
        {getInitials(user.name)}
      </AvatarFallback>
    </Avatar>
  )
}

function EmptyState({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16 text-center"
    >
      <div className="h-14 w-14 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
        <Icon className="h-7 w-7 text-slate-400" />
      </div>
      <h3 className="text-base font-semibold text-foreground mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
    </motion.div>
  )
}

// ─── TeamProjects ───────────────────────────────────────────

export function TeamProjects() {
  const { user, setSelectedProjectId } = useAuthStore()
  const isTraining = user?.role === 'training'
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [expandedTasks, setExpandedTasks] = useState<Task[]>([])
  const [expandedLoading, setExpandedLoading] = useState(false)
  const [taskFilter, setTaskFilter] = useState<string>('all')
  const [createTaskOpen, setCreateTaskOpen] = useState(false)
  const [createTaskLoading, setCreateTaskLoading] = useState(false)
  const [createTaskProjectId, setCreateTaskProjectId] = useState<string>('')
  const [allTeamUsers, setAllTeamUsers] = useState<User[]>([])

  // Create task form
  const [taskTitle, setTaskTitle] = useState('')
  const [taskDesc, setTaskDesc] = useState('')
  const [taskStatus, setTaskStatus] = useState<'todo' | 'in_progress' | 'in_review' | 'done'>('todo')
  const [taskPriority, setTaskPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium')
  const [taskDueDate, setTaskDueDate] = useState<Date>()
  const [taskTags, setTaskTags] = useState('')
  const [taskAssignee, setTaskAssignee] = useState<string>('')
  const [taskCalendarOpen, setTaskCalendarOpen] = useState(false)

  const fetchProjects = useCallback(async () => {
    if (!user?.id) return // Wait for auth to be ready
    try {
      // Server-side filtering: non-admin users only get projects they're members of
      const res = await authFetch('/api/projects')
      if (!res.ok) throw new Error('Failed to fetch projects')
      const data = await res.json()
      setProjects(data.projects || [])
    } catch {
      toast.error('Failed to load projects')
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => { fetchProjects() }, [fetchProjects])

  // Fetch all active admin + team users for assignee picker
  useEffect(() => {
    authFetch('/api/users')
      .then(r => { if (!r.ok) throw new Error('Failed to fetch users'); return r.json() })
      .then(d => {
        const members = (d.users || []).filter((u: User) => (u.role === 'team' || u.role === 'training' || u.role === 'admin') && u.status === 'active')
        setAllTeamUsers(members)
      })
      .catch(() => {})
  }, [])

  const handleExpand = async (projectId: string) => {
    if (expandedId === projectId) {
      setExpandedId(null)
      setExpandedTasks([])
      return
    }
    setExpandedId(projectId)
    setTaskFilter('all')
    setExpandedLoading(true)
    try {
      const res = await authFetch(`/api/projects/${projectId}`)
      if (!res.ok) throw new Error('Failed to fetch project')
      const data = await res.json()
      setExpandedTasks(data.project?.tasks || [])
    } catch {
      toast.error('Failed to load tasks')
    } finally {
      setExpandedLoading(false)
    }
  }

  const handleCreateTask = async () => {
    if (!taskTitle.trim()) { toast.error('Task title is required'); return }
    if (!user?.id) { toast.error('Not authenticated'); return }
    setCreateTaskLoading(true)
    try {
      const res = await authFetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: taskTitle, description: taskDesc || null, status: taskStatus,
          priority: taskPriority, projectId: createTaskProjectId,
          dueDate: taskDueDate ? taskDueDate.toISOString() : null,
          tags: taskTags,
          createdById: user.id,
          assigneeIds: taskAssignee ? [taskAssignee] : [],
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Failed to create task')
      }
      toast.success('Task created')
      setCreateTaskOpen(false)
      setTaskTitle(''); setTaskDesc(''); setTaskStatus('todo')
      setTaskPriority('medium'); setTaskDueDate(undefined)
      setTaskTags(''); setTaskAssignee('')
      // Always refresh the expanded project view
      handleExpand(createTaskProjectId)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to create task')
    } finally {
      setCreateTaskLoading(false)
    }
  }

  const openCreateTaskForProject = (projectId: string) => {
    setCreateTaskProjectId(projectId)
    setCreateTaskOpen(true)
  }

  const getProjectTaskStats = (projectId: string) => {
    if (expandedId !== projectId) return null
    const total = expandedTasks.length
    const done = expandedTasks.filter((t) => t.status === 'done').length
    return { total, done }
  }

  const filteredTasks = taskFilter === 'all'
    ? expandedTasks
    : expandedTasks.filter((t) => t.status === taskFilter)

  if (loading) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-36" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <LoadingCard key={i} />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Team Projects</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {projects.length} project{projects.length !== 1 ? 's' : ''} you are assigned to
          </p>
        </div>
      </div>

      {/* Project Grid */}
      {projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects yet"
          description="You haven't been assigned to any projects yet. An admin will assign projects to you."
        />
      ) : (
        <motion.div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {projects.map((project, idx) => {
              const totalTasks = project._count?.tasks || 0
              const members = project.members || []
              const memberUsers = members.map((m) => m.user).filter(Boolean) as User[]
              const pConfig = getPriorityConfig(project.priority)
              const isExpanded = expandedId === project.id
              const stats = getProjectTaskStats(project.id)

              return (
                <motion.div
                  key={project.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <Card
                    className={cn(
                      'overflow-hidden cursor-pointer transition-all hover:shadow-md',
                      isExpanded && 'ring-1 ring-primary/20 shadow-md',
                    )}
                    onClick={() => handleExpand(project.id)}
                  >
                    <div className="flex">
                      <div className="w-1.5 shrink-0" style={{ backgroundColor: project.color }} />
                      <CardContent className="flex-1 p-4">
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-semibold text-sm leading-tight line-clamp-1">{project.name}</h3>
                          <Badge className={cn('text-[10px] px-1.5 py-0 ml-2 shrink-0', pConfig.color)}>
                            {pConfig.label}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-3 min-h-[2rem]">
                          {project.description || 'No description'}
                        </p>
                        <Progress
                          value={stats ? (stats.total > 0 ? (stats.done / stats.total) * 100 : 0) : 0}
                          className="h-1.5 mb-3"
                        />
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <div className="flex items-center gap-3">
                            <span className="flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                              {stats ? `${stats.done}/${stats.total}` : totalTasks}
                            </span>
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {members.length}
                            </span>
                          </div>
                          {project.dueDate && (
                            <span className={cn(
                              isPast(parseISO(project.dueDate)) && !isToday(parseISO(project.dueDate))
                                ? 'text-red-500' : '',
                            )}>
                              {formatDate(project.dueDate)}
                            </span>
                          )}
                        </div>
                        {memberUsers.length > 0 && (
                          <div className="mt-3">
                            <AvatarStack users={memberUsers} max={4} />
                          </div>
                        )}
                      </CardContent>
                    </div>
                  </Card>

                  {/* Expanded Task List */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Card className="mt-3 p-4 space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="flex gap-1">
                                {['all', 'todo', 'in_progress', 'in_review', 'done'].map((s) => (
                                  <Button
                                    key={s}
                                    variant={taskFilter === s ? 'default' : 'ghost'}
                                    size="sm"
                                    className="h-7 text-xs px-2"
                                    onClick={() => setTaskFilter(s)}
                                  >
                                    {s === 'all' ? 'All' : getStatusConfig(s).label}
                                  </Button>
                                ))}
                              </div>
                            </div>
                            {!isTraining && (
                            <Button size="sm" className="h-8 text-xs gap-1" onClick={() => openCreateTaskForProject(project.id)}>
                              <Plus className="h-3 w-3" /> Add Task
                            </Button>
                            )}
                          </div>
                          {expandedLoading ? (
                            <div className="space-y-2">
                              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                            </div>
                          ) : filteredTasks.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-4">No tasks found</p>
                          ) : (
                            <ScrollArea className="max-h-64">
                              <div className="space-y-2">
                                {filteredTasks.map((task) => {
                                  const sConfig = getStatusConfig(task.status)
                                  const pConf = getPriorityConfig(task.priority)
                                  const assignees = (task.assignees || []).map((a) => a.user).filter(Boolean) as User[]
                                  return (
                                    <div
                                      key={task.id}
                                      className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/40 hover:bg-muted/70 transition-colors group cursor-pointer"
                                      onClick={() => setSelectedProjectId(project.id)}
                                    >
                                      <div className={cn('h-2 w-2 rounded-full shrink-0', sConfig.dotColor)} />
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{task.title}</p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                          <Badge className={cn('text-[10px] px-1.5 py-0 h-4', pConf.color)}>{pConf.label}</Badge>
                                          {task.dueDate && (
                                            <span className={cn('text-[10px] text-muted-foreground', isPast(parseISO(task.dueDate)) && !isToday(parseISO(task.dueDate)) ? 'text-red-500' : '')}>
                                              {formatDate(task.dueDate)}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                      <AvatarStack users={assignees} max={2} />
                                    </div>
                                  )
                                })}
                              </div>
                            </ScrollArea>
                          )}
                        </Card>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Create Task Dialog */}
      <Dialog open={createTaskOpen} onOpenChange={setCreateTaskOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create New Task</DialogTitle>
            <DialogDescription>Add a task to the project.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input placeholder="Task title" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea placeholder="Describe the task..." value={taskDesc} onChange={(e) => setTaskDesc(e.target.value)} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={taskStatus} onValueChange={(v) => setTaskStatus(v as typeof taskStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todo">To Do</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="in_review">In Review</SelectItem>
                    <SelectItem value="done">Done</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={taskPriority} onValueChange={(v) => setTaskPriority(v as typeof taskPriority)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Popover open={taskCalendarOpen} onOpenChange={setTaskCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal gap-2">
                      <CalendarIcon className="h-4 w-4" />
                      {taskDueDate ? format(taskDueDate, 'PPP') : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={taskDueDate} onSelect={(d) => { setTaskDueDate(d); setTaskCalendarOpen(false) }} />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Assignee</Label>
                <Select value={taskAssignee} onValueChange={setTaskAssignee}>
                  <SelectTrigger><SelectValue placeholder="Select member" /></SelectTrigger>
                  <SelectContent>
                    {allTeamUsers.length === 0 && <SelectItem value="_none" disabled>No members available</SelectItem>}
                    {allTeamUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        <span className="flex items-center gap-2">
                          <span className="inline-block h-5 w-5 rounded-full bg-primary/10 text-primary text-[10px] flex items-center justify-center font-medium">
                            {getInitials(u.name)}
                          </span>
                          <span>{u.name}</span>
                          <span className="text-muted-foreground text-xs capitalize">({u.role})</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Tags (comma separated)</Label>
              <Input placeholder="design, frontend, urgent" value={taskTags} onChange={(e) => setTaskTags(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateTaskOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateTask} disabled={createTaskLoading} className="gap-2">
              {createTaskLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              Create Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Droppable Column for DnD ─────────────────────────────────

function DroppableColumn({ col, children, isDragOver }: { col: typeof STATUS_COLUMNS[number]; children: React.ReactNode; isDragOver: boolean }) {
  const { setNodeRef } = useDroppable({ id: col.key })
  return (
    <div ref={setNodeRef} className={cn(
      'space-y-3 rounded-xl p-2 transition-colors duration-200 min-h-[120px]',
      isDragOver && 'ring-2 ring-primary/30 bg-primary/5'
    )}>
      {children}
    </div>
  )
}

// ─── Sortable Task Card for DnD ───────────────────────────────

type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'done'

function SortableTaskCard({
  task,
  onOpen,
  assignableUsers,
  assigneePopoverTaskId,
  setAssigneePopoverTaskId,
  assigneeLoading,
  onToggleAssignee,
  isTraining,
}: {
  task: Task
  onOpen: (task: Task) => void
  assignableUsers: User[]
  assigneePopoverTaskId: string | null
  setAssigneePopoverTaskId: (id: string | null) => void
  assigneeLoading: string | null
  onToggleAssignee: (task: Task, userId: string) => void
  isTraining: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const pConf = getPriorityConfig(task.priority)
  const assignees = (task.assignees || []).map((a) => a.user).filter(Boolean) as User[]
  const tags = task.tags ? task.tags.split(',').map((t) => t.trim()).filter(Boolean) : []
  const commentCount = task._count?.comments || 0

  return (
    <div ref={setNodeRef} style={style}>
      <Card
        className={cn(
          'p-3 cursor-pointer hover:shadow-md transition-all border-border/50 hover:border-border',
          isDragging && 'opacity-50 shadow-lg rotate-2 scale-105'
        )}
        onClick={() => !isDragging && onOpen(task)}
      >
        <div className="space-y-2.5">
          {/* Drag handle + Tags */}
          <div className="flex items-start justify-between gap-1">
            <div className="flex flex-wrap gap-1 flex-1 min-w-0">
              {tags.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-slate-500">
                  {tag}
                </Badge>
              ))}
              {tags.length > 3 && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-slate-400">
                  +{tags.length - 3}
                </Badge>
              )}
            </div>
            <button
              className="shrink-0 mt-0.5 p-0.5 rounded hover:bg-muted cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-muted-foreground"
              {...attributes}
              {...listeners}
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical className="h-4 w-4" />
            </button>
          </div>

          {/* Title */}
          <h4 className="text-sm font-medium leading-tight">{task.title}</h4>

          {/* Meta row */}
          <div className="flex items-center justify-between">
            <Badge className={cn('text-[10px] px-1.5 py-0 h-4', pConf.color)}>
              {pConf.label}
            </Badge>
            {task.dueDate && (
              <span className={cn(
                'text-[10px] flex items-center gap-1',
                isPast(parseISO(task.dueDate)) && !isToday(parseISO(task.dueDate)) && task.status !== 'done'
                  ? 'text-red-500' : 'text-muted-foreground',
              )}>
                <CalendarIcon className="h-3 w-3" />
                {format(parseISO(task.dueDate), 'MMM dd')}
              </span>
            )}
          </div>

          {/* Bottom row: Assignees + Comments */}
          <div className="flex items-center justify-between pt-1">
            <Popover
              open={!isTraining && assigneePopoverTaskId === task.id}
              onOpenChange={(open) => setAssigneePopoverTaskId(open ? task.id : null)}
            >
              <PopoverTrigger asChild>
                <button
                  className="flex items-center gap-1 hover:opacity-80 transition-opacity"
                  onClick={(e) => e.stopPropagation()}
                >
                  <AvatarStack users={assignees} max={2} />
                  {!isTraining && <UserPlus className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground transition-colors" />}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-2" align="start" side="bottom">
                <p className="text-xs font-medium text-muted-foreground px-1 mb-1.5">Assign to</p>
                <div className="space-y-0.5 max-h-48 overflow-y-auto">
                  {assignableUsers.map((u) => {
                    const isAssigned = assignees.some((a) => a.id === u.id)
                    const isLoading = assigneeLoading === u.id
                    return (
                      <button
                        key={u.id}
                        className={cn(
                          'w-full flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors text-left',
                          isAssigned ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
                        )}
                        onClick={(e) => { e.stopPropagation(); onToggleAssignee(task, u.id) }}
                        disabled={isLoading}
                      >
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-[10px] bg-slate-200 dark:bg-slate-700">
                            {getInitials(u.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="flex-1 truncate text-xs font-medium">{u.name}</span>
                        <span className="text-[10px] text-muted-foreground capitalize">{u.role}</span>
                        {isLoading ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                    ) : isAssigned ? (
                      <Check className="h-3.5 w-3.5 text-primary" />
                    ) : (
                      <Circle className="h-3.5 w-3.5 text-muted-foreground/40" />
                    )}
                  </button>
                    )
                  })}
                </div>
              </PopoverContent>
            </Popover>
            <div className="flex items-center gap-2">
              {commentCount > 0 && (
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <MessageCircle className="h-3 w-3" />
                  {commentCount}
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}

// ─── Drag Overlay Card ─────────────────────────────────────

function DragOverlayCard({ task }: { task: Task }) {
  const pConf = getPriorityConfig(task.priority)
  const assignees = (task.assignees || []).map((a) => a.user).filter(Boolean) as User[]
  return (
    <Card className="p-3 shadow-xl border-primary/30 w-72 rotate-3">
      <div className="space-y-2.5">
        <div className="flex items-center gap-1">
          <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
          <h4 className="text-sm font-medium leading-tight">{task.title}</h4>
        </div>
        <div className="flex items-center justify-between">
          <Badge className={cn('text-[10px] px-1.5 py-0 h-4', pConf.color)}>{pConf.label}</Badge>
          {task.dueDate && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <CalendarIcon className="h-3 w-3" />
              {format(parseISO(task.dueDate), 'MMM dd')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <AvatarStack users={assignees} max={2} />
        </div>
      </div>
    </Card>
  )
}

// ─── TeamTasks ──────────────────────────────────────────────

export function TeamTasks() {
  const { user, setSelectedTaskId, setSelectedProjectId } = useAuthStore()
  const isTraining = user?.role === 'training'
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProject, setSelectedProject] = useState<string>('')
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board')
  const [detailTask, setDetailTask] = useState<Task | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [createLoading, setCreateLoading] = useState(false)

  // Create task form
  const [cTitle, setCTitle] = useState('')
  const [cDesc, setCDesc] = useState('')
  const [cStatus, setCStatus] = useState<'todo' | 'in_progress' | 'in_review' | 'done'>('todo')
  const [cPriority, setCPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium')
  const [cDueDate, setCDueDate] = useState<Date>()
  const [cTags, setCTags] = useState('')
  const [cAssignee, setCAssignee] = useState<string>('')
  const [cCalendarOpen, setCCalendarOpen] = useState(false)

  // All active admin + team users for assignee pickers
  const [allTeamUsers, setAllTeamUsers] = useState<User[]>([])

  // Detail task comments
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [commentLoading, setCommentLoading] = useState(false)

  // Detail edit
  const [editStatus, setEditStatus] = useState<string>('')
  const [editPriority, setEditPriority] = useState<string>('')
  const [editDueDate, setEditDueDate] = useState<Date>()
  const [editCalendarOpen, setEditCalendarOpen] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Check if there are unsaved changes
  const hasChanges = detailTask
    ? editTitle.trim() !== detailTask.title
      || editDesc !== (detailTask.description || '')
      || editStatus !== detailTask.status
      || editPriority !== detailTask.priority
      || (editDueDate ? editDueDate.toISOString() : null) !== (detailTask.dueDate || null)
    : false

  // DnD state
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  )

  // Build column task IDs for sortable
  const columnTaskIds = useMemo(() => {
    const map: Record<TaskStatus, string[]> = { todo: [], in_progress: [], in_review: [], done: [] }
    for (const t of tasks) {
      map[t.status as TaskStatus]?.push(t.id)
    }
    return map
  }, [tasks])

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === event.active.id)
    if (task) setActiveTask(task)
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event
    if (!over) return
    // Determine which column the item is being dragged over
    const overId = over.id as string
    const overTask = tasks.find((t) => t.id === overId)
    if (overTask) {
      setDragOverColumn(overTask.status as TaskStatus)
    } else if (STATUS_COLUMNS.some((c) => c.key === overId)) {
      setDragOverColumn(overId as TaskStatus)
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveTask(null)
    setDragOverColumn(null)

    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    const activeTaskItem = tasks.find((t) => t.id === activeId)
    if (!activeTaskItem) return

    // Determine the target status column
    let targetStatus: TaskStatus | null = null
    const overTask = tasks.find((t) => t.id === overId)
    if (overTask) {
      targetStatus = overTask.status as TaskStatus
    } else {
      // Check if dropped on a column (column IDs are the status keys)
      const possibleStatus = overId as TaskStatus
      if (STATUS_COLUMNS.some((c) => c.key === possibleStatus)) {
        targetStatus = possibleStatus
      }
    }

    if (!targetStatus || activeTaskItem.status === targetStatus) return

    // Training users cannot move tasks
    if (isTraining) {
      toast.error('Training users cannot move tasks')
      return
    }

    // Optimistic UI update
    setTasks((prev) =>
      prev.map((t) => (t.id === activeId ? { ...t, status: targetStatus! } : t))
    )

    try {
      const res = await authFetch(`/api/tasks/${activeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: targetStatus, updatedBy: user?.id }),
      })
      if (!res.ok) {
        // Revert on error
        setTasks((prev) =>
          prev.map((t) => (t.id === activeId ? { ...t, status: activeTaskItem.status } : t))
        )
        toast.error('Failed to move task')
      } else {
        toast.success(`Moved to ${STATUS_COLUMNS.find((c) => c.key === targetStatus)?.label}`)
      }
    } catch {
      // Revert on error
      setTasks((prev) =>
        prev.map((t) => (t.id === activeId ? { ...t, status: activeTaskItem.status } : t))
      )
      toast.error('Failed to move task')
    }
  }

  // Inline assignee management on task cards
  const [assigneePopoverTaskId, setAssigneePopoverTaskId] = useState<string | null>(null)
  const [assigneeLoading, setAssigneeLoading] = useState<string | null>(null)

  const fetchProjects = useCallback(async () => {
    if (!user?.id) return // Wait for auth to be ready
    try {
      // Server-side filtering: non-admin users only get projects they're members of
      const res = await authFetch('/api/projects')
      if (!res.ok) throw new Error('Failed to fetch projects')
      const data = await res.json()
      const filteredProjects = data.projects || []
      setProjects(filteredProjects)
      if (filteredProjects.length > 0 && !selectedProject) {
        setSelectedProject(filteredProjects[0].id)
      }
    } catch {
      toast.error('Failed to load projects')
    }
  }, [user?.id])

  const fetchTasks = useCallback(async () => {
    if (!selectedProject) return
    setLoading(true)
    try {
      const res = await authFetch(`/api/tasks?projectId=${selectedProject}`)
      if (!res.ok) throw new Error('Failed to fetch tasks')
      const data = await res.json()
      setTasks(data.tasks || [])
    } catch {
      toast.error('Failed to load tasks')
    } finally {
      setLoading(false)
    }
  }, [selectedProject])

  useEffect(() => { fetchProjects() }, [fetchProjects])
  useEffect(() => { fetchTasks() }, [fetchTasks])

  // Fetch all active admin + team users for assignee pickers
  useEffect(() => {
    authFetch('/api/users')
      .then(r => { if (!r.ok) throw new Error('Failed to fetch users'); return r.json() })
      .then(d => {
        const members = (d.users || []).filter((u: User) => (u.role === 'team' || u.role === 'training' || u.role === 'admin') && u.status === 'active')
        setAllTeamUsers(members)
      })
      .catch(() => {})
  }, [])

  const openDetail = async (task: Task) => {
    setDetailTask(task)
    setEditStatus(task.status)
    setEditPriority(task.priority)
    setEditDueDate(task.dueDate ? parseISO(task.dueDate) : undefined)
    setEditTitle(task.title)
    setEditDesc(task.description || '')
    setIsEditingTitle(false)
    setDetailOpen(true)
    setSelectedTaskId(task.id)
    setSelectedProjectId(task.projectId)

    try {
      const cmRes = await authFetch(`/api/comments?taskId=${task.id}`)
      if (!cmRes.ok) throw new Error('Failed to load comments')
      const cmData = await cmRes.json()
      setComments(cmData.comments || [])
    } catch {
      // Comments may not exist
    }
  }

  const handleSaveTask = async () => {
    if (!detailTask) return
    setUpdating(true)
    try {
      const updates: Record<string, unknown> = {}
      if (editTitle.trim() !== detailTask.title) updates.title = editTitle.trim()
      if (editDesc !== (detailTask.description || '')) updates.description = editDesc || null
      if (editStatus !== detailTask.status) updates.status = editStatus
      if (editPriority !== detailTask.priority) updates.priority = editPriority
      const newDueDate = editDueDate ? editDueDate.toISOString() : null
      if (newDueDate !== (detailTask.dueDate || null)) updates.dueDate = newDueDate

      if (Object.keys(updates).length === 0) { setUpdating(false); return }

      const res = await authFetch(`/api/tasks/${detailTask.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...updates, updatedBy: user?.id }),
      })
      if (!res.ok) {
        toast.error('Failed to save')
        return
      }
      const data = await res.json()
      const updatedTask = data.task || { ...detailTask, ...updates }
      setDetailTask(updatedTask as Task)
      fetchTasks()
      toast.success('Task saved successfully')
    } catch {
      toast.error('Failed to save task')
    } finally {
      setUpdating(false)
    }
  }

  const handleDiscardChanges = () => {
    if (!detailTask) return
    setEditTitle(detailTask.title)
    setEditDesc(detailTask.description || '')
    setEditStatus(detailTask.status)
    setEditPriority(detailTask.priority)
    setEditDueDate(detailTask.dueDate ? parseISO(detailTask.dueDate) : undefined)
    setIsEditingTitle(false)
  }

  const handleDeleteTask = async () => {
    if (!detailTask) return
    setDeleting(true)
    try {
      const res = await authFetch(`/api/tasks/${detailTask.id}`, { method: 'DELETE' })
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Failed to delete task') }
      toast.success('Task deleted')
      setDetailOpen(false)
      setDetailTask(null)
      fetchTasks()
    } catch {
      toast.error('Failed to delete task')
    } finally {
      setDeleting(false)
    }
  }

  const handleAddComment = async () => {
    if (!detailTask || !newComment.trim() || !user) return
    setCommentLoading(true)
    try {
      const cmPostRes = await authFetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newComment, taskId: detailTask.id, userId: user.id }),
      })
      if (!cmPostRes.ok) throw new Error('Failed to add comment')
      setNewComment('')
      const res = await authFetch(`/api/comments?taskId=${detailTask.id}`)
      if (!res.ok) throw new Error('Failed to fetch comments')
      const data = await res.json()
      setComments(data.comments || [])
      fetchTasks()
    } catch {
      toast.error('Failed to add comment')
    } finally {
      setCommentLoading(false)
    }
  }

  const handleCreateTask = async () => {
    if (!cTitle.trim() || !selectedProject || !user) return
    setCreateLoading(true)
    try {
      const res = await authFetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: cTitle, description: cDesc || null, status: cStatus,
          priority: cPriority, projectId: selectedProject,
          dueDate: cDueDate ? cDueDate.toISOString() : null,
          tags: cTags, createdById: user.id,
          assigneeIds: cAssignee ? [cAssignee] : [],
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Failed to create task')
      }
      toast.success('Task created')
      setCreateOpen(false)
      setCTitle(''); setCDesc(''); setCStatus('todo')
      setCPriority('medium'); setCDueDate(undefined); setCTags(''); setCAssignee('')
      fetchTasks()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to create task')
    } finally {
      setCreateLoading(false)
    }
  }

  const handleCommentKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleAddComment()
    }
  }

  // Inline assignee management
  const handleToggleAssignee = async (task: Task, userId: string) => {
    if (!user || isTraining) return
    const isAssigned = task.assignees?.some((a) => a.userId === userId)
    setAssigneeLoading(userId)
    try {
      if (isAssigned) {
        const delRes = await authFetch('/api/tasks/assignments', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, taskId: task.id }),
        })
        if (!delRes.ok) throw new Error('Failed to remove assignee')
        toast.success('Assignee removed')
      } else {
        const res = await authFetch('/api/tasks/assignments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, taskId: task.id, assignedBy: user.id }),
        })
        if (!res.ok) {
          const d = await res.json()
          if (res.status === 409) return // Already assigned, silent
          throw new Error(d.error)
        }
        toast.success('Assignee added')
      }
      fetchTasks()
      // If detail dialog is open for this task, refresh it
      if (detailTask && detailTask.id === task.id) {
        openDetail({ ...task, assignees: isAssigned
          ? task.assignees?.filter((a) => a.userId !== userId)
          : [...(task.assignees || []), { id: 'temp-' + Date.now(), taskId: task.id, userId, assignedAt: new Date().toISOString(), user: allTeamUsers.find((u) => u.id === userId) }]
        })
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to update assignee')
    } finally {
      setAssigneeLoading(null)
    }
  }

  const currentProject = projects.find((p) => p.id === selectedProject)

  // Use all active admin + team users for assignee pickers
  const assignableUsers = allTeamUsers

  if (loading && projects.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-8 w-24" />
              {Array.from({ length: 3 }).map((_, j) => <Skeleton key={j} className="h-28 w-full rounded-lg" />)}
            </div>
          ))}
        </div>
      </div>
    )
  }

  // No projects empty state
  if (!loading && projects.length === 0) {
    return (
      <EmptyState
        icon={FolderKanban}
        title="No projects yet"
        description="You haven't been assigned to any projects yet. An admin will assign projects to you."
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Select value={selectedProject} onValueChange={setSelectedProject}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Select project" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                    {p.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {currentProject && (
            <Badge variant="outline" className="text-xs">
              {tasks.length} task{tasks.length !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-muted rounded-lg p-0.5">
            <Button
              variant={viewMode === 'board' ? 'default' : 'ghost'}
              size="sm"
              className="h-8 gap-1.5"
              onClick={() => setViewMode('board')}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> Board
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              className="h-8 gap-1.5"
              onClick={() => setViewMode('list')}
            >
              <List className="h-3.5 w-3.5" /> List
            </Button>
          </div>
          {!isTraining && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" /> Create Task
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Create New Task</DialogTitle>
                <DialogDescription>Add a task to {currentProject?.name || 'the project'}.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input placeholder="Task title" value={cTitle} onChange={(e) => setCTitle(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea placeholder="Describe the task..." value={cDesc} onChange={(e) => setCDesc(e.target.value)} rows={2} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={cStatus} onValueChange={(v) => setCStatus(v as typeof cStatus)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todo">To Do</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="in_review">In Review</SelectItem>
                        <SelectItem value="done">Done</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Priority</Label>
                    <Select value={cPriority} onValueChange={(v) => setCPriority(v as typeof cPriority)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Due Date</Label>
                    <Popover open={cCalendarOpen} onOpenChange={setCCalendarOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal gap-2">
                          <CalendarIcon className="h-4 w-4" />
                          {cDueDate ? format(cDueDate, 'PPP') : 'Pick a date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={cDueDate} onSelect={(d) => { setCDueDate(d); setCCalendarOpen(false) }} />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <Label>Assignee</Label>
                    <Select value={cAssignee} onValueChange={setCAssignee}>
                      <SelectTrigger><SelectValue placeholder="Select member" /></SelectTrigger>
                      <SelectContent>
                        {assignableUsers.length === 0 && <SelectItem value="_none" disabled>No members available</SelectItem>}
                        {assignableUsers.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            <span className="flex items-center gap-2">
                              <span className="inline-block h-5 w-5 rounded-full bg-primary/10 text-primary text-[10px] flex items-center justify-center font-medium">
                                {getInitials(u.name)}
                              </span>
                              <span>{u.name}</span>
                              <span className="text-muted-foreground text-xs capitalize">({u.role})</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Tags (comma separated)</Label>
                  <Input placeholder="design, frontend, urgent" value={cTags} onChange={(e) => setCTags(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button onClick={handleCreateTask} disabled={createLoading} className="gap-2">
                  {createLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Create Task
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          )}
        </div>
      </div>

      {/* Board View with DnD */}
      {viewMode === 'board' ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {STATUS_COLUMNS.map((col) => {
              const colTasks = tasks.filter((t) => t.status === col.key)
              return (
                <DroppableColumn
                  key={col.key}
                  col={col}
                  isDragOver={dragOverColumn === col.key}
                >
                  <div className={cn('flex items-center gap-2 px-3 py-2 rounded-lg', col.headerBg)}>
                    <div className={cn('h-2.5 w-2.5 rounded-full', col.color)} />
                    <span className="text-sm font-semibold">{col.label}</span>
                    <Badge variant="secondary" className="ml-auto text-xs h-5 min-w-5 justify-center">
                      {colTasks.length}
                    </Badge>
                  </div>
                  <ScrollArea className="max-h-[calc(100vh-280px)]">
                    <SortableContext
                      items={columnTaskIds[col.key]}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-2 pb-2">
                        {colTasks.length === 0 ? (
                          <div className="text-center py-8 text-xs text-muted-foreground border-2 border-dashed border-border/50 rounded-lg">
                            {isTraining ? 'No tasks' : 'Drop tasks here'}
                          </div>
                        ) : (
                          colTasks.map((task) => (
                            <SortableTaskCard
                              key={task.id}
                              task={task}
                              onOpen={openDetail}
                              assignableUsers={assignableUsers}
                              assigneePopoverTaskId={assigneePopoverTaskId}
                              setAssigneePopoverTaskId={setAssigneePopoverTaskId}
                              assigneeLoading={assigneeLoading}
                              onToggleAssignee={handleToggleAssignee}
                              isTraining={isTraining}
                            />
                          ))
                        )}
                      </div>
                    </SortableContext>
                  </ScrollArea>
                </DroppableColumn>
              )
            })}
          </div>
          <DragOverlay>
            {activeTask && <DragOverlayCard task={activeTask} />}
          </DragOverlay>
        </DndContext>
      ) : (
        /* List View */
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40%]">Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Assignees</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead className="w-[100px]">Project</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-sm">
                    No tasks found
                  </TableCell>
                </TableRow>
              ) : (
                tasks.map((task) => {
                  const sConf = getStatusConfig(task.status)
                  const pConf = getPriorityConfig(task.priority)
                  const assignees = (task.assignees || []).map((a) => a.user).filter(Boolean) as User[]
                  return (
                    <TableRow
                      key={task.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => openDetail(task)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className={cn('h-2 w-2 rounded-full shrink-0', sConf.dotColor)} />
                          <div>
                            <p className="text-sm font-medium">{task.title}</p>
                            {task.tags && (
                              <div className="flex gap-1 mt-1">
                                {task.tags.split(',').slice(0, 2).map((t) => (
                                  <Badge key={t} variant="outline" className="text-[10px] px-1 py-0 h-4">{t.trim()}</Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={cn('text-[10px]', sConf.color)}>{sConf.label}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={cn('text-[10px]', pConf.color)}>{pConf.label}</Badge>
                      </TableCell>
                      <TableCell>
                        <Popover
                          open={!isTraining && assigneePopoverTaskId === task.id}
                          onOpenChange={(open) => setAssigneePopoverTaskId(open ? task.id : null)}
                        >
                          <PopoverTrigger asChild>
                            <button
                              className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <AvatarStack users={assignees} max={2} />
                              {!isTraining && <UserPlus className="h-3 w-3 text-muted-foreground hover:text-foreground" />}
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-56 p-2" align="start" side="bottom">
                            <p className="text-xs font-medium text-muted-foreground px-1 mb-1.5">Assign to</p>
                            <div className="space-y-0.5 max-h-48 overflow-y-auto">
                              {assignableUsers.map((u) => {
                                const isAssigned = assignees.some((a) => a.id === u.id)
                                const isLoading = assigneeLoading === u.id
                                return (
                                  <button
                                    key={u.id}
                                    className={cn(
                                      'w-full flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors text-left',
                                      isAssigned ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
                                    )}
                                    onClick={(e) => { e.stopPropagation(); handleToggleAssignee(task, u.id) }}
                                    disabled={isLoading}
                                  >
                                    <Avatar className="h-6 w-6">
                                      <AvatarFallback className="text-[10px] bg-slate-200 dark:bg-slate-700">
                                        {getInitials(u.name)}
                                      </AvatarFallback>
                                    </Avatar>
                                    <span className="flex-1 truncate text-xs font-medium">{u.name}</span>
                                    <span className="text-[10px] text-muted-foreground capitalize">{u.role}</span>
                                    {isLoading ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                                    ) : isAssigned ? (
                                      <Check className="h-3.5 w-3.5 text-primary" />
                                    ) : (
                                      <Circle className="h-3.5 w-3.5 text-muted-foreground/40" />
                                    )}
                                  </button>
                                )
                              })}
                            </div>
                          </PopoverContent>
                        </Popover>
                      </TableCell>
                      <TableCell>
                        {task.dueDate ? (
                          <span className={cn(
                            'text-xs',
                            isPast(parseISO(task.dueDate)) && !isToday(parseISO(task.dueDate)) && task.status !== 'done'
                              ? 'text-red-500 font-medium' : 'text-muted-foreground',
                          )}>
                            {formatDate(task.dueDate)}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {task.project && (
                          <div className="flex items-center gap-1.5">
                            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: task.project.color }} />
                            <span className="text-xs truncate max-w-[80px]">{task.project.name}</span>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Task Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={(open) => { setDetailOpen(open); if (!open) { setDetailTask(null); setComments([]) } }}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          {detailTask && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <div className={cn('h-3 w-3 rounded-full', getStatusConfig(detailTask.status).dotColor)} />
                  {isEditingTitle ? (
                    <Input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          setIsEditingTitle(false)
                        }
                        if (e.key === 'Escape') {
                          setEditTitle(detailTask.title)
                          setIsEditingTitle(false)
                        }
                      }}
                      onBlur={() => setIsEditingTitle(false)}
                      className="text-lg font-semibold h-auto py-0"
                      autoFocus
                    />
                  ) : (
                    <DialogTitle
                      className={cn('group text-lg', !isTraining && 'cursor-pointer hover:bg-muted rounded px-1 -mx-1 py-0.5 transition-colors')}
                      onClick={() => !isTraining && setIsEditingTitle(true)}
                    >
                      {editTitle}
                      {!isTraining && <Pencil className="h-3.5 w-3. inline-block ml-2 text-muted-foreground opacity-0 group-hover:opacity-100" />}
                    </DialogTitle>
                  )}
                </div>
                <DialogDescription className="sr-only">Task details</DialogDescription>
              </DialogHeader>

              <div className="space-y-6">
                {/* Status / Priority / Due Date */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Status</Label>
                    <Select value={editStatus} onValueChange={(v) => setEditStatus(v)} disabled={isTraining}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todo">To Do</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="in_review">In Review</SelectItem>
                        <SelectItem value="done">Done</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Priority</Label>
                    <Select value={editPriority} onValueChange={(v) => setEditPriority(v)} disabled={isTraining}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Due Date</Label>
                    <Popover open={!isTraining && editCalendarOpen} onOpenChange={(open) => !isTraining && setEditCalendarOpen(open)}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="h-9 w-full justify-start text-left font-normal gap-2 text-sm" disabled={isTraining}>
                          <CalendarIcon className="h-3.5 w-3.5" />
                          {editDueDate ? format(editDueDate, 'PPP') : 'Set date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={editDueDate}
                          onSelect={(d) => { setEditDueDate(d); setEditCalendarOpen(false) }}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                {/* Description (editable) */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Description</Label>
                  <Textarea
                    placeholder="Add a description..."
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    className="text-sm min-h-[60px] resize-none"
                    rows={2}
                    disabled={isTraining}
                  />
                </div>

                {/* Tags */}
                {detailTask.tags && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Tags</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {detailTask.tags.split(',').map((t) => t.trim()).filter(Boolean).map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          <Hash className="h-3 w-3 mr-1" />{tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Assignees */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Assignees</Label>
                    <span className="text-[10px] text-muted-foreground">{detailTask.assignees?.length || 0} assigned</span>
                  </div>
                  <div className="space-y-1.5">
                    {/* Current assignees as removable chips */}
                    {detailTask.assignees && detailTask.assignees.length > 0 ? (
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-1.5">
                          {detailTask.assignees.map((a) => (
                            <div key={a.id || a.userId} className="flex items-center gap-1.5 bg-muted/50 rounded-lg px-2 py-1 group">
                              <MemberAvatar user={a.user} size="sm" />
                              <span className="text-xs font-medium">{a.user?.name || 'Unknown'}</span>
                              {!isTraining && (
                              <button
                                className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-500"
                                onClick={() => handleToggleAssignee(detailTask, a.userId)}
                              >
                                <X className="h-3 w-3" />
                              </button>
                              )}
                            </div>
                          ))}
                        </div>
                        {/* Assignment History */}
                        <div className="space-y-1 pl-0.5">
                          {detailTask.assignees.map((a) => (
                            <div key={a.id || a.userId} className="flex items-center gap-2 text-[10px] text-muted-foreground">
                              <span className="w-14 shrink-0 truncate font-medium text-foreground/70">{a.user?.name || 'Unknown'}</span>
                              <span>assigned {a.assignedAt ? formatRelativeTime(a.assignedAt) : '—'}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">No one assigned yet</p>
                    )}
                    {/* Add assignee button */}
                    {!isTraining && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                          <UserPlus className="h-3 w-3" /> Add Assignee
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-56 p-2" align="start">
                        <p className="text-xs font-medium text-muted-foreground px-1 mb-1.5">Assign to</p>
                        <div className="space-y-0.5 max-h-48 overflow-y-auto">
                          {assignableUsers.map((u) => {
                            const isAssigned = detailTask.assignees?.some((a) => a.userId === u.id)
                            const isLoading = assigneeLoading === u.id
                            return (
                              <button
                                key={u.id}
                                className={cn(
                                  'w-full flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors text-left',
                                  isAssigned ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
                                )}
                                onClick={() => handleToggleAssignee(detailTask, u.id)}
                                disabled={isLoading}
                              >
                                <Avatar className="h-6 w-6">
                                  <AvatarFallback className="text-[10px] bg-slate-200 dark:bg-slate-700">
                                    {getInitials(u.name)}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="flex-1 truncate text-xs font-medium">{u.name}</span>
                                <span className="text-[10px] text-muted-foreground capitalize">{u.role}</span>
                                {isLoading ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                                ) : isAssigned ? (
                                  <Check className="h-3.5 w-3.5 text-primary" />
                                ) : (
                                  <Circle className="h-3.5 w-3.5 text-muted-foreground/40" />
                                )}
                              </button>
                            )
                          })}
                        </div>
                      </PopoverContent>
                    </Popover>
                    )}
                  </div>

                </div>

                <Separator />

                {/* Comments */}
                <div className="space-y-3">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <MessageCircle className="h-4 w-4" /> Comments
                    {comments.length > 0 && (
                      <Badge variant="secondary" className="text-xs h-5">{comments.length}</Badge>
                    )}
                  </Label>
                  <ScrollArea className="max-h-48">
                    <div className="space-y-3">
                      {comments.map((c) => (
                        <div key={c.id} className="flex gap-2.5">
                          <MemberAvatar user={c.user} size="sm" />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-xs font-semibold">{c.user?.name || 'Unknown'}</span>
                              <span className="text-[10px] text-muted-foreground">{formatRelativeTime(c.createdAt)}</span>
                            </div>
                            <p className="text-sm text-foreground/80 bg-muted/50 rounded-lg p-2.5">{c.content}</p>
                          </div>
                        </div>
                      ))}
                      {comments.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-4">No comments yet</p>
                      )}
                    </div>
                  </ScrollArea>
                  {!isTraining && (
                  <div className="flex gap-2">
                    <Textarea
                      placeholder="Write a comment... (Ctrl+Enter to send)"
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      onKeyDown={handleCommentKeyDown}
                      className="min-h-[60px] text-sm resize-none"
                      rows={2}
                    />
                    <Button
                      size="sm"
                      className="h-auto self-end px-3"
                      onClick={handleAddComment}
                      disabled={commentLoading || !newComment.trim()}
                    >
                      {commentLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                  )}
                </div>

                <Separator />

                {/* Action buttons: Save, Discard, Delete */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {hasChanges && (
                      <span className="text-xs text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> Unsaved changes
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {!isTraining && hasChanges && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={handleDiscardChanges}
                        disabled={updating}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Discard
                      </Button>
                    )}
                    {!isTraining && (
                    <Button
                      size="sm"
                      className="gap-1.5"
                      onClick={handleSaveTask}
                      disabled={updating || !hasChanges}
                    >
                      {updating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                      Save Changes
                    </Button>
                    )}
                    {!isTraining && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm" className="gap-2" disabled={deleting}>
                          {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Task</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete &quot;{detailTask.title}&quot;? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handleDeleteTask} className="bg-destructive text-white hover:bg-destructive/90">
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── TeamMessages ───────────────────────────────────────────
export { MessagesPanel as TeamMessages } from '@/components/messages/MessagesPanel'

// ─── TeamProfile ────────────────────────────────────────────

export function TeamProfile() {
  const { user, updateUser } = useAuthStore()
  const [profile, setProfile] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [passwordSaving, setPasswordSaving] = useState(false)

  // Profile form
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [company, setCompany] = useState('')

  // Password form
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const fetchProfile = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const res = await authFetch(`/api/user/profile?userId=${user.id}`)
      if (!res.ok) throw new Error('Failed to fetch profile')
      const data = await res.json()
      const u = data.user || user
      setProfile(u)
      setName(u.name)
      setEmail(u.email)
      setPhone(u.phone || '')
      setCompany(u.company || '')
    } catch {
      toast.error('Failed to load profile')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { fetchProfile() }, [fetchProfile])

  const handleSaveProfile = async () => {
    if (!name.trim() || !email.trim()) {
      toast.error('Name and email are required')
      return
    }
    setSaving(true)
    try {
      const res = await authFetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.id, name, email, phone: phone || null, company: company || null }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to save')
        return
      }
      setProfile(data.user || profile)
      toast.success('Profile updated')
    } catch {
      toast.error('Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('All password fields are required')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match')
      return
    }
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    setPasswordSaving(true)
    try {
      const res = await authFetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.id, currentPassword, newPassword }),
      })
      if (!res.ok) {
        toast.error('Failed to save')
        return
      }
      toast.success('Password changed')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch {
      toast.error('Failed to change password')
    } finally {
      setPasswordSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 max-w-2xl">
        <Skeleton className="h-8 w-48" />
        <Card className="p-6 space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
        </Card>
      </div>
    )
  }

  const displayUser = profile || user

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Profile Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your account information and preferences</p>
      </div>

      {/* Profile Header Card */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="p-6">
          <div className="flex items-start gap-5">
            <ProfileAvatarUpload
              userId={user?.id ?? ''}
              name={displayUser?.name ?? ''}
              avatar={displayUser?.avatar}
              size="lg"
              onAvatarChange={(newAvatar) => {
                if (user) updateUser({ avatar: newAvatar })
              }}
            />
            <div className="flex-1 space-y-3">
              <div>
                <h2 className="text-lg font-semibold">{displayUser?.name}</h2>
                <p className="text-sm text-muted-foreground">{displayUser?.email}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge className={getRoleBadgeClasses(displayUser?.role || 'team')}>
                  <Shield className="h-3 w-3 mr-1" />
                  {displayUser?.role === 'training' ? 'Training' : 'Team Member'}
                </Badge>
                {displayUser?.createdAt && (
                  <Badge variant="outline" className="text-xs">
                    <CalendarIcon className="h-3 w-3 mr-1" />
                    Member since {formatDate(displayUser.createdAt)}
                  </Badge>
                )}
                {displayUser?._count?.assignedTasks !== undefined && (
                  <Badge variant="outline" className="text-xs">
                    <FileText className="h-3 w-3 mr-1" />
                    {displayUser._count.assignedTasks} assigned tasks
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Edit Profile */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="p-6">
          <CardHeader className="p-0 mb-5">
            <CardTitle className="text-base flex items-center gap-2">
              <Pencil className="h-4 w-4" /> Edit Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="profile-name">Full Name</Label>
                <Input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-email">Email</Label>
                <Input id="profile-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="profile-phone" className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" /> Phone
                </Label>
                <Input id="profile-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 (555) 000-0000" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-company" className="flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5" /> Company
                </Label>
                <Input id="profile-company" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company name" />
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <Button onClick={handleSaveProfile} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Save Changes
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Change Password */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card className="p-6">
          <CardHeader className="p-0 mb-5">
            <CardTitle className="text-base flex items-center gap-2">
              <Lock className="h-4 w-4" /> Change Password
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-pw">Current Password</Label>
              <Input id="current-pw" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Enter current password" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="new-pw">New Password</Label>
                <Input id="new-pw" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min. 8 characters" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-pw">Confirm New Password</Label>
                <Input id="confirm-pw" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter new password" />
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <Button onClick={handleChangePassword} disabled={passwordSaving} variant="outline" className="gap-2">
                {passwordSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                Update Password
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}

// ─── Time Tracking Component ──────────────────────────────────

// formatDuration and formatElapsed imported from @/lib/format

type TimeEntry = {
  id: string
  userId: string
  projectId?: string
  taskId?: string
  description?: string
  date: string
  timeIn?: string
  timeOut?: string
  duration: number
  status: 'idle' | 'timed_in' | 'completed'
  user?: User
  project?: Project
  task?: Task
}

type DateFilter = 'today' | 'week' | 'month' | 'all' | 'custom'

export function TeamTimeTracking() {
  const { user } = useAuthStore()
  const { activeSession } = useTimeTrackingStore()

  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [activeEntry, setActiveEntry] = useState<TimeEntry | null>(null)
  const [elapsed, setElapsed] = useState('00:00:00')

  const [dateFilter, setDateFilter] = useState<DateFilter>('today')
  const [customDateFrom, setCustomDateFrom] = useState<Date>()
  const [customDateTo, setCustomDateTo] = useState<Date>()

  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Date range helpers ──
  const getDateRange = useCallback((filter: DateFilter, customFrom?: Date, customTo?: Date) => {
    const now = new Date()
    const today = format(now, 'yyyy-MM-dd')
    if (filter === 'custom') {
      return {
        dateFrom: customFrom ? format(customFrom, 'yyyy-MM-dd') : today,
        dateTo: customTo ? format(customTo, 'yyyy-MM-dd') : today,
      }
    }
    switch (filter) {
      case 'today':
        return { dateFrom: today, dateTo: today }
      case 'week': {
        const startOfWeek = new Date(now)
        startOfWeek.setDate(now.getDate() - now.getDay() + 1)
        return { dateFrom: format(startOfWeek, 'yyyy-MM-dd'), dateTo: today }
      }
      case 'month': {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        return { dateFrom: format(startOfMonth, 'yyyy-MM-dd'), dateTo: today }
      }
      case 'all':
        return { dateFrom: '2020-01-01', dateTo: '2099-12-31' }
    }
  }, [])

  // ── Sync active entry from shared store (sidebar ↔ time tracking page) ──
  useEffect(() => {
    if (activeSession) {
      setActiveEntry({
        id: activeSession.id,
        userId: user?.id || '',
        projectId: activeSession.projectId,
        project: activeSession.project,
        task: activeSession.task,
        description: activeSession.description,
        timeIn: activeSession.timeIn,
        status: 'timed_in',
        date: new Date(activeSession.timeIn).toISOString().slice(0, 10),
        duration: 0,
        createdAt: activeSession.timeIn,
        updatedAt: activeSession.timeIn,
      } as TimeEntry)
    } else {
      setActiveEntry(null)
    }
  }, [activeSession, user?.id])

  // ── Fetch entries ──
  const fetchEntries = useCallback(async (filter: DateFilter, from?: Date, to?: Date) => {
    if (!user) return
    setLoading(true)
    try {
      const { dateFrom, dateTo } = getDateRange(filter, from, to)
      const res = await authFetch(`/api/time-entries?userId=${user.id}&dateFrom=${dateFrom}&dateTo=${dateTo}`)
      if (!res.ok) throw new Error('Failed to fetch time entries')
      const data = await res.json()
      setEntries(data.timeEntries || [])
    } catch {
      toast.error('Failed to load time entries')
    } finally {
      setLoading(false)
    }
  }, [user, getDateRange])

  // ── Summary stats ──
  const [summary, setSummary] = useState({ today: 0, week: 0, month: 0 })

  const fetchSummary = useCallback(async () => {
    if (!user) return
    try {
      const today = format(new Date(), 'yyyy-MM-dd')
      const startOfWeek = new Date()
      startOfWeek.setDate(new Date().getDate() - new Date().getDay() + 1)
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)

      const [todayRes, weekRes, monthRes] = await Promise.all([
        authFetch(`/api/time-entries?userId=${user.id}&dateFrom=${today}&dateTo=${today}`),
        authFetch(`/api/time-entries?userId=${user.id}&dateFrom=${format(startOfWeek, 'yyyy-MM-dd')}&dateTo=${today}`),
        authFetch(`/api/time-entries?userId=${user.id}&dateFrom=${format(startOfMonth, 'yyyy-MM-dd')}&dateTo=${today}`),
      ])

      const [todayData, weekData, monthData] = await Promise.all([
        todayRes.json(),
        weekRes.json(),
        monthRes.json(),
      ])

      const sumMinutes = (list: TimeEntry[]) => list.reduce((a, e) => a + (e.duration || 0), 0)

      setSummary({
        today: sumMinutes(todayData.timeEntries || []),
        week: sumMinutes(weekData.timeEntries || []),
        month: sumMinutes(monthData.timeEntries || []),
      })
    } catch {
      // silent
    }
  }, [user])

  // ── Initial load ──
  useEffect(() => {
    fetchEntries(dateFilter)
    fetchSummary()
  }, [])

  // ── Re-fetch on filter change ──
  useEffect(() => {
    fetchEntries(dateFilter, customDateFrom, customDateTo)
  }, [dateFilter, customDateFrom, customDateTo, fetchEntries])

  // ── Live elapsed timer ──
  useEffect(() => {
    if (activeEntry?.timeIn) {
      setElapsed(formatElapsed(activeEntry.timeIn))
      elapsedRef.current = setInterval(() => {
        setElapsed(formatElapsed(activeEntry.timeIn!))
      }, 1000)
    }
    return () => {
      if (elapsedRef.current) clearInterval(elapsedRef.current)
    }
  }, [activeEntry])

  // ── Delete handler ──
  const handleDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      const res = await authFetch(`/api/time-entries/${deleteId}`, { method: 'DELETE' })
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Failed to delete entry') }
      toast.success('Entry deleted')
      setDeleteId(null)
      await fetchEntries(dateFilter, customDateFrom, customDateTo)
      await fetchSummary()
    } catch {
      toast.error('Failed to delete entry')
    } finally {
      setDeleting(false)
    }
  }

  // ── Group entries by date ──
  const groupedEntries: { date: string; entries: TimeEntry[] }[] = []
  const sortedEntries = [...entries].sort((a, b) => {
    const dateComp = b.date.localeCompare(a.date)
    if (dateComp !== 0) return dateComp
    return (b.timeIn || '').localeCompare(a.timeIn || '')
  })
  sortedEntries.forEach((entry) => {
    const last = groupedEntries[groupedEntries.length - 1]
    if (last && last.date === entry.date) {
      last.entries.push(entry)
    } else {
      groupedEntries.push({ date: entry.date, entries: [entry] })
    }
  })

  const filterButtons: { key: DateFilter; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: 'week', label: 'This Week' },
    { key: 'month', label: 'This Month' },
    { key: 'all', label: 'All Time' },
    { key: 'custom', label: 'Custom' },
  ]

  const statusBadge = (status: string) => {
    switch (status) {
      case 'timed_in':
        return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200">Active</Badge>
      case 'completed':
        return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200">Completed</Badge>
      default:
        return <Badge variant="secondary">Idle</Badge>
    }
  }

  const formatTimeRange = (entry: TimeEntry) => {
    if (!entry.timeIn) return ''
    const inStr = format(new Date(entry.timeIn), 'h:mm a')
    if (!entry.timeOut) return inStr
    const outStr = format(new Date(entry.timeOut), 'h:mm a')
    return `${inStr} → ${outStr}`
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
          <Clock className="h-5 w-5 text-emerald-700" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-foreground">Time Tracking</h2>
          <p className="text-sm text-muted-foreground">Track your work hours and attendance</p>
        </div>
      </div>

      {/* Active Timer Display / Time In Button */}
      {activeEntry ? (
        <Card className="p-4">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-900/30 shrink-0">
              <Timer className="h-5 w-5 text-amber-600" />
            </div>
            <div className="flex flex-col items-start">
              <span className="text-xs text-muted-foreground">You are currently clocked in</span>
              <span className="font-mono text-2xl font-bold text-amber-700 dark:text-amber-400">{elapsed}</span>
              <div className="flex items-center gap-2 mt-0.5">
                {activeEntry.project && (
                  <div className="flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: activeEntry.project.color }} />
                    <span className="text-xs text-muted-foreground">{activeEntry.project.name}</span>
                  </div>
                )}
                {activeEntry.task && (
                  <span className="text-xs text-muted-foreground">{activeEntry.task.title}</span>
                )}
              </div>
            </div>
            <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200 ml-auto shrink-0">Active</Badge>
          </div>
        </Card>
      ) : (
        <Card className="p-4 border-dashed border-2 border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/40 shrink-0">
                <Play className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Ready to track time</p>
                <p className="text-xs text-muted-foreground">Clock in to start tracking your work hours</p>
              </div>
            </div>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shrink-0"
              onClick={() => {
                const timeInBtn = document.querySelector('[data-time-in-btn]') as HTMLElement
                if (timeInBtn) timeInBtn.click()
                else toast.info('Use the sidebar Time In button to start tracking')
              }}
            >
              <Play className="h-4 w-4" />
              Time In
            </Button>
          </div>
        </Card>
      )}

      {/* Summary Stats Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50">
                <Clock className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Today&apos;s Hours</p>
                <p className="text-xl font-bold text-foreground">{formatDuration(summary.today)}</p>
              </div>
            </div>
          </Card>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50">
                <Clock className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">This Week&apos;s Hours</p>
                <p className="text-xl font-bold text-foreground">{formatDuration(summary.week)}</p>
              </div>
            </div>
          </Card>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50">
                <Clock className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">This Month&apos;s Hours</p>
                <p className="text-xl font-bold text-foreground">{formatDuration(summary.month)}</p>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Date Filter */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {filterButtons.map((fb) => (
            <Button
              key={fb.key}
              variant={dateFilter === fb.key ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDateFilter(fb.key)}
              className={cn(dateFilter === fb.key && 'bg-emerald-600 hover:bg-emerald-700')}
            >
              {fb.label}
            </Button>
          ))}
        </div>
        {dateFilter === 'custom' && (
          <div className="flex items-center gap-2 flex-wrap">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn('h-8 text-xs gap-1.5 w-[140px] justify-start text-left font-normal', !customDateFrom && 'text-muted-foreground')}>
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {customDateFrom ? format(customDateFrom, 'MMM dd, yyyy') : 'From date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={customDateFrom}
                  onSelect={(d) => {
                    setCustomDateFrom(d)
                    if (d && customDateTo && d > customDateTo) setCustomDateTo(undefined)
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <span className="text-xs text-muted-foreground">to</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn('h-8 text-xs gap-1.5 w-[140px] justify-start text-left font-normal', !customDateTo && 'text-muted-foreground')}>
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {customDateTo ? format(customDateTo, 'MMM dd, yyyy') : 'To date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={customDateTo}
                  onSelect={(d) => setCustomDateTo(d)}
                  disabled={(d) => customDateFrom ? d < customDateFrom : false}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            {customDateFrom && customDateTo && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => { setCustomDateFrom(undefined); setCustomDateTo(undefined) }}
              >
                <X className="h-3 w-3 mr-1" />
                Clear
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Time Entries List */}
      <Card className="p-6">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-8 w-16" />
              </div>
            ))}
          </div>
        ) : groupedEntries.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-12 text-center"
          >
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Clock className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium text-foreground">No time entries yet</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              {dateFilter === 'today'
                ? 'Click the "Time In" button above or use the sidebar to start tracking.'
                : `No entries found for ${filterButtons.find((f) => f.key === dateFilter)?.label.toLowerCase() || 'this period'}.`}
            </p>
          </motion.div>
        ) : (
          <div className="space-y-6">
            {groupedEntries.map((group) => (
              <div key={group.date}>
                {/* Date header */}
                <div className="mb-3 flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-muted-foreground">
                    {isToday(parseISO(group.date))
                      ? 'Today'
                      : format(parseISO(group.date), 'EEEE, MMM dd, yyyy')}
                  </h4>
                  <Separator className="flex-1" />
                  <span className="text-xs text-muted-foreground">
                    {formatDuration(group.entries.reduce((a, e) => a + (e.duration || 0), 0))}
                  </span>
                </div>

                {/* Entries */}
                <div className="space-y-3">
                  <AnimatePresence mode="popLayout">
                    {group.entries.map((entry) => (
                      <motion.div
                        key={entry.id}
                        layout
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.2 }}
                        className={cn(
                          'rounded-lg border p-4 transition-colors',
                          entry.status === 'timed_in'
                            ? 'border-amber-200 bg-amber-50/50'
                            : 'border-border bg-card'
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            {/* Project + Task */}
                            <div className="mb-1 flex flex-wrap items-center gap-2">
                              {entry.project && (
                                <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                                  <span
                                    className="inline-block h-2.5 w-2.5 rounded-full"
                                    style={{ backgroundColor: entry.project.color || '#6b7280' }}
                                  />
                                  {entry.project.name}
                                </span>
                              )}
                              {entry.task && (
                                <span className="text-sm text-muted-foreground">· {entry.task.title}</span>
                              )}
                            </div>

                            {/* Time range */}
                            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3.5 w-3.5" />
                                {formatTimeRange(entry)}
                              </span>
                              <span className="font-medium text-foreground">
                                {formatDuration(entry.duration)}
                              </span>
                              {statusBadge(entry.status)}
                            </div>

                            {/* Description */}
                            {entry.description && (
                              <p className="mt-1.5 text-sm text-muted-foreground truncate">
                                {entry.description}
                              </p>
                            )}
                          </div>

                          {/* Delete button */}
                          <AlertDialog
                            open={deleteId === entry.id}
                            onOpenChange={(open) => { if (!open) setDeleteId(null) }}
                          >
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-red-600"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Time Entry</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete this time entry? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-red-600 hover:bg-red-700"
                                  onClick={handleDelete}
                                  disabled={deleting}
                                >
                                  {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </motion.div>
  )
}