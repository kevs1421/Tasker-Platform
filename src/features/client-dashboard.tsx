'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  FolderKanban, MessageSquare, UserCircle, ArrowLeft, ChevronRight,
  ChevronLeft, Send, CheckCircle2, Clock, Eye, Circle, CheckCircle,
  Calendar, Users, Loader2, FileText, Shield, Lock, Save,
  MessageCircle, ListTodo, Check, CheckCheck, Search, ClipboardCheck, Plus
} from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import type {
  User, Project, Task, Message, Comment, Subtask
} from '@/types'
import {
  getRoleBadgeClasses, getInitials, getPriorityConfig, getStatusConfig,
  formatDate, formatRelativeTime
} from '@/features/route-guard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
  DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { isBefore, parseISO } from 'date-fns'
import { cn } from '@/lib/utils'

// ─── Animation Variants ──────────────────────────────────────────
const fadeSlide = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
  transition: { duration: 0.25 }
}

// ─── Shared sub-components ───────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-48 rounded-lg" />
        ))}
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, color }: {
  icon: React.ElementType; label: string; value: number | string; color: string
}) {
  return (
    <motion.div {...fadeSlide} className="bg-card border rounded-xl p-4 md:p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
      </div>
    </motion.div>
  )
}

function PriorityBadge({ priority }: { priority: string }) {
  const cfg = getPriorityConfig(priority)
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dotColor}`} />
      {cfg.label}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const cfg = getStatusConfig(status)
  const Icon = cfg.icon === 'check' ? CheckCircle2 : cfg.icon === 'clock' ? Clock : cfg.icon === 'eye' ? Eye : Circle
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  )
}

function EmptyState({ icon: Icon, title, description }: {
  icon: React.ElementType; title: string; description: string
}) {
  return (
    <motion.div {...fadeSlide} className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
    </motion.div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// CLIENT ONBOARDING (re-exported from wizard component)
// ═══════════════════════════════════════════════════════════════════
export { default as ClientOnboarding } from '@/components/onboarding/ClientOnboardingWizard'

// ═══════════════════════════════════════════════════════════════════
// CLIENT PROJECTS
// ═══════════════════════════════════════════════════════════════════
const ONBOARDING_STEPS = [
  { id: 'business_info', label: 'Business Information', description: 'Company details, contact info, industry', required: true },
  { id: 'brand_assets', label: 'Brand Assets', description: 'Logo, brand colors, typography, guidelines', required: true },
  { id: 'project_kickoff', label: 'Project Kickoff', description: 'Goals, audience, competitors, budget, timeline', required: true },
  { id: 'documents', label: 'Document Submission', description: 'Contract, payment form, work order agreement', required: true },
]

export function ClientProjects() {
  const { user } = useAuthStore()
  const [projects, setProjects] = useState<(Project & { tasks?: (Task & { _count: { comments: number; subtasks: number; completedSubtasks: number } })[] })[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null)
  const [expandedTasks, setExpandedTasks] = useState<Task[]>([])
  const [taskDetail, setTaskDetail] = useState<(Task & { _count: { comments: number; subtasks: number; completedSubtasks: number }; comments?: Comment[]; subtasks?: Subtask[] }) | null>(null)
  const [taskDetailLoading, setTaskDetailLoading] = useState(false)

  // Onboarding creation state
  const [onboardingDialogOpen, setOnboardingDialogOpen] = useState(false)
  const [onboardingProjectId, setOnboardingProjectId] = useState<string>('')
  const [onboardingTitle, setOnboardingTitle] = useState('')
  const [onboardingDesc, setOnboardingDesc] = useState('')
  const [onboardingSteps, setOnboardingSteps] = useState<string[]>(ONBOARDING_STEPS.map(s => s.id))
  const [creatingOnboarding, setCreatingOnboarding] = useState(false)

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/projects')
      const data = await res.json()
      // Filter to active projects and those the client is a member of
      const clientProjects = (data.projects || [])
        .filter((p: Project) => p.status === 'active' && p.members?.some(m => m.userId === user?.id))
      setProjects(clientProjects)
    } catch {
      toast.error('Failed to load projects')
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => { fetchProjects() }, [fetchProjects])

  const expandProject = async (projectId: string) => {
    if (expandedProjectId === projectId) {
      setExpandedProjectId(null)
      setExpandedTasks([])
      return
    }
    setExpandedProjectId(projectId)
    try {
      const res = await fetch(`/api/projects/${projectId}`)
      const data = await res.json()
      setExpandedTasks(data.project?.tasks || [])
    } catch {
      toast.error('Failed to load project tasks')
    }
  }

  const openTaskDetail = async (taskId: string) => {
    setTaskDetailLoading(true)
    setTaskDetail(null)
    try {
      const res = await fetch(`/api/tasks/${taskId}`)
      const data = await res.json()
      setTaskDetail(data.task)
    } catch {
      toast.error('Failed to load task details')
    } finally {
      setTaskDetailLoading(false)
    }
  }

  const openOnboardingDialog = (projectId: string, projectName: string) => {
    setOnboardingProjectId(projectId)
    setOnboardingTitle(`Onboarding - ${projectName}`)
    setOnboardingDesc('')
    setOnboardingSteps(ONBOARDING_STEPS.map(s => s.id))
    setOnboardingDialogOpen(true)
  }

  const handleCreateOnboarding = async () => {
    if (!onboardingTitle.trim() || !onboardingProjectId) return
    setCreatingOnboarding(true)
    try {
      const stepsJson = JSON.stringify(
        onboardingSteps.map(stepId => {
          const config = ONBOARDING_STEPS.find(s => s.id === stepId)
          return { id: stepId, label: config?.label ?? stepId, description: config?.description ?? '', required: config?.required ?? false }
        })
      )
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: onboardingTitle.trim(),
          description: onboardingDesc.trim() || null,
          stepsJson,
          projectId: onboardingProjectId,
          clientId: user?.id || null,
          status: 'published',
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Failed to create')
      }
      toast.success('Onboarding form created successfully')
      setOnboardingDialogOpen(false)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to create onboarding')
    } finally {
      setCreatingOnboarding(false)
    }
  }

  const toggleOnboardingStep = (stepId: string) => {
    setOnboardingSteps(prev =>
      prev.includes(stepId) ? prev.filter(s => s !== stepId) : [...prev, stepId]
    )
  }

  // Stats
  const allTasks = projects.flatMap(p => p.tasks || [])
  const totalTasks = projects.reduce((sum, p) => sum + (p._count?.tasks || 0), 0)
  const completedTasks = allTasks.filter(t => t.status === 'done').length
  const inProgressTasks = allTasks.filter(t => t.status === 'in_progress').length

  if (loading) return <PageSkeleton />

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
          <FolderKanban className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">My Projects</h1>
          <p className="text-sm text-muted-foreground">Track progress on all your active projects</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={FolderKanban} label="My Projects" value={projects.length} color="bg-emerald-500" />
        <StatCard icon={ListTodo} label="Total Tasks" value={totalTasks} color="bg-amber-500" />
        <StatCard icon={CheckCircle2} label="Completed" value={completedTasks} color="bg-teal-500" />
        <StatCard icon={Clock} label="In Progress" value={inProgressTasks} color="bg-orange-500" />
      </div>

      {/* Project Cards */}
      {projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No active projects"
          description="You don't have any active projects yet."
        />
      ) : (
        <div className="space-y-4">
          {projects.map((project, i) => {
            const projectTasks = expandedProjectId === project.id ? expandedTasks : []
            const doneTasks = projectTasks.filter(t => t.status === 'done').length
            const totalT = project._count?.tasks || 0
            const pct = totalT > 0 ? Math.round((doneTasks / totalT) * 100) : 0
            const isOverdue = project.dueDate && isBefore(parseISO(project.dueDate), new Date())

            return (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card
                  className="cursor-pointer hover:shadow-md transition-shadow border-l-4"
                  style={{ borderLeftColor: project.color }}
                  onClick={() => expandProject(project.id)}
                >
                  <CardContent className="p-4 md:p-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-base truncate">{project.name}</h3>
                          <PriorityBadge priority={project.priority} />
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-1">{project.description || 'No description'}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 text-sm">
                        {project.dueDate && (
                          <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-500 font-medium' : 'text-muted-foreground'}`}>
                            <Calendar className="w-3.5 h-3.5" />
                            {formatDate(project.dueDate)}
                          </span>
                        )}
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
                          {project._count?.members || 0}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1.5 text-xs"
                          onClick={(e) => { e.stopPropagation(); openOnboardingDialog(project.id, project.name) }}
                        >
                          <ClipboardCheck className="w-3.5 h-3.5" />
                          Onboarding
                        </Button>
                        <span className="text-muted-foreground cursor-pointer">
                          {expandedProjectId === project.id ? '▲' : '▼'}
                        </span>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="mt-3 space-y-1">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{doneTasks}/{totalT} tasks completed</span>
                        <span>{pct}%</span>
                      </div>
                      <Progress value={pct} className="h-2" />
                    </div>
                  </CardContent>
                </Card>

                {/* Expanded tasks table */}
                <AnimatePresence>
                  {expandedProjectId === project.id && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <Card className="mt-2 rounded-t-none">
                        <CardContent className="p-0">
                          {projectTasks.length === 0 ? (
                            <div className="py-8 text-center text-sm text-muted-foreground">
                              No tasks in this project yet.
                            </div>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b bg-muted/50">
                                    <th className="text-left p-3 font-medium text-muted-foreground">Task</th>
                                    <th className="text-left p-3 font-medium text-muted-foreground hidden md:table-cell">Status</th>
                                    <th className="text-left p-3 font-medium text-muted-foreground hidden sm:table-cell">Priority</th>
                                    <th className="text-left p-3 font-medium text-muted-foreground hidden lg:table-cell">Due Date</th>
                                    <th className="text-left p-3 font-medium text-muted-foreground hidden lg:table-cell">Assignees</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {projectTasks.map(task => (
                                    <tr
                                      key={task.id}
                                      className="border-b last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                                      onClick={(e) => { e.stopPropagation(); openTaskDetail(task.id) }}
                                    >
                                      <td className="p-3">
                                        <div className="font-medium">{task.title}</div>
                                        {task.description && (
                                          <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{task.description}</div>
                                        )}
                                      </td>
                                      <td className="p-3 hidden md:table-cell"><StatusBadge status={task.status} /></td>
                                      <td className="p-3 hidden sm:table-cell"><PriorityBadge priority={task.priority} /></td>
                                      <td className="p-3 hidden lg:table-cell text-muted-foreground text-xs">
                                        {task.dueDate ? formatDate(task.dueDate) : '—'}
                                      </td>
                                      <td className="p-3 hidden lg:table-cell">
                                        <div className="flex -space-x-2">
                                          {task.assignees?.slice(0, 3).map(a => (
                                            <Avatar key={a.id} className="w-6 h-6 border-2 border-background">
                                              <AvatarFallback className="text-[10px] bg-muted">
                                                {getInitials(a.user?.name || '?')}
                                              </AvatarFallback>
                                            </Avatar>
                                          ))}
                                          {(task.assignees?.length || 0) > 3 && (
                                            <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] border-2 border-background">
                                              +{(task.assignees?.length || 0) - 3}
                                            </span>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Create Onboarding Dialog */}
      <Dialog open={onboardingDialogOpen} onOpenChange={setOnboardingDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-primary" />
              Create Onboarding
            </DialogTitle>
            <DialogDescription>Create an onboarding form for this project</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                placeholder="Onboarding form title"
                value={onboardingTitle}
                onChange={(e) => setOnboardingTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Textarea
                placeholder="Brief description of the onboarding..."
                value={onboardingDesc}
                onChange={(e) => setOnboardingDesc(e.target.value)}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Steps</Label>
                <span className="text-xs text-muted-foreground">{onboardingSteps.length} / {ONBOARDING_STEPS.length} selected</span>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {ONBOARDING_STEPS.map((step) => {
                  const isSelected = onboardingSteps.includes(step.id)
                  return (
                    <button
                      key={step.id}
                      type="button"
                      onClick={() => toggleOnboardingStep(step.id)}
                      className={cn(
                        'w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-colors',
                        isSelected ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
                      )}
                    >
                      <div className={cn(
                        'mt-0.5 h-5 w-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors',
                        isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/30'
                      )}>
                        {isSelected && <Check className="w-3 h-3" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{step.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOnboardingDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleCreateOnboarding}
              disabled={creatingOnboarding || !onboardingTitle.trim() || onboardingSteps.length === 0}
              className="gap-2"
            >
              {creatingOnboarding && <Loader2 className="h-4 w-4 animate-spin" />}
              <Plus className="h-4 w-4" />
              Create Onboarding
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Task Detail Dialog */}
      <Dialog open={!!taskDetail} onOpenChange={(open) => { if (!open) setTaskDetail(null) }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          {taskDetailLoading ? (
            <div className="p-6 space-y-4">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : taskDetail ? (
            <TaskDetailDialog task={taskDetail} userId={user?.id || ''} onUpdate={() => openTaskDetail(taskDetail.id)} />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Task Detail Dialog ─────────────────────────────────────
function TaskDetailDialog({
  task, userId, onUpdate
}: {
  task: Task & { _count: { comments: number; subtasks: number; completedSubtasks: number }; comments?: Comment[]; subtasks?: Subtask[] }
  userId: string
  onUpdate: () => void
}) {
  const [comments, setComments] = useState<Comment[]>(task.comments || [])
  const [newComment, setNewComment] = useState('')
  const [sendingComment, setSendingComment] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [comments])

  const sendComment = async () => {
    if (!newComment.trim()) return
    setSendingComment(true)
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newComment.trim(), taskId: task.id, userId })
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setComments(prev => [...prev, data.comment])
      setNewComment('')
      toast.success('Comment added')
    } catch {
      toast.error('Failed to add comment')
    } finally {
      setSendingComment(false)
    }
  }

  const statusCfg = getStatusConfig(task.status)
  const priorityCfg = getPriorityConfig(task.priority)

  return (
    <>
      <DialogHeader>
        <div className="flex items-center gap-2 flex-wrap">
          <DialogTitle className="text-xl">{task.title}</DialogTitle>
          <StatusBadge status={task.status} />
          <PriorityBadge priority={task.priority} />
        </div>
        {task.project && (
          <div className="flex items-center gap-2 mt-1">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: task.project.color }} />
            <span className="text-sm text-muted-foreground">{task.project.name}</span>
          </div>
        )}
      </DialogHeader>

      <ScrollArea className="flex-1 -mx-6 px-6" ref={scrollRef}>
        <div className="space-y-5 py-4">
          {/* Description */}
          {task.description && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-1">Description</h4>
              <p className="text-sm whitespace-pre-wrap">{task.description}</p>
            </div>
          )}

          {/* Details Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {task.dueDate && (
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Due Date</span>
                <div className="flex items-center gap-1.5 text-sm font-medium">
                  <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                  {formatDate(task.dueDate)}
                </div>
              </div>
            )}
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Assignees</span>
              <div className="flex items-center gap-1.5">
                {task.assignees?.map(a => (
                  <Avatar key={a.id} className="w-6 h-6">
                    <AvatarFallback className="text-[10px] bg-muted">
                      {getInitials(a.user?.name || '?')}
                    </AvatarFallback>
                  </Avatar>
                ))}
                {(!task.assignees || task.assignees.length === 0) && (
                  <span className="text-sm text-muted-foreground">Unassigned</span>
                )}
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Created</span>
              <span className="text-sm">{formatRelativeTime(task.createdAt)}</span>
            </div>
          </div>

          {/* Subtasks */}
          {task.subtasks && task.subtasks.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                <ListTodo className="w-3.5 h-3.5" />
                Subtasks ({task._count.completedSubtasks}/{task._count.subtasks})
              </h4>
              <div className="space-y-1.5">
                {task.subtasks.map(sub => (
                  <div key={sub.id} className="flex items-center gap-2 text-sm">
                    {sub.completed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    ) : (
                      <Circle className="w-4 h-4 text-muted-foreground shrink-0" />
                    )}
                    <span className={sub.completed ? 'line-through text-muted-foreground' : ''}>
                      {sub.title}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Separator />

          {/* Comments */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <MessageCircle className="w-3.5 h-3.5" />
              Comments ({comments.length})
            </h4>
            <div className="space-y-3">
              {comments.map(comment => (
                <div key={comment.id} className="flex gap-3">
                  <Avatar className="w-8 h-8 shrink-0">
                    <AvatarFallback className="text-xs bg-muted">
                      {getInitials(comment.user?.name || '?')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{comment.user?.name || 'Unknown'}</span>
                      <span className="text-xs text-muted-foreground">{formatRelativeTime(comment.createdAt)}</span>
                      {comment.user?.role && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${getRoleBadgeClasses(comment.user.role)}`}>
                          {comment.user.role}
                        </span>
                      )}
                    </div>
                    <p className="text-sm mt-0.5 whitespace-pre-wrap">{comment.content}</p>
                  </div>
                </div>
              ))}
              {comments.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No comments yet.</p>
              )}
            </div>
          </div>
        </div>
      </ScrollArea>

      {/* Comment input */}
      <div className="border-t pt-4 mt-auto">
        <div className="flex gap-2">
          <Input
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            placeholder="Add a comment..."
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendComment() } }}
          />
          <Button size="icon" onClick={sendComment} disabled={!newComment.trim() || sendingComment}>
            {sendingComment ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════
// CLIENT MESSAGES
// ═══════════════════════════════════════════════════════════════════
export { MessagesPanel as ClientMessages } from '@/components/messages/MessagesPanel'

// ═══════════════════════════════════════════════════════════════════
// CLIENT PROFILE
// ═══════════════════════════════════════════════════════════════════
export function ClientProfile() {
  const { user, login } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [company, setCompany] = useState('')

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  useEffect(() => {
    if (!user?.id) return
    const fetchProfile = async () => {
      try {
        const res = await fetch(`/api/user/profile?userId=${user.id}`)
        const data = await res.json()
        if (data.user) {
          setName(data.user.name || '')
          setEmail(data.user.email || '')
          setPhone(data.user.phone || '')
          setCompany(data.user.company || '')
        }
      } catch {
        toast.error('Failed to load profile')
      } finally {
        setLoading(false)
      }
    }
    fetchProfile()
  }, [user?.id])

  const saveProfile = async () => {
    if (!user?.id) return
    setSaving(true)
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, name, email, phone, company })
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed')
      }
      const data = await res.json()
      toast.success('Profile updated successfully')
      // Update user in store
      if (data.user && user) {
        login({ ...user, name: data.user.name, email: data.user.email, phone: data.user.phone, company: data.user.company })
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to update profile'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  const changePassword = async () => {
    if (!user?.id) return
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('Please fill in all password fields')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match')
      return
    }
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }
    setSavingPassword(true)
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          currentPassword,
          newPassword
        })
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed')
      }
      toast.success('Password changed successfully')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to change password'
      toast.error(msg)
    } finally {
      setSavingPassword(false)
    }
  }

  if (loading) return <PageSkeleton />

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center">
          <UserCircle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Profile Settings</h1>
          <p className="text-sm text-muted-foreground">Manage your account information</p>
        </div>
      </div>

      {/* Profile Card */}
      <motion.div {...fadeSlide}>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Personal Information</CardTitle>
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${getRoleBadgeClasses(user?.role || 'client')}`}>
                Client
              </span>
            </div>
            {user?.createdAt && (
              <p className="text-sm text-muted-foreground">
                Member since {formatDate(user.createdAt)}
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="profile-name">Full Name</Label>
              <Input
                id="profile-name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your full name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-email">Email Address</Label>
              <Input
                id="profile-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-phone">Phone Number</Label>
              <Input
                id="profile-phone"
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+1 (555) 000-0000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-company">Company</Label>
              <Input
                id="profile-company"
                value={company}
                onChange={e => setCompany(e.target.value)}
                placeholder="Your company name"
              />
            </div>
            <div className="pt-2">
              <Button onClick={saveProfile} disabled={saving} className="w-full sm:w-auto">
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save Changes
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Change Password */}
      <motion.div {...fadeSlide} transition={{ delay: 0.1 }}>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="w-5 h-5 text-muted-foreground" />
              Change Password
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Update your password to keep your account secure
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Current Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="pl-9"
                />
              </div>
            </div>
            <div className="pt-2">
              <Button onClick={changePassword} disabled={savingPassword} variant="outline" className="w-full sm:w-auto">
                {savingPassword ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Shield className="w-4 h-4 mr-2" />}
                Change Password
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}