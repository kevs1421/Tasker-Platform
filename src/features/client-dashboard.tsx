'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  ClipboardList, FolderKanban, MessageSquare, UserCircle, ArrowLeft, ChevronRight,
  ChevronLeft, Send, CheckCircle2, XCircle, Clock, Eye, Circle, CheckCircle,
  Calendar, Users, Loader2, FileText, Shield, Lock, Save,
  MessageCircle, ListTodo, Check, CheckCheck, Search
} from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import type {
  User, Project, Task, OnboardingForm, Onboarding, Message, Comment, Subtask
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
  Dialog, DialogContent, DialogHeader, DialogTitle
} from '@/components/ui/dialog'
import { isBefore, parseISO } from 'date-fns'

// ─── Types ───────────────────────────────────────────────────────
interface StepField {
  name: string
  label: string
  type: 'text' | 'textarea' | 'url' | 'select' | 'email'
  required?: boolean
  options?: string[]
  placeholder?: string
}
interface StepDef { title: string; description?: string; fields: StepField[] }

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
// CLIENT ONBOARDING
// ═══════════════════════════════════════════════════════════════════
export function ClientOnboarding() {
  const { user } = useAuthStore()
  const [forms, setForms] = useState<(OnboardingForm & { _count?: { submissions: number } })[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedForm, setSelectedForm] = useState<(OnboardingForm & { submissions: Onboarding[]; _count?: { submissions: number } }) | null>(null)
  const [formLoading, setFormLoading] = useState(false)

  const fetchForms = useCallback(async () => {
    try {
      const res = await fetch('/api/onboarding')
      const data = await res.json()
      setForms(data.forms || [])
    } catch {
      toast.error('Failed to load onboarding forms')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchForms() }, [fetchForms])

  const openForm = async (formId: string) => {
    setFormLoading(true)
    try {
      const res = await fetch(`/api/onboarding/${formId}`)
      const data = await res.json()
      setSelectedForm(data.form)
    } catch {
      toast.error('Failed to load form')
    } finally {
      setFormLoading(false)
    }
  }

  // ─── Form List View ─────────────────────────────────────
  if (selectedForm) {
    return (
      <OnboardingFormView
        form={selectedForm}
        userId={user?.id || ''}
        onBack={() => { setSelectedForm(null); fetchForms() }}
      />
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
          <ClipboardList className="w-5 h-5 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Onboarding</h1>
          <p className="text-sm text-muted-foreground">Complete your onboarding forms to get started</p>
        </div>
      </div>

      {loading ? <PageSkeleton /> : forms.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No onboarding forms"
          description="There are no onboarding forms assigned to you yet."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {forms.map((form, i) => (
            <motion.div
              key={form.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card
                className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-amber-500"
                onClick={() => openForm(form.id)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base font-semibold leading-tight">{form.title}</CardTitle>
                    {form.project && (
                      <Badge variant="outline" className="ml-2 shrink-0 text-xs" style={{ borderColor: form.project.color, color: form.project.color }}>
                        {form.project.name}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                    {form.description || 'Complete this onboarding form to proceed with your project.'}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <FileText className="w-3.5 h-3.5" />
                    <span>{form._count?.submissions || 0} submission{((form._count?.submissions || 0) !== 1) ? 's' : ''}</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
      {formLoading && <div className="fixed inset-0 bg-background/60 flex items-center justify-center z-50">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>}
    </div>
  )
}

// ─── Onboarding Form Wizard / Read-only View ─────────────────
function OnboardingFormView({
  form, userId, onBack
}: {
  form: OnboardingForm & { submissions: Onboarding[]; _count?: { submissions: number } }
  userId: string
  onBack: () => void
}) {
  const [steps, setSteps] = useState<StepDef[]>([])
  const [currentStep, setCurrentStep] = useState(0)
  const [responses, setResponses] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  const mySubmission = form.submissions?.find(s => s.clientId === userId)

  // Parse steps
  useEffect(() => {
    try {
      const parsed = JSON.parse(form.stepsJson)
      if (Array.isArray(parsed)) setSteps(parsed)
    } catch {
      toast.error('Failed to parse form steps')
    }
  }, [form.stepsJson])

  // Load existing responses for editing
  useEffect(() => {
    if (mySubmission?.responsesJson) {
      try {
        setResponses(JSON.parse(mySubmission.responsesJson))
      } catch { /* ignore */ }
    }
  }, [mySubmission])

  const updateResponse = (name: string, value: string) => {
    setResponses(prev => ({ ...prev, [name]: value }))
  }

  const currentFields = steps[currentStep]?.fields || []
  const isStepValid = currentFields.every(f => !f.required || responses[f.name]?.trim())

  const handleSubmit = async () => {
    if (!isStepValid) return
    setSubmitting(true)
    try {
      const submissionId = mySubmission?.id
      const res = await fetch(`/api/onboarding/${submissionId || form.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit',
          responsesJson: JSON.stringify(responses),
          ...(submissionId ? {} : { formId: form.id, clientId: userId })
        })
      })
      if (!res.ok) throw new Error()
      toast.success('Onboarding submitted successfully!')
      onBack()
    } catch {
      toast.error('Failed to submit onboarding')
    } finally {
      setSubmitting(false)
    }
  }

  const renderReviewResult = () => {
    if (!mySubmission) return null
    if (mySubmission.status === 'approved') return (
      <div className="flex items-start gap-3 p-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
        <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
        <div>
          <p className="font-medium text-emerald-800 dark:text-emerald-300">Approved</p>
          {mySubmission.reviewNotes && <p className="text-sm text-emerald-700 dark:text-emerald-400 mt-1">{mySubmission.reviewNotes}</p>}
          {mySubmission.reviewedAt && <p className="text-xs text-emerald-600 dark:text-emerald-500 mt-1">Reviewed {formatRelativeTime(mySubmission.reviewedAt)}</p>}
        </div>
      </div>
    )
    if (mySubmission.status === 'rejected') return (
      <div className="flex items-start gap-3 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
        <XCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
        <div>
          <p className="font-medium text-red-800 dark:text-red-300">Needs Revision</p>
          {mySubmission.reviewNotes && <p className="text-sm text-red-700 dark:text-red-400 mt-1">{mySubmission.reviewNotes}</p>}
          {mySubmission.reviewedAt && <p className="text-xs text-red-600 dark:text-red-500 mt-1">Reviewed {formatRelativeTime(mySubmission.reviewedAt)}</p>}
        </div>
      </div>
    )
    if (mySubmission.status === 'submitted') return (
      <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
        <Clock className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
        <div>
          <p className="font-medium text-amber-800 dark:text-amber-300">Under Review</p>
          <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">Your submission is being reviewed by the team.</p>
        </div>
      </div>
    )
    return null
  }

  const renderReadOnlyResponses = () => {
    const allFields = steps.flatMap(s => s.fields)
    return (
      <div className="space-y-4">
        {allFields.map(field => (
          <div key={field.name} className="space-y-1">
            <Label className="text-sm font-medium">{field.label}</Label>
            <div className="p-3 rounded-lg bg-muted/50 border text-sm min-h-[40px]">
              {responses[field.name] || (
                <span className="text-muted-foreground italic">Not provided</span>
              )}
            </div>
          </div>
        ))}
      </div>
    )
  }

  const renderField = (field: StepField) => {
    const value = responses[field.name] || ''
    if (field.type === 'textarea') return (
      <div key={field.name} className="space-y-2">
        <Label htmlFor={field.name}>
          {field.label} {field.required && <span className="text-red-500">*</span>}
        </Label>
        <Textarea
          id={field.name}
          value={value}
          onChange={e => updateResponse(field.name, e.target.value)}
          placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
          rows={3}
        />
      </div>
    )
    if (field.type === 'select') return (
      <div key={field.name} className="space-y-2">
        <Label htmlFor={field.name}>
          {field.label} {field.required && <span className="text-red-500">*</span>}
        </Label>
        <select
          id={field.name}
          value={value}
          onChange={e => updateResponse(field.name, e.target.value)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">Select...</option>
          {field.options?.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>
    )
    return (
      <div key={field.name} className="space-y-2">
        <Label htmlFor={field.name}>
          {field.label} {field.required && <span className="text-red-500">*</span>}
        </Label>
        <Input
          id={field.name}
          type={field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : 'text'}
          value={value}
          onChange={e => updateResponse(field.name, e.target.value)}
          placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
        />
      </div>
    )
  }

  const isLocked = mySubmission?.status === 'approved' || mySubmission?.status === 'submitted'

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold truncate">{form.title}</h1>
          {form.description && (
            <p className="text-sm text-muted-foreground truncate">{form.description}</p>
          )}
        </div>
      </div>

      {form.project && (
        <Badge variant="outline" style={{ borderColor: form.project.color, color: form.project.color }}>
          {form.project.name}
        </Badge>
      )}

      {/* Review result banner */}
      {renderReviewResult()}

      {/* Stepper / Progress */}
      {steps.length > 0 && (
        <>
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {steps.map((step, i) => {
              const isCompleted = i < currentStep
              const isCurrent = i === currentStep
              return (
                <button
                  key={i}
                  onClick={() => !isLocked && i <= currentStep && setCurrentStep(i)}
                  disabled={isLocked || i > currentStep}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                    isCompleted ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                    isCurrent ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                    'bg-muted text-muted-foreground'
                  }`}
                >
                  {isCompleted ? <Check className="w-3.5 h-3.5" /> : <span className="w-5 h-5 rounded-full border-2 flex items-center justify-center text-xs">{i + 1}</span>}
                  {step.title}
                  {i < steps.length - 1 && <ChevronRight className="w-3.5 h-3.5 ml-1 text-muted-foreground" />}
                </button>
              )
            })}
          </div>

          <Progress value={((currentStep + 1) / steps.length) * 100} className="h-2" />
        </>
      )}

      {/* Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          {steps[currentStep] && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{steps[currentStep].title}</CardTitle>
                {steps[currentStep].description && (
                  <p className="text-sm text-muted-foreground">{steps[currentStep].description}</p>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {isLocked ? renderReadOnlyResponses() : currentFields.map(renderField)}
              </CardContent>
            </Card>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation buttons */}
      {!isLocked && steps.length > 0 && (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
            disabled={currentStep === 0}
          >
            <ChevronLeft className="w-4 h-4 mr-1" /> Previous
          </Button>
          <div className="text-sm text-muted-foreground">
            Step {currentStep + 1} of {steps.length}
          </div>
          {currentStep < steps.length - 1 ? (
            <Button onClick={() => setCurrentStep(currentStep + 1)} disabled={!isStepValid}>
              Next <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={!isStepValid || submitting}>
              {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
              Submit
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// CLIENT PROJECTS
// ═══════════════════════════════════════════════════════════════════
export function ClientProjects() {
  const { user } = useAuthStore()
  const [projects, setProjects] = useState<(Project & { tasks?: (Task & { _count: { comments: number; subtasks: number; completedSubtasks: number } })[] })[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null)
  const [expandedTasks, setExpandedTasks] = useState<Task[]>([])
  const [taskDetail, setTaskDetail] = useState<(Task & { _count: { comments: number; subtasks: number; completedSubtasks: number }; comments?: Comment[]; subtasks?: Subtask[] }) | null>(null)
  const [taskDetailLoading, setTaskDetailLoading] = useState(false)

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
                      <div className="flex items-center gap-4 shrink-0 text-sm">
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
                        <span className="text-muted-foreground">
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
export function ClientMessages() {
  const { user } = useAuthStore()
  const [conversations, setConversations] = useState<{
    user: Partial<User> | null
    lastMessage: Message | null
    unread: number
  }[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [msgLoading, setMsgLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const fetchConversations = useCallback(async () => {
    if (!user?.id) return
    try {
      const res = await fetch(`/api/messages?userId=${user.id}`)
      const data = await res.json()
      setConversations(data.conversations || [])
    } catch {
      toast.error('Failed to load conversations')
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => { fetchConversations() }, [fetchConversations])

  const selectConversation = async (otherUserId: string) => {
    if (!user?.id) return
    setSelectedUserId(otherUserId)
    setMsgLoading(true)
    try {
      const res = await fetch(`/api/messages?userId=${user.id}&otherId=${otherUserId}`)
      const data = await res.json()
      setMessages(data.messages || [])
    } catch {
      toast.error('Failed to load messages')
    } finally {
      setMsgLoading(false)
    }
  }

  const sendMessage = async () => {
    if (!newMessage.trim() || !user?.id || !selectedUserId) return
    setSending(true)
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: newMessage.trim(),
          senderId: user.id,
          receiverId: selectedUserId
        })
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setMessages(prev => [...prev, data.message])
      setNewMessage('')
      // Refresh conversations to update last message
      fetchConversations()
    } catch {
      toast.error('Failed to send message')
    } finally {
      setSending(false)
    }
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const selectedUser = conversations.find(c => c.user?.id === selectedUserId)?.user
  const filteredConversations = conversations.filter(c =>
    c.user?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.user?.company?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="h-[calc(100vh-8rem)] flex border rounded-xl overflow-hidden bg-card">
      {/* Sidebar - Conversation List */}
      <div className="w-80 border-r flex flex-col shrink-0 bg-card">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Messages
          </h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search conversations..."
              className="pl-9"
            />
          </div>
        </div>
        <ScrollArea className="flex-1">
          {loading ? (
            <div className="p-3 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="w-10 h-10 rounded-full" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-36" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              {searchQuery ? 'No matching conversations' : 'No conversations yet'}
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {filteredConversations.map(conv => {
                const isSelected = conv.user?.id === selectedUserId
                return (
                  <button
                    key={conv.user?.id}
                    onClick={() => selectConversation(conv.user?.id || '')}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
                      isSelected ? 'bg-accent' : 'hover:bg-muted/50'
                    }`}
                  >
                    <div className="relative shrink-0">
                      <Avatar className="w-10 h-10">
                        <AvatarFallback className="text-xs bg-muted">
                          {getInitials(conv.user?.name || '?')}
                        </AvatarFallback>
                      </Avatar>
                      {conv.unread > 0 && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                          {conv.unread}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm truncate">{conv.user?.name || 'Unknown'}</span>
                        {conv.lastMessage?.createdAt && (
                          <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                            {formatRelativeTime(conv.lastMessage.createdAt)}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {conv.user?.company && <span className="mr-1">{conv.user.company}</span>}
                        {conv.lastMessage?.content || 'No messages yet'}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedUserId && selectedUser ? (
          <>
            {/* Chat header */}
            <div className="p-4 border-b flex items-center gap-3">
              <Avatar className="w-9 h-9">
                <AvatarFallback className="text-xs bg-muted">
                  {getInitials(selectedUser.name || '?')}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="font-semibold text-sm">{selectedUser.name}</p>
                {selectedUser.company && (
                  <p className="text-xs text-muted-foreground">{selectedUser.company}</p>
                )}
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${getRoleBadgeClasses(selectedUser.role || '')}`}>
                {selectedUser.role || 'user'}
              </span>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              {msgLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className={`flex gap-3 ${i % 2 === 0 ? '' : 'justify-end'}`}>
                      <Skeleton className="h-10 w-48 rounded-2xl" />
                    </div>
                  ))}
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <MessageSquare className="w-10 h-10 text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">Start a conversation</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {messages.map(msg => {
                    const isMine = msg.senderId === user?.id
                    return (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex gap-2.5 ${isMine ? 'justify-end' : 'justify-start'}`}
                      >
                        {!isMine && (
                          <Avatar className="w-8 h-8 shrink-0 mt-auto">
                            <AvatarFallback className="text-[10px] bg-muted">
                              {getInitials(msg.sender?.name || '?')}
                            </AvatarFallback>
                          </Avatar>
                        )}
                        <div className={`max-w-[70%] ${isMine ? 'items-end' : 'items-start'}`}>
                          <div className={`px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap break-words ${
                            isMine
                              ? 'bg-emerald-600 text-white rounded-br-md'
                              : 'bg-muted rounded-bl-md'
                          }`}>
                            {msg.content}
                          </div>
                          <div className={`flex items-center gap-1 mt-1 text-[10px] text-muted-foreground ${isMine ? 'justify-end' : 'justify-start'}`}>
                            {formatRelativeTime(msg.createdAt)}
                            {isMine && msg.read && <CheckCheck className="w-3 h-3" />}
                          </div>
                        </div>
                      </motion.div>
                    )
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            {/* Input */}
            <div className="p-4 border-t">
              <div className="flex gap-2">
                <Input
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                  className="flex-1"
                />
                <Button onClick={sendMessage} disabled={!newMessage.trim() || sending} size="icon">
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-1">Select a conversation</h3>
              <p className="text-sm text-muted-foreground">Choose a conversation from the sidebar to start messaging</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

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