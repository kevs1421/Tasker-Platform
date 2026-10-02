'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '@/stores/auth'
import { authFetch } from '@/lib/client-fetch'
import { useTimeTrackingStore } from '@/stores/time-tracking'
import type { DashboardStats, ActivityLog, Project, Task, OnboardingForm, Onboarding, User, ProjectMember, Comment as CommentType } from '@/types'
import { getRoleBadgeClasses, getInitials, getPriorityConfig, getStatusConfig, formatDate, formatRelativeTime } from '@/features/route-guard'
import { cn } from '@/lib/utils'
import { formatDuration, formatElapsed } from '@/lib/format'
import { ProfileAvatarUpload } from '@/components/profile-avatar-upload'

// shadcn/ui
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

// recharts
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts'

// date-fns
import { format } from 'date-fns'

// icons
import {
  FileCheck, FileText, FolderKanban, ListTodo,
  CheckCircle2, Clock, AlertTriangle, Users, Briefcase, TrendingUp,
  Plus, Trash2, Eye, ChevronDown, Check,
  Search, ArrowUpRight, CircleDot,
  MessageCircle, ThumbsUp, ThumbsDown, Shield, CalendarIcon,
  UserPlus, UserCog, MoreHorizontal, X, Loader2, ClipboardList, Pencil,
  KeyRound, Download, Save, FileArchive, GraduationCap,
  ImageIcon, Building2, Palette, Rocket, ExternalLink
} from 'lucide-react'

import { toast } from 'sonner'
import { motion } from 'framer-motion'

// ─── Animation Variants ───────────────────────────────────────────────────────

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.2 }
}

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.05 } }
}

// ─── Shared: Action Icon Helper ────────────────────────────────────────────────

function ActivityIcon({ action }: { action: string }) {
  if (action.includes('created')) return <Plus className="h-4 w-4 text-emerald-500" />
  if (action.includes('completed') || action.includes('done')) return <CheckCircle2 className="h-4 w-4 text-emerald-500" />
  if (action.includes('moved') || action.includes('updated')) return <ArrowUpRight className="h-4 w-4 text-amber-500" />
  if (action.includes('deleted') || action.includes('removed')) return <Trash2 className="h-4 w-4 text-rose-500" />
  if (action.includes('comment')) return <MessageCircle className="h-4 w-4 text-slate-500" />
  if (action.includes('onboarding')) return <FileCheck className="h-4 w-4 text-purple-500" />
  return <CircleDot className="h-4 w-4 text-slate-400" />
}

// ─── AdminOverview ─────────────────────────────────────────────────────────────

export function AdminOverview() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [activities, setActivities] = useState<ActivityLog[]>([])
  const [pendingOnboarding, setPendingOnboarding] = useState(0)

  useEffect(() => {
    async function fetchData() {
      try {
        const [statsRes, actRes] = await Promise.all([
          authFetch('/api/admin'),
          authFetch('/api/admin/activity')
        ])
        if (!statsRes.ok || !actRes.ok) throw new Error('Failed')
        const statsData = await statsRes.json()
        const actData = await actRes.json()
        setStats(statsData.stats)
        setActivities(actData.activities?.slice(0, 8) ?? [])
        setPendingOnboarding(actData.pendingOnboarding ?? 0)
      } catch {
        toast.error('Failed to load dashboard data')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const chartData = stats ? [
    { name: 'To Do', count: stats.todoTasks, fill: '#94a3b8' },
    { name: 'In Progress', count: stats.inProgressTasks, fill: '#3b82f6' },
    { name: 'In Review', count: stats.inReviewTasks, fill: '#a855f7' },
    { name: 'Done', count: stats.completedTasks, fill: '#10b981' },
  ] : []

  if (loading) return <OverviewSkeleton />

  if (!stats) return <p className="text-muted-foreground">No data available.</p>

  const mainCards = [
    { label: 'Total Tasks', value: stats.totalTasks, sub: `${stats.completedTasks} completed`, icon: ListTodo, color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'Active Projects', value: stats.activeProjects, sub: `${stats.totalProjects} total`, icon: FolderKanban, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
    { label: 'Team Members', value: stats.totalMembers, sub: 'Internal team', icon: Users, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/30' },
    { label: 'Total Clients', value: stats.totalClients, sub: 'External users', icon: Briefcase, color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-100 dark:bg-rose-900/30' },
  ]

  const smallCards = [
    { label: 'In Progress', value: stats.inProgressTasks, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20' },
    { label: 'Overdue', value: stats.overdueTasks, icon: AlertTriangle, color: 'text-rose-600', bg: 'bg-rose-50 dark:bg-rose-900/20' },
    { label: 'This Week', value: stats.thisWeekCompleted, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
    { label: 'Pending Onboarding', value: pendingOnboarding, icon: FileCheck, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20' },
  ]

  return (
    <motion.div {...staggerContainer} initial="initial" animate="animate" className="space-y-6">
      {/* Main stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {mainCards.map((c) => (
          <motion.div key={c.label} {...fadeIn}>
            <Card className="relative overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">{c.label}</p>
                    <p className="text-2xl font-bold">{c.value}</p>
                    <p className="text-xs text-muted-foreground">{c.sub}</p>
                  </div>
                  <div className={`h-10 w-10 rounded-lg ${c.bg} flex items-center justify-center`}>
                    <c.icon className={`h-5 w-5 ${c.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Smaller stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {smallCards.map((c) => (
          <motion.div key={c.label} {...fadeIn}>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`h-8 w-8 rounded-md ${c.bg} flex items-center justify-center`}>
                    <c.icon className={`h-4 w-4 ${c.color}`} />
                  </div>
                  <div>
                    <p className="text-lg font-semibold">{c.value}</p>
                    <p className="text-xs text-muted-foreground">{c.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Chart + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Bar Chart */}
        <motion.div {...fadeIn} className="lg:col-span-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Task Distribution</CardTitle>
              <CardDescription>Breakdown by current status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <RechartsTooltip
                      contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--popover))', color: 'hsl(var(--popover-foreground))' }}
                    />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell key={index} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent Activity */}
        <motion.div {...fadeIn} className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Recent Activity</CardTitle>
              <CardDescription>Latest actions across the platform</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-64 px-4">
                <div className="space-y-4 py-2">
                  {activities.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">No recent activity</p>}
                  {activities.map((act) => (
                    <div key={act.id} className="flex items-start gap-3">
                      <Avatar className="h-8 w-8 mt-0.5">
                        {act.user?.avatar ? <AvatarImage src={act.user.avatar} alt={act.user.name} /> : null}
                        <AvatarFallback className="text-xs bg-slate-100 dark:bg-slate-800">
                          {act.user ? getInitials(act.user.name) : '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">{act.user?.name ?? 'System'}</span>
                          <ActivityIcon action={act.action} />
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{act.details ?? act.action}</p>
                        <p className="text-xs text-muted-foreground/60 mt-0.5">{formatRelativeTime(act.createdAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  )
}

function OverviewSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}><CardContent className="p-4"><Skeleton className="h-20 w-full" /></CardContent></Card>
        ))}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}><CardContent className="p-4"><Skeleton className="h-12 w-full" /></CardContent></Card>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <Card className="lg:col-span-3"><CardContent className="p-6"><Skeleton className="h-64 w-full" /></CardContent></Card>
        <Card className="lg:col-span-2"><CardContent className="p-6"><Skeleton className="h-64 w-full" /></CardContent></Card>
      </div>
    </div>
  )
}

// ─── AdminOnboarding ───────────────────────────────────────────────────────────

function getOnboardingBadge(status: string) {
  switch (status) {
    case 'in_progress': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
    case 'submitted': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
    case 'approved': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
    case 'rejected': return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
    case 'draft': return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
    case 'published': return 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400'
    default: return 'bg-slate-100 text-slate-700'
  }
}

function getOnboardingStatusLabel(status: string) {
  const map: Record<string, string> = { in_progress: 'In Progress', submitted: 'Submitted', approved: 'Approved', rejected: 'Rejected', draft: 'Draft', published: 'Published', archived: 'Archived' }
  return map[status] || status
}

const ONBOARDING_STEPS_CONFIG = [
  { id: 'business_info', label: 'Business Information', description: 'Company details, contact info, industry', required: true },
  { id: 'brand_assets', label: 'Brand Assets', description: 'Logo, brand colors, typography, guidelines', required: true },
  { id: 'project_kickoff', label: 'Project Kickoff', description: 'Goals, audience, competitors, budget, timeline', required: true },
  { id: 'documents', label: 'Document Submission', description: 'Contract, payment form, work order agreement', required: true },
]

export function AdminOnboarding() {
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [forms, setForms] = useState<OnboardingForm[]>([])
  const [selectedForm, setSelectedForm] = useState<(OnboardingForm & { submissions: Onboarding[] }) | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [reviewing, setReviewing] = useState<string | null>(null)
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({})

  // Create onboarding form state
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [projects, setProjects] = useState<Project[]>([])
  const [clients, setClients] = useState<User[]>([])
  const [createForm, setCreateForm] = useState({
    title: '',
    description: '',
    projectId: '',
    clientId: '',
    selectedSteps: ['business_info', 'brand_assets', 'project_kickoff', 'documents'],
  })
  // Edit onboarding form state
  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editFormId, setEditFormId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    projectId: '',
    clientId: '',
    selectedSteps: [] as string[],
  })

  const fetchForms = useCallback(async () => {
    try {
      const res = await authFetch('/api/onboarding')
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setForms(data.forms ?? [])
    } catch {
      toast.error('Failed to load onboarding forms')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchProjects = useCallback(async () => {
    try {
      const res = await authFetch('/api/projects')
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setProjects(data.projects ?? [])
    } catch {
      toast.error('Failed to load projects')
    }
  }, [])

  const fetchClients = useCallback(async () => {
    try {
      const res = await authFetch('/api/users')
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setClients((data.users ?? []).filter((u: User) => u.role === 'client' && u.status === 'active'))
    } catch {
      toast.error('Failed to load clients')
    }
  }, [])

  useEffect(() => {
    fetchForms()
    fetchProjects()
    fetchClients()
  }, [fetchForms, fetchProjects, fetchClients])

  async function openForm(form: OnboardingForm) {
    try {
      const res = await authFetch(`/api/onboarding/${form.id}`)
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setSelectedForm(data.form)
      setDialogOpen(true)
    } catch {
      toast.error('Failed to load form details')
    }
  }

  async function handleCreateOnboarding() {
    if (!user || !createForm.title.trim() || !createForm.projectId) return
    setCreating(true)
    try {
      const stepsJson = JSON.stringify(
        createForm.selectedSteps.map(stepId => {
          const config = ONBOARDING_STEPS_CONFIG.find(s => s.id === stepId)
          return { id: stepId, label: config?.label ?? stepId, description: config?.description ?? '', required: config?.required ?? false }
        })
      )
      const res = await authFetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: createForm.title.trim(),
          description: createForm.description.trim() || null,
          stepsJson,
          projectId: createForm.projectId,
          clientId: createForm.clientId || null,
          status: 'published',
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Failed to create')
      }
      toast.success('Onboarding form created successfully')
      setCreateOpen(false)
      setCreateForm({ title: '', description: '', projectId: '', clientId: '', selectedSteps: ['business_info', 'brand_assets', 'project_kickoff', 'documents'] })
      fetchForms()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to create onboarding form')
    } finally {
      setCreating(false)
    }
  }

  async function handleReview(submissionId: string, status: 'approved' | 'rejected') {
    if (!user) return
    setReviewing(submissionId)
    try {
      const notes = reviewNotes[submissionId] || ''
      const patchRes = await authFetch(`/api/onboarding/${submissionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'review', reviewStatus: status, reviewNotes: notes, reviewedBy: user.id })
      })
      if (!patchRes.ok) {
        const d = await patchRes.json()
        throw new Error(d.error)
      }
      toast.success(`Submission ${status === 'approved' ? 'approved' : 'rejected'} successfully`)
      // Refresh
      if (selectedForm) {
        const fresh = await authFetch(`/api/onboarding/${selectedForm.id}`)
        if (fresh.ok) {
          const data = await fresh.json()
          setSelectedForm(data.form)
        }
      }
      fetchForms()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to review')
    } finally {
      setReviewing(null)
    }
  }

  async function handleDeleteForm(formId: string, formTitle: string) {
    try {
      const res = await authFetch(`/api/onboarding/${formId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error()
      toast.success(`"${formTitle}" deleted`)
      setForms(prev => prev.filter(f => f.id !== formId))
    } catch {
      toast.error('Failed to delete onboarding form')
    }
  }

  function openEditDialog(form: OnboardingForm) {
    let steps: string[] = []
    if (form.stepsJson) {
      try {
        steps = (JSON.parse(form.stepsJson) as { id: string }[]).map(s => s.id)
      } catch {
        toast.error('Failed to parse form steps data')
        return
      }
    }
    setEditFormId(form.id)
    setEditForm({
      title: form.title,
      description: form.description ?? '',
      projectId: form.projectId,
      clientId: form.clientId ?? '',
      selectedSteps: steps.length > 0 ? steps : ['business_info', 'brand_assets', 'project_kickoff', 'documents'],
    })
    setEditOpen(true)
  }

  async function handleEditOnboarding() {
    if (!editFormId || !editForm.title.trim() || !editForm.projectId) return
    setEditing(true)
    try {
      const stepsJson = JSON.stringify(
        editForm.selectedSteps.map(stepId => {
          const config = ONBOARDING_STEPS_CONFIG.find(s => s.id === stepId)
          return { id: stepId, label: config?.label ?? stepId, description: config?.description ?? '', required: config?.required ?? false }
        })
      )
      const res = await authFetch(`/api/onboarding/${editFormId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editForm.title.trim(),
          description: editForm.description.trim() || null,
          stepsJson,
          projectId: editForm.projectId,
          clientId: editForm.clientId && editForm.clientId !== '_none' ? editForm.clientId : null,
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Failed to update')
      }
      toast.success('Onboarding form updated successfully')
      setEditOpen(false)
      setEditFormId(null)
      fetchForms()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to update onboarding form')
    } finally {
      setEditing(false)
    }
  }

  const toggleStep = (stepId: string) => {
    setCreateForm(prev => ({
      ...prev,
      selectedSteps: prev.selectedSteps.includes(stepId)
        ? prev.selectedSteps.filter(s => s !== stepId)
        : [...prev.selectedSteps, stepId],
    }))
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Card><CardContent className="p-4"><Skeleton className="h-64 w-full" /></CardContent></Card>
      </div>
    )
  }

  return (
    <motion.div {...fadeIn} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Onboarding Management</h2>
          <p className="text-sm text-muted-foreground">Create and manage client onboarding forms</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="bg-primary hover:bg-primary/90 text-primary-foreground">
          <Plus className="h-4 w-4 mr-2" /> Create Onboarding
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Forms', value: forms.length, color: 'text-slate-600', bg: 'bg-slate-100 dark:bg-slate-800' },
          { label: 'Published', value: forms.filter(f => f.status === 'published').length, color: 'text-emerald-600', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
          { label: 'Drafts', value: forms.filter(f => f.status === 'draft').length, color: 'text-amber-600', bg: 'bg-amber-100 dark:bg-amber-900/30' },
          { label: 'Pending Review', value: forms.reduce((acc, f) => acc + (f._count?.submissions ?? 0), 0), color: 'text-purple-600', bg: 'bg-purple-100 dark:bg-purple-900/30' },
        ].map((c) => (
          <Card key={c.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`h-8 w-8 rounded-md ${c.bg} flex items-center justify-center`}>
                  <FileCheck className={`h-4 w-4 ${c.color}`} />
                </div>
                <div>
                  <p className="text-lg font-semibold">{c.value}</p>
                  <p className="text-xs text-muted-foreground">{c.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Onboarding Forms Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Form Title</TableHead>
                <TableHead>Project</TableHead>
                <TableHead className="hidden md:table-cell">Client Owner</TableHead>
                <TableHead className="text-center">Submissions</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-28"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {forms.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                    <div className="flex flex-col items-center gap-2">
                      <ClipboardList className="h-8 w-8 text-muted-foreground/50" />
                      <p>No onboarding forms yet</p>
                      <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)} className="mt-2">
                        <Plus className="h-4 w-4 mr-1" /> Create your first form
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {forms.map((form) => {
                const project = form.project as { color?: string; name?: string } | undefined
                return (
                  <TableRow key={form.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openForm(form)}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                          <ClipboardList className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{form.title}</p>
                          {form.description && <p className="text-xs text-muted-foreground truncate max-w-48">{form.description}</p>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {project?.color && <div className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: project.color }} />}
                        <span className="text-sm text-muted-foreground">{project?.name ?? '—'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {form.client ? (
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                              {getInitials(form.client.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{form.client.name}</p>
                            {form.client.company && <p className="text-xs text-muted-foreground truncate">{form.client.company}</p>}
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {(form._count?.submissions ?? 0) > 0 && (
                        <Badge variant="secondary" className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {form._count?.submissions}
                        </Badge>
                      )}
                      {(form._count?.submissions ?? 0) === 0 && <span className="text-muted-foreground text-sm">0</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={getOnboardingBadge(form.status)}>
                        {getOnboardingStatusLabel(form.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openForm(form)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(form)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Edit Form</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Onboarding Form</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete &quot;{form.title}&quot;? This will also delete all associated submissions. This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteForm(form.id, form.title)} className="bg-rose-600 hover:bg-rose-700">
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Submissions Review Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col gap-0 p-0">
          <DialogHeader className="shrink-0 px-6 pt-6 pb-2">
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-amber-500" />
              {selectedForm?.title ?? 'Form'}
            </DialogTitle>
            <DialogDescription>
              <div className="flex items-center gap-2">
                {selectedForm?.project ? (
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: (selectedForm.project as { color?: string }).color }} />
                    {(selectedForm.project as { name?: string }).name}
                  </span>
                ) : 'Project'}
                <span className="text-muted-foreground">•</span>
                <span>{selectedForm?.submissions?.length ?? 0} submission{(selectedForm?.submissions?.length ?? 0) !== 1 ? 's' : ''}</span>
              </div>
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 min-h-0 px-6 pb-6">
            <div className="space-y-5 py-2">
              {selectedForm?.submissions?.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mb-3">
                    <FileCheck className="h-7 w-7 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium">No submissions yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Client submissions will appear here once they complete the form.</p>
                </div>
              )}
              {selectedForm?.submissions?.map((sub) => {
                let parsedResponses: Record<string, string> = {}
                let parsedFiles: Record<string, { url: string; originalName: string; filename: string; size: number; type: string } | null> = {}
                try {
                  const raw = JSON.parse(sub.responsesJson)
                  parsedResponses = raw.responses || {}
                  parsedFiles = raw.files || {}
                } catch { /* old format fallback */ }

                const fmtSz = (b: number) => {
                  if (b < 1024) return b + ' B'
                  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB'
                  return (b / 1048576).toFixed(1) + ' MB'
                }

                const stepCfg = [
                  { id: 'biz', label: 'Business Information', icon: Building2, clr: 'text-slate-600 dark:text-slate-400',
                    fields: [{ k: 'businessName', l: 'Business Name' }, { k: 'businessEmail', l: 'Business Email' }, { k: 'businessPhone', l: 'Business Phone' }, { k: 'businessAddress', l: 'Business Address' }, { k: 'industry', l: 'Industry' }, { k: 'companySize', l: 'Company Size' }], fks: [] },
                  { id: 'brand', label: 'Brand Assets', icon: Palette, clr: 'text-pink-600 dark:text-pink-400',
                    fields: [{ k: 'brandColors', l: 'Brand Colors' }, { k: 'typography', l: 'Typography / Fonts' }],
                    fks: [{ k: 'companyLogo', l: 'Company Logo', img: true }, { k: 'brandGuidelines', l: 'Brand Guidelines' }] },
                  { id: 'kick', label: 'Project Kickoff', icon: Rocket, clr: 'text-amber-600 dark:text-amber-400',
                    fields: [{ k: 'projectGoals', l: 'Project Goals' }, { k: 'targetAudience', l: 'Target Audience' }, { k: 'mainCompetitors', l: 'Main Competitors' }, { k: 'budgetRange', l: 'Budget Range' }, { k: 'expectedTimeline', l: 'Expected Timeline' }], fks: [] },
                  { id: 'docs', label: 'Document Submission', icon: FileText, clr: 'text-emerald-600 dark:text-emerald-400',
                    fields: [],
                    fks: [{ k: 'contractForm', l: 'Contract Form' }, { k: 'paymentForm', l: 'Payment Form' }, { k: 'workOrderAgreement', l: 'Work Order Agreement' }] },
                ]

                return (
                  <div key={sub.id} className="space-y-4">
                    {/* Client header card */}
                    <Card className="border"><CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            {sub.client?.avatar ? <AvatarImage src={sub.client.avatar} /> : null}
                            <AvatarFallback className="text-sm font-medium">{sub.client ? getInitials(sub.client.name) : '?'}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-semibold">{sub.client?.name ?? 'Unknown'}</p>
                            <p className="text-xs text-muted-foreground">{sub.client?.company ?? sub.client?.email ?? 'No company'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {sub.submittedAt && <span className="text-xs text-muted-foreground hidden sm:inline">{formatDate(sub.submittedAt)}</span>}
                          <Badge variant="secondary" className={getOnboardingBadge(sub.status)}>{getOnboardingStatusLabel(sub.status)}</Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-3 flex-wrap">
                        <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs" onClick={() => { const token = localStorage.getItem('taskflow-token'); window.open('/api/onboarding/download?submissionId=' + sub.id + (token ? '&token=' + token : ''), '_blank') }}>
                          <Download className="h-3.5 w-3.5" /> Download Report
                        </Button>
                        {Object.entries(parsedFiles).filter(([, f]) => f).length > 0 && (
                          <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs border-primary/30 text-primary hover:bg-primary/5" onClick={() => { const token = localStorage.getItem('taskflow-token'); window.open('/api/onboarding/download-documents?submissionId=' + sub.id + (token ? '&token=' + token : ''), '_blank') }}>
                            <FileArchive className="h-3.5 w-3.5" /> Download All Documents
                          </Button>
                        )}
                      </div>
                    </CardContent></Card>

                    {/* Step-by-step organized data */}
                    {stepCfg.map((st, si) => {
                      const SI = st.icon
                      const hasContent = st.fields.some(f => parsedResponses[f.k]?.trim()) || st.fks.some(f => parsedFiles[f.k])
                      if (!hasContent) return null
                      return (
                        <Card key={st.id} className="border">
                          <CardHeader className="pb-2 pt-3 px-4">
                            <CardTitle className="text-sm font-semibold flex items-center gap-2">
                              <div className="h-7 w-7 rounded-md bg-muted flex items-center justify-center">
                                <SI className={'h-3.5 w-3.5 ' + st.clr} />
                              </div>
                              <span className="flex items-center gap-2">
                                {st.label}
                                <span className="text-[10px] text-muted-foreground font-normal bg-muted px-1.5 py-0.5 rounded">Step {si + 1}</span>
                              </span>
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="px-4 pb-4 space-y-3">
                            {st.fks.map((fc: { k: string; l: string; img?: boolean }) => {
                              const f = parsedFiles[fc.k]
                              if (!f) return null
                              const isImg = fc.img && f.type?.startsWith('image/')
                              return (
                                <div key={fc.k} className="space-y-1.5">
                                  <p className="text-xs font-medium text-muted-foreground">{fc.l}</p>
                                  {isImg ? (
                                    <a href={f.url} target="_blank" rel="noopener noreferrer" className="inline-block group">
                                      <div className="w-24 h-24 rounded-lg border bg-muted/30 overflow-hidden hover:ring-2 hover:ring-primary/30 transition-all">
                                        <img src={f.url} alt={f.originalName} className="w-full h-full object-contain p-1" />
                                      </div>
                                      <div className="flex items-center gap-1.5 mt-1.5">
                                        <ImageIcon className="h-3 w-3 text-muted-foreground" />
                                        <span className="text-xs text-muted-foreground group-hover:text-primary transition-colors truncate max-w-[180px]">{f.originalName}</span>
                                        <span className="text-[10px] text-muted-foreground">({fmtSz(f.size)})</span>
                                      </div>
                                    </a>
                                  ) : (
                                    <a href={f.url} download={f.originalName} target="_blank" rel="noopener noreferrer"
                                      className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors group">
                                      <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                                        <FileText className="h-4 w-4 text-primary" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{f.originalName}</p>
                                        <p className="text-[11px] text-muted-foreground">{fmtSz(f.size)} • {f.type?.split('/').pop()?.toUpperCase()}</p>
                                      </div>
                                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                                    </a>
                                  )}
                                </div>
                              )
                            })}
                            {st.fields.length > 0 && (
                              <div className={cn('grid gap-2.5', st.id === 'kick' ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2')}>
                                {st.fields.map((fd: { k: string; l: string }) => {
                                  const v = parsedResponses[fd.k]?.trim()
                                  if (!v) return null
                                  return (
                                    <div key={fd.k} className="p-3 rounded-lg bg-muted/50 border">
                                      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">{fd.l}</p>
                                      <p className="text-sm whitespace-pre-wrap">{v}</p>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      )
                    })}

                    {/* Review notes */}
                    {sub.reviewNotes && (
                      <div className="bg-muted/50 rounded-lg p-3 text-sm">
                        <span className="font-medium">Review notes:</span> {sub.reviewNotes}
                        {sub.reviewer && <span className="text-muted-foreground"> — by {sub.reviewer.name}</span>}
                      </div>
                    )}

                    {/* Review actions */}
                    {sub.status === 'submitted' && (
                      <Card className="border-dashed border-primary/30 bg-primary/[0.02]">
                        <CardContent className="p-4 space-y-3">
                          <p className="text-sm font-medium">Review this submission</p>
                          <Textarea placeholder="Add review notes (optional)..." value={reviewNotes[sub.id] ?? ''} onChange={(e) => setReviewNotes(prev => ({ ...prev, [sub.id]: e.target.value }))} className="text-sm" rows={2} />
                          <div className="flex gap-2">
                            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handleReview(sub.id, 'approved')} disabled={reviewing === sub.id}>
                              {reviewing === sub.id ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <ThumbsUp className="h-3.5 w-3.5 mr-1" />} Approve
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => handleReview(sub.id, 'rejected')} disabled={reviewing === sub.id}>
                              {reviewing === sub.id ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <ThumbsDown className="h-3.5 w-3.5 mr-1" />} Reject
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Create Onboarding Form Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-hidden flex flex-col gap-0 p-0">
          <DialogHeader className="shrink-0 px-6 pt-6 pb-2">
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-emerald-600" /> Create Onboarding Form
            </DialogTitle>
            <DialogDescription>Set up a new client onboarding form linked to a project</DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 min-h-0 px-6">
          <div className="space-y-5 py-2">
            {/* Title */}
            <div className="space-y-1.5">
              <Label className="text-sm">Form Title <span className="text-red-500">*</span></Label>
              <Input
                placeholder="e.g., Client Onboarding Package"
                value={createForm.title}
                onChange={(e) => setCreateForm(p => ({ ...p, title: e.target.value }))}
                autoFocus
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label className="text-sm">Description</Label>
              <Textarea
                placeholder="Brief description of this onboarding form (optional)"
                value={createForm.description}
                onChange={(e) => setCreateForm(p => ({ ...p, description: e.target.value }))}
                rows={2}
              />
            </div>

            {/* Project Selection */}
            <div className="space-y-1.5">
              <Label className="text-sm">Project <span className="text-red-500">*</span></Label>
              <Select value={createForm.projectId} onValueChange={(v) => setCreateForm(p => ({ ...p, projectId: v }))}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.length === 0 && <SelectItem value="_none" disabled>No projects available</SelectItem>}
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <span className="flex items-center gap-2">
                        <span className="inline-block h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                        {p.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">The onboarding form will be linked to this project</p>
            </div>

            {/* Client Owner Selection */}
            <div className="space-y-1.5">
              <Label className="text-sm">Client Owner <span className="text-red-500">*</span></Label>
              <Select value={createForm.clientId} onValueChange={(v) => setCreateForm(p => ({ ...p, clientId: v }))}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.length === 0 && <SelectItem value="_none" disabled>No active clients available</SelectItem>}
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="flex items-center gap-2">
                        <span className="inline-block h-5 w-5 rounded-full bg-primary/10 text-primary text-[10px] flex items-center justify-center font-medium">
                          {getInitials(c.name)}
                        </span>
                        <span>{c.name}</span>
                        {c.company && <span className="text-muted-foreground text-xs">({c.company})</span>}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Only this client will see and fill out this onboarding form</p>
            </div>

            <Separator />

            {/* Step Selection */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Onboarding Steps</Label>
                <Badge variant="secondary" className="text-xs">
                  {createForm.selectedSteps.length} / {ONBOARDING_STEPS_CONFIG.length} selected
                </Badge>
              </div>

              <p className="text-xs text-muted-foreground">Choose which steps to include in the onboarding form</p>

              <div className="space-y-2">
                {ONBOARDING_STEPS_CONFIG.map((step) => {
                  const isSelected = createForm.selectedSteps.includes(step.id)
                  return (
                    <button
                      key={step.id}
                      type="button"
                      onClick={() => toggleStep(step.id)}
                      className={cn(
                        'w-full text-left p-3 rounded-lg border-2 transition-all duration-150',
                        isSelected
                          ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/10'
                          : 'border-transparent bg-muted/50 hover:bg-muted'
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          'mt-0.5 h-5 w-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors',
                          isSelected ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-muted-foreground/30'
                        )}>
                          {isSelected && <Check className="h-3.5 w-3.5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">{step.label}</p>
                            {step.required && (
                              <span className="text-[10px] text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 px-1.5 py-0.5 rounded">Required</span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
          </ScrollArea>

          <DialogFooter className="shrink-0 px-6 pb-6 pt-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              onClick={handleCreateOnboarding}
              disabled={!createForm.title.trim() || !createForm.projectId || !createForm.clientId || createForm.selectedSteps.length === 0 || creating}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <ClipboardList className="h-4 w-4 mr-2" />
              Create Form
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Onboarding Form Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-hidden flex flex-col gap-0 p-0">
          <DialogHeader className="shrink-0 px-6 pt-6 pb-2">
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-primary" /> Edit Onboarding Form
            </DialogTitle>
            <DialogDescription>Update the onboarding form details</DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 min-h-0 px-6">
          <div className="space-y-5 py-2">
            {/* Title */}
            <div className="space-y-1.5">
              <Label className="text-sm">Form Title <span className="text-red-500">*</span></Label>
              <Input
                placeholder="e.g., Client Onboarding Package"
                value={editForm.title}
                onChange={(e) => setEditForm(p => ({ ...p, title: e.target.value }))}
                autoFocus
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label className="text-sm">Description</Label>
              <Textarea
                placeholder="Brief description of this onboarding form (optional)"
                value={editForm.description}
                onChange={(e) => setEditForm(p => ({ ...p, description: e.target.value }))}
                rows={2}
              />
            </div>

            {/* Project Selection */}
            <div className="space-y-1.5">
              <Label className="text-sm">Project <span className="text-red-500">*</span></Label>
              <Select value={editForm.projectId} onValueChange={(v) => setEditForm(p => ({ ...p, projectId: v }))}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.length === 0 && <SelectItem value="_none" disabled>No projects available</SelectItem>}
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <span className="flex items-center gap-2">
                        <span className="inline-block h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                        {p.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Client Owner Selection */}
            <div className="space-y-1.5">
              <Label className="text-sm">Client Owner</Label>
              <Select value={editForm.clientId} onValueChange={(v) => setEditForm(p => ({ ...p, clientId: v }))}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a client" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">No client assigned</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="flex items-center gap-2">
                        <span className="inline-block h-5 w-5 rounded-full bg-primary/10 text-primary text-[10px] flex items-center justify-center font-medium">
                          {getInitials(c.name)}
                        </span>
                        <span>{c.name}</span>
                        {c.company && <span className="text-muted-foreground text-xs">({c.company})</span>}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Step Selection */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Onboarding Steps</Label>
                <Badge variant="secondary" className="text-xs">
                  {editForm.selectedSteps.length} / {ONBOARDING_STEPS_CONFIG.length} selected
                </Badge>
              </div>

              <div className="space-y-2">
                {ONBOARDING_STEPS_CONFIG.map((step) => {
                  const isSelected = editForm.selectedSteps.includes(step.id)
                  return (
                    <button
                      key={step.id}
                      type="button"
                      onClick={() => setEditForm(prev => ({
                        ...prev,
                        selectedSteps: prev.selectedSteps.includes(step.id)
                          ? prev.selectedSteps.filter(s => s !== step.id)
                          : [...prev.selectedSteps, step.id],
                      }))}
                      className={cn(
                        'w-full text-left p-3 rounded-lg border-2 transition-all duration-150',
                        isSelected
                          ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/10'
                          : 'border-transparent bg-muted/50 hover:bg-muted'
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          'mt-0.5 h-5 w-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors',
                          isSelected ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-muted-foreground/30'
                        )}>
                          {isSelected && <Check className="h-3.5 w-3.5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">{step.label}</p>
                            {step.required && (
                              <span className="text-[10px] text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 px-1.5 py-0.5 rounded">Required</span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
          </ScrollArea>

          <DialogFooter className="shrink-0 px-6 pb-6 pt-2">
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button
              onClick={handleEditOnboarding}
              disabled={!editForm.title.trim() || !editForm.projectId || editForm.selectedSteps.length === 0 || editing}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {editing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Pencil className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}

// ─── AdminProjects ─────────────────────────────────────────────────────────────

const PRESET_COLORS = ['#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#6366f1', '#14b8a6', '#e11d48']

export function AdminProjects() {
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [projects, setProjects] = useState<Project[]>([])
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', priority: 'medium', dueDate: null as Date | null, color: PRESET_COLORS[0] })
  const [activeUsers, setActiveUsers] = useState<User[]>([])
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([])
   // Manage members dialog
  const [manageMembersOpen, setManageMembersOpen] = useState(false)
  const [manageProjectId, setManageProjectId] = useState<string>('')
  const [manageProjectName, setManageProjectName] = useState('')
  const [projectMembers, setProjectMembers] = useState<(ProjectMember & { user: User })[]>([])
  const [membersLoading, setMembersLoading] = useState(false)

  const fetchProjects = useCallback(async () => {
    try {
      const res = await authFetch('/api/projects')
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setProjects(data.projects ?? [])
    } catch {
      toast.error('Failed to load projects')
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch active admin + team users for member picker
  useEffect(() => {
    authFetch('/api/users')
      .then(r => {
        if (!r.ok) throw new Error('Failed')
        return r.json()
      })
      .then(d => {
        const users = (d.users || []).filter((u: User) => (u.role === 'admin' || u.role === 'team' || u.role === 'training') && u.status === 'active')
        setActiveUsers(users)
      })
      .catch(() => {})
  }, [])

  useEffect(() => { fetchProjects() }, [fetchProjects])

  async function handleCreate() {
    if (!user || !form.name.trim()) return
    setCreating(true)
    try {
      const createRes = await authFetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          description: form.description || null,
          priority: form.priority,
          dueDate: form.dueDate ? form.dueDate.toISOString() : null,
          color: form.color,
          createdBy: user.id,
          memberIds: selectedMemberIds
        })
      })
      if (!createRes.ok) {
        const d = await createRes.json()
        throw new Error(d.error)
      }
      toast.success('Project created successfully')
      setCreateOpen(false)
      setForm({ name: '', description: '', priority: 'medium', dueDate: null, color: PRESET_COLORS[0] })
      setSelectedMemberIds([])
      fetchProjects()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to create project')
    } finally {
      setCreating(false)
    }
  }

  async function handleStatusChange(projectId: string, status: string) {
    try {
      const patchRes = await authFetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      })
      if (!patchRes.ok) throw new Error()
      toast.success(`Project ${status}`)
      fetchProjects()
    } catch {
      toast.error('Failed to update project status')
    }
  }

  async function handleDelete(projectId: string) {
    try {
      const delRes = await authFetch(`/api/projects/${projectId}`, { method: 'DELETE' })
      if (!delRes.ok) throw new Error()
      toast.success('Project deleted')
      fetchProjects()
    } catch {
      toast.error('Failed to delete project')
    }
  }

  async function openManageMembers(projectId: string, projectName: string) {
    setManageProjectId(projectId)
    setManageProjectName(projectName)
    setManageMembersOpen(true)
    setMembersLoading(true)
    try {
      const res = await authFetch(`/api/projects/${projectId}/members`)
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setProjectMembers(data.members || [])
    } catch {
      toast.error('Failed to load members')
    } finally {
      setMembersLoading(false)
    }
  }

  async function handleAddMembers(userIds: string[]) {
    try {
      const res = await authFetch(`/api/projects/${manageProjectId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds })
      })
      if (!res.ok) throw new Error()
      toast.success(`${userIds.length} member(s) added`)
      // Refresh members list
      const refreshRes = await authFetch(`/api/projects/${manageProjectId}/members`)
      if (refreshRes.ok) {
        const updated = await refreshRes.json()
        setProjectMembers(updated.members || [])
      }
      fetchProjects()
    } catch {
      toast.error('Failed to add members')
    }
  }

  async function handleRemoveMember(userId: string) {
    try {
      const res = await authFetch(`/api/projects/${manageProjectId}/members?userId=${userId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Member removed')
      setProjectMembers(prev => prev.filter(m => m.userId !== userId))
      fetchProjects()
    } catch {
      toast.error('Failed to remove member')
    }
  }

  function getProjectStatusBadge(status: string) {
    switch (status) {
      case 'active': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
      case 'completed': return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
      case 'archived': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
      default: return 'bg-slate-100 text-slate-700'
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center"><Skeleton className="h-10 w-48" /><Skeleton className="h-10 w-32" /></div>
        <Card><CardContent className="p-4"><Skeleton className="h-64 w-full" /></CardContent></Card>
      </div>
    )
  }

  return (
    <motion.div {...fadeIn} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Projects</h2>
          <p className="text-sm text-muted-foreground">Manage all projects across the platform</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="bg-primary hover:bg-primary/90 text-primary-foreground">
          <Plus className="h-4 w-4 mr-2" /> New Project
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="hidden md:table-cell">Description</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead className="text-center">Tasks</TableHead>
                <TableHead className="text-center hidden sm:table-cell">Members</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No projects found</TableCell></TableRow>
              )}
              {projects.map((p) => {
                const pCfg = getPriorityConfig(p.priority)
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                        <span className="font-medium">{p.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground max-w-48 truncate">
                      {p.description ?? '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={`${pCfg.color} text-xs`}>
                        {pCfg.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">{p._count?.tasks ?? 0}</TableCell>
                    <TableCell className="text-center hidden sm:table-cell">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 text-muted-foreground hover:text-foreground"
                        onClick={() => openManageMembers(p.id, p.name)}
                      >
                        <Users className="h-3.5 w-3.5" />
                        {p._count?.members ?? 0}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7">
                            <Badge variant="secondary" className={getProjectStatusBadge(p.status)}>
                              {p.status}
                            </Badge>
                            <ChevronDown className="h-3 w-3 ml-1" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem onClick={() => handleStatusChange(p.id, 'active')}>Active</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChange(p.id, 'completed')}>Completed</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChange(p.id, 'archived')}>Archived</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                    <TableCell>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Project</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete &quot;{p.name}&quot;? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(p.id)} className="bg-rose-600 hover:bg-rose-700">
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Project Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
            <DialogDescription>Add a new project to your workspace</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input placeholder="Project name" value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea placeholder="Brief description (optional)" value={form.description} onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm(p => ({ ...p, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {form.dueDate ? format(form.dueDate, 'MMM dd, yyyy') : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={form.dueDate ?? undefined}
                      onSelect={(d: Date | undefined) => setForm(p => ({ ...p, dueDate: d ?? null }))}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex gap-2 flex-wrap">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    className={`h-8 w-8 rounded-full border-2 transition-all ${form.color === c ? 'border-foreground scale-110' : 'border-transparent hover:scale-105'}`}
                    style={{ backgroundColor: c }}
                    onClick={() => setForm(p => ({ ...p, color: c }))}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Assign Members</Label>
              <p className="text-xs text-muted-foreground">Select team members who will have access to this project</p>
              {activeUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">No active users found</p>
              ) : (
                <ScrollArea className="max-h-48 rounded-md border">
                  <div className="p-2 space-y-1">
                    {activeUsers.map((u) => (
                      <label
                        key={u.id}
                        className="flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-muted/50 cursor-pointer"
                      >
                        <Checkbox
                          checked={selectedMemberIds.includes(u.id)}
                          onCheckedChange={(checked) => {
                            setSelectedMemberIds(prev =>
                              checked
                                ? [...prev, u.id]
                                : prev.filter(id => id !== u.id)
                            )
                          }}
                        />
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-[10px]">{getInitials(u.name)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium truncate block">{u.name}</span>
                        </div>
                        <Badge variant="secondary" className={cn('text-[10px]', getRoleBadgeClasses(u.role))}>
                          {u.role}
                        </Badge>
                      </label>
                    ))}
                  </div>
                </ScrollArea>
              )}
              {selectedMemberIds.length > 0 && (
                <p className="text-xs text-muted-foreground">{selectedMemberIds.length} member(s) selected</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!form.name.trim() || creating} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              {creating ? 'Creating...' : 'Create Project'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Members Dialog */}
      <Dialog open={manageMembersOpen} onOpenChange={setManageMembersOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Members</DialogTitle>
            <DialogDescription>
              Members of &quot;{manageProjectName}&quot;
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {membersLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {/* Current members */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Current Members</Label>
                  {projectMembers.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2">No members yet</p>
                  ) : (
                    <ScrollArea className="max-h-48 rounded-md border">
                      <div className="p-2 space-y-1">
                        {projectMembers.map((m) => (
                          <div key={m.id} className="flex items-center gap-3 px-2 py-1.5">
                            <Avatar className="h-6 w-6">
                              <AvatarFallback className="text-[10px]">{getInitials(m.user.name)}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <span className="text-sm font-medium truncate block">{m.user.name}</span>
                              <span className="text-xs text-muted-foreground">{m.user.email}</span>
                            </div>
                            <Badge variant="secondary" className={cn('text-[10px]', getRoleBadgeClasses(m.user.role))}>
                              {m.role === 'owner' ? 'owner' : m.user.role}
                            </Badge>
                            {m.role !== 'owner' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-muted-foreground hover:text-rose-500"
                                onClick={() => handleRemoveMember(m.userId)}
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </div>

                {/* Add new members */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Add Members</Label>
                  {activeUsers.filter(u => !projectMembers.some(m => m.userId === u.id)).length === 0 ? (
                    <p className="text-xs text-muted-foreground">All active users are already members</p>
                  ) : (
                    <ScrollArea className="max-h-40 rounded-md border">
                      <div className="p-2 space-y-1">
                        {activeUsers
                          .filter(u => !projectMembers.some(m => m.userId === u.id))
                          .map((u) => (
                            <div key={u.id} className="flex items-center gap-3 px-2 py-1.5 hover:bg-muted/50 rounded-md">
                              <Avatar className="h-6 w-6">
                                <AvatarFallback className="text-[10px]">{getInitials(u.name)}</AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <span className="text-sm font-medium truncate block">{u.name}</span>
                              </div>
                              <Badge variant="secondary" className={cn('text-[10px]', getRoleBadgeClasses(u.role))}>
                                {u.role}
                              </Badge>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 text-xs"
                                onClick={() => handleAddMembers([u.id])}
                              >
                                <UserPlus className="h-3 w-3 mr-1" />
                                Add
                              </Button>
                            </div>
                          ))}
                      </div>
                    </ScrollArea>
                  )}
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}

// ─── AdminTasks ────────────────────────────────────────────────────────────────

const STATUS_FILTERS = ['all', 'todo', 'in_progress', 'in_review', 'done'] as const
type StatusFilter = typeof STATUS_FILTERS[number]

const STATUS_LABELS: Record<string, string> = {
  all: 'All', todo: 'To Do', in_progress: 'In Progress', in_review: 'In Review', done: 'Done'
}

export function AdminTasks() {
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [tasks, setTasks] = useState<Task[]>([])
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [comments, setComments] = useState<CommentType[]>([])
  const [allTeamUsers, setAllTeamUsers] = useState<User[]>([])
  const [assigneeOpen, setAssigneeOpen] = useState(false)
  const [inlineStatusSaving, setInlineStatusSaving] = useState<string | null>(null)

  // Quick inline status change from the table
  const handleInlineStatusChange = async (taskId: string, newStatus: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    setInlineStatusSaving(taskId)
    try {
      const res = await authFetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error()
      // Optimistic update
      setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: newStatus as Task['status'] } : t))
      toast.success(`Status updated to ${STATUS_LABELS[newStatus] || newStatus}`)
    } catch {
      toast.error('Failed to update status')
    } finally {
      setInlineStatusSaving(null)
    }
  }

  // ─── Buffered edit state ───────────────────────────────────────
  const [editStatus, setEditStatus] = useState('')
  const [editPriority, setEditPriority] = useState('')
  const [editDueDate, setEditDueDate] = useState<Date | null>(null)
  const [pendingAssigneeIds, setPendingAssigneeIds] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  const hasChanges = selectedTask ? (
    editStatus !== selectedTask.status ||
    editPriority !== selectedTask.priority ||
    (editDueDate ? editDueDate.toISOString() : null) !== (selectedTask.dueDate || null) ||
    pendingAssigneeIds.size !== new Set((selectedTask.assignees || []).map((a: { userId: string }) => a.userId)).size ||
    ![...pendingAssigneeIds].every(id => new Set((selectedTask.assignees || []).map((a: { userId: string }) => a.userId)).has(id))
  ) : false

  const fetchTasks = useCallback(async (status: StatusFilter) => {
    setLoading(true)
    try {
      const url = status === 'all' ? '/api/tasks' : `/api/tasks?status=${status}`
      const res = await authFetch(url)
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setTasks(data.tasks ?? [])
    } catch {
      toast.error('Failed to load tasks')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchTasks(statusFilter) }, [statusFilter, fetchTasks])

  // Fetch all team/admin users for assignee selection
  useEffect(() => {
    authFetch('/api/users')
      .then(r => {
        if (!r.ok) throw new Error('Failed')
        return r.json()
      })
      .then(d => {
        const members = (d.users || []).filter((u: User) => u.role === 'team' || u.role === 'training' || u.role === 'admin')
        setAllTeamUsers(members)
      })
      .catch(() => {})
  }, [])

  async function openTaskDetail(task: Task) {
    setSelectedTask(task)
    setDetailOpen(true)
    // Initialize edit state from the task
    setEditStatus(task.status)
    setEditPriority(task.priority)
    setEditDueDate(task.dueDate ? new Date(task.dueDate) : null)
    const aIds = new Set((task.assignees || []).map((a: { userId: string }) => a.userId))
    setPendingAssigneeIds(aIds)
    // Fetch full task with comments
    try {
      const detailRes = await authFetch(`/api/tasks/${task.id}`)
      if (detailRes.ok) {
        const data = await detailRes.json()
        const fullTask = data.task
        setSelectedTask(fullTask)
        setComments(fullTask?.comments ?? [])
        setEditStatus(fullTask.status)
        setEditPriority(fullTask.priority)
        setEditDueDate(fullTask.dueDate ? new Date(fullTask.dueDate) : null)
        setPendingAssigneeIds(new Set((fullTask?.assignees || []).map((a: { userId: string }) => a.userId)))
      }
    } catch { /* use basic data */ }
  }

  function handleTogglePendingAssignee(userId: string) {
    setPendingAssigneeIds(prev => {
      const next = new Set(prev)
      if (next.has(userId)) {
        next.delete(userId)
      } else {
        next.add(userId)
      }
      return next
    })
  }

  const assignedUsersList = allTeamUsers.filter(u => pendingAssigneeIds.has(u.id))

  async function handleSave() {
    if (!selectedTask || !hasChanges) return
    setSaving(true)
    try {
      // Build updates for task fields
      const updates: Record<string, unknown> = {}
      if (editStatus !== selectedTask.status) updates.status = editStatus
      if (editPriority !== selectedTask.priority) updates.priority = editPriority
      const newDueDateStr = editDueDate ? editDueDate.toISOString() : null
      if (newDueDateStr !== (selectedTask.dueDate || null)) updates.dueDate = newDueDateStr

      if (Object.keys(updates).length > 0) {
        const patchRes = await authFetch(`/api/tasks/${selectedTask.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates)
        })
        if (!patchRes.ok) throw new Error()
      }

      // Handle assignee changes
      const originalIds = new Set((selectedTask.assignees || []).map((a: { userId: string }) => a.userId))
      const toRemove = [...originalIds].filter(id => !pendingAssigneeIds.has(id))
      const toAdd = [...pendingAssigneeIds].filter(id => !originalIds.has(id))

      for (const userId of toRemove) {
        const delRes = await authFetch('/api/tasks/assignments', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, taskId: selectedTask.id }),
        })
        if (!delRes.ok) throw new Error('Failed to remove assignee')
      }
      for (const userId of toAdd) {
        const addRes = await authFetch('/api/tasks/assignments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, taskId: selectedTask.id }),
        })
        if (!addRes.ok) throw new Error('Failed to add assignee')
      }

      toast.success('Task updated')
      fetchTasks(statusFilter)
      // Refresh selected task
      const fresh = await authFetch(`/api/tasks/${selectedTask.id}`)
      if (fresh.ok) {
        const data = await fresh.json()
        const updatedTask = data.task
        setSelectedTask(updatedTask)
        setComments(updatedTask?.comments ?? [])
        setEditStatus(updatedTask.status)
        setEditPriority(updatedTask.priority)
        setEditDueDate(updatedTask.dueDate ? new Date(updatedTask.dueDate) : null)
        setPendingAssigneeIds(new Set((updatedTask?.assignees || []).map((a: { userId: string }) => a.userId)))
      }
    } catch {
      toast.error('Failed to update task')
    } finally {
      setSaving(false)
    }
  }

  function handleDiscard() {
    if (!selectedTask) return
    setEditStatus(selectedTask.status)
    setEditPriority(selectedTask.priority)
    setEditDueDate(selectedTask.dueDate ? new Date(selectedTask.dueDate) : null)
    setPendingAssigneeIds(new Set((selectedTask.assignees || []).map((a: { userId: string }) => a.userId)))
  }

  if (loading && tasks.length === 0) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Card><CardContent className="p-4"><Skeleton className="h-64 w-full" /></CardContent></Card>
      </div>
    )
  }

  return (
    <motion.div {...fadeIn} className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Task Dashboard</h2>
        <p className="text-sm text-muted-foreground">View and manage all tasks across projects</p>
      </div>

      {/* Status Filter Tabs */}
      <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
        <TabsList>
          {STATUS_FILTERS.map((s) => (
            <TabsTrigger key={s} value={s} className="text-sm">
              {STATUS_LABELS[s]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead className="hidden md:table-cell">Assignees</TableHead>
                <TableHead className="hidden sm:table-cell">Due Date</TableHead>
                <TableHead className="hidden lg:table-cell">Project</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No tasks found</TableCell></TableRow>
              )}
              {tasks.map((task) => {
                const sCfg = getStatusConfig(task.status)
                const pCfg = getPriorityConfig(task.priority)
                const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'done'
                return (
                  <TableRow key={task.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openTaskDetail(task)}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className={`h-2 w-2 rounded-full flex-shrink-0 ${sCfg.dotColor}`} />
                        <span className="font-medium text-sm">{task.title}</span>
                      </div>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Select
                        value={task.status}
                        onValueChange={(v) => handleInlineStatusChange(task.id, v)}
                      >
                        <SelectTrigger className={cn('h-7 w-[120px] text-xs border-0 p-0 gap-1', sCfg.color)}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todo">To Do</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="in_review">In Review</SelectItem>
                          <SelectItem value="done">Done</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={`${pCfg.color} text-xs`}>{pCfg.label}</Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="flex -space-x-2">
                        {task.assignees?.slice(0, 3).map((a) => (
                          <TooltipProvider key={a.id}>
                            <Tooltip>
                              <TooltipTrigger>
                                <Avatar className="h-7 w-7 border-2 border-background">
                                  {a.user?.avatar ? <AvatarImage src={a.user.avatar} /> : null}
                                  <AvatarFallback className="text-[10px] bg-slate-100 dark:bg-slate-800">
                                    {a.user ? getInitials(a.user.name) : '?'}
                                  </AvatarFallback>
                                </Avatar>
                              </TooltipTrigger>
                              <TooltipContent><p>{a.user?.name}</p></TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ))}
                        {(task.assignees?.length ?? 0) > 3 && (
                          <div className="h-7 w-7 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-medium border-2 border-background">
                            +{task.assignees!.length - 3}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {task.dueDate ? (
                        <span className={`text-sm ${isOverdue ? 'text-rose-600 font-medium' : 'text-muted-foreground'}`}>
                          {formatDate(task.dueDate)}
                        </span>
                      ) : <span className="text-sm text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div className="flex items-center gap-2">
                        {task.project && <div className="h-2 w-2 rounded-full" style={{ backgroundColor: task.project.color }} />}
                        <span className="text-sm text-muted-foreground">{task.project?.name ?? '—'}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Task Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={(open) => {
        if (!open && hasChanges) {
          // If closing with unsaved changes, discard them
          handleDiscard()
        }
        setDetailOpen(open)
      }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          {selectedTask && (
            <>
              <DialogHeader>
                <DialogTitle className="text-lg">{selectedTask.title}</DialogTitle>
                <DialogDescription>
                  {selectedTask.project?.name ?? 'Project'} · Created {formatRelativeTime(selectedTask.createdAt)}
                </DialogDescription>
              </DialogHeader>

              {/* Unsaved changes indicator */}
              {hasChanges && (
                <div className="flex items-center gap-2 px-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">Unsaved changes</span>
                </div>
              )}

              <ScrollArea className="flex-1 -mx-6 px-6">
                <div className="space-y-6 py-2">
                  {/* Status & Priority */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Status</Label>
                      <Select value={editStatus} onValueChange={setEditStatus}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todo">To Do</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="in_review">In Review</SelectItem>
                          <SelectItem value="done">Done</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Priority</Label>
                      <Select value={editPriority} onValueChange={setEditPriority}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="urgent">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Due Date */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Due Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-fit justify-start text-left font-normal h-9">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {editDueDate ? format(editDueDate, 'MMM dd, yyyy') : 'Set due date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={editDueDate ?? undefined}
                          onSelect={(d: Date | undefined) => setEditDueDate(d ?? null)}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Assignees */}
                  <div className="space-y-2">
                    <Popover open={assigneeOpen} onOpenChange={setAssigneeOpen}>
                      <Label className="text-xs text-muted-foreground flex items-center gap-1.5 cursor-pointer hover:text-foreground transition-colors">
                        <Users className="w-3.5 h-3.5" />
                        <PopoverTrigger asChild>
                          <span>Assignees ({pendingAssigneeIds.size})</span>
                        </PopoverTrigger>
                        <UserPlus className="w-3 h-3" />
                      </Label>
                      <PopoverContent className="w-72 p-0" align="start" side="bottom">
                        <div className="p-3 border-b">
                          <p className="text-xs font-medium text-muted-foreground">Select team members to assign</p>
                        </div>
                        <div className="max-h-56 overflow-y-auto p-2 space-y-0.5">
                          {allTeamUsers.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No team members</p>}
                          {allTeamUsers.map(member => {
                            const isAssigned = pendingAssigneeIds.has(member.id)
                            return (
                              <button
                                key={member.id}
                                type="button"
                                onClick={() => handleTogglePendingAssignee(member.id)}
                                className={cn(
                                  'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left text-sm transition-colors cursor-pointer',
                                  isAssigned ? 'bg-primary/5' : 'hover:bg-accent'
                                )}
                              >
                                <Avatar className="w-7 h-7 shrink-0">
                                  <AvatarFallback className="text-[10px] bg-primary/10 text-primary">{getInitials(member.name)}</AvatarFallback>
                                </Avatar>
                                <span className="flex-1 truncate font-medium">{member.name}</span>
                                <span className="text-[10px] text-muted-foreground uppercase">{member.role}</span>
                                {isAssigned ? (
                                  <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center shrink-0">
                                    <Check className="w-3 h-3 text-primary-foreground" />
                                  </div>
                                ) : (
                                  <div className="w-5 h-5 rounded-full border border-muted shrink-0" />
                                )}
                              </button>
                            )
                          })}
                        </div>
                      </PopoverContent>
                    </Popover>
                    {assignedUsersList.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {assignedUsersList.map(u => (
                          <div key={u.id} className="inline-flex items-center gap-1.5 pl-1 pr-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                            <Avatar className="w-5 h-5"><AvatarFallback className="text-[8px]" style={{ fontSize: '8px' }}>{getInitials(u.name)}</AvatarFallback></Avatar>
                            <span>{u.name}</span>
                            <button type="button" onClick={() => handleTogglePendingAssignee(u.id)} className="ml-0.5 hover:text-destructive transition-colors"><X className="w-3 h-3" /></button>
                          </div>
                        ))}
                      </div>
                    )}
                    {assignedUsersList.length === 0 && !assigneeOpen && (
                      <p className="text-xs text-muted-foreground">No assignees yet. Click to add.</p>
                    )}
                  </div>

                  <Separator />

                  {/* Description */}
                  {selectedTask.description && (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Description</Label>
                      <div className="text-sm text-muted-foreground bg-muted/50 rounded-md p-3 whitespace-pre-wrap">
                        {selectedTask.description}
                      </div>
                    </div>
                  )}

                  {/* Comments */}
                  <div className="space-y-3">
                    <Label className="text-xs text-muted-foreground">
                      Comments ({comments.length})
                    </Label>
                    <div className="space-y-3 max-h-48 overflow-y-auto">
                      {comments.map((c) => (
                        <div key={c.id} className="flex gap-2">
                          <Avatar className="h-7 w-7 mt-0.5 flex-shrink-0">
                            {c.user?.avatar ? <AvatarImage src={c.user.avatar} /> : null}
                            <AvatarFallback className="text-[10px] bg-slate-100 dark:bg-slate-800">
                              {c.user ? getInitials(c.user.name) : '?'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium">{c.user?.name ?? 'Unknown'}</span>
                              <span className="text-xs text-muted-foreground">{formatRelativeTime(c.createdAt)}</span>
                            </div>
                            <p className="text-sm text-muted-foreground">{c.content}</p>
                          </div>
                        </div>
                      ))}
                      {comments.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">No comments yet</p>}
                    </div>
                  </div>
                </div>
              </ScrollArea>

              {/* Footer with Save / Discard buttons */}
              <div className="border-t pt-3 flex items-center justify-between">
                <div className="text-xs text-muted-foreground">
                  {hasChanges ? 'Changes will be applied when you save' : 'No changes'}
                </div>
                <div className="flex items-center gap-2">
                  {hasChanges && (
                    <Button variant="outline" size="sm" onClick={handleDiscard} disabled={saving}>
                      Discard
                    </Button>
                  )}
                  <Button size="sm" onClick={handleSave} disabled={!hasChanges || saving} className="gap-1.5">
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    Save
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}

// ─── AdminMessages ─────────────────────────────────────────────────────────────
export { MessagesPanel as AdminMessages } from '@/components/messages/MessagesPanel'

// ─── AdminUsers ────────────────────────────────────────────────────────────────

export function AdminUsers() {
  const { user: adminUser } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [users, setUsers] = useState<User[]>([])
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [adding, setAdding] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<User | null>(null)
  const [newUser, setNewUser] = useState({
    name: '', email: '', password: '', confirmPassword: '',
    role: 'team' as 'admin' | 'team' | 'training' | 'client',
    phone: '', company: ''
  })
  // Edit user state
  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState<{
    id: string
    name: string
    email: string
    role: string
    phone: string
    company: string
  }>({ id: '', name: '', email: '', role: 'team', phone: '', company: '' })
  // Reset password state
  const [resetOpen, setResetOpen] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [resetTarget, setResetTarget] = useState<{ id: string; name: string } | null>(null)
  const [resetPassword, setResetPassword] = useState('')
  const [resetConfirm, setResetConfirm] = useState('')

  const fetchUsers = useCallback(async () => {
    try {
      const res = await authFetch('/api/users')
      if (!res.ok) throw new Error()
      const data = await res.json()
      setUsers(data.users ?? [])
    } catch {
      toast.error('Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { setMounted(true); fetchUsers() }, [fetchUsers])

  const filteredUsers = users.filter((u) => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (u.company ?? '').toLowerCase().includes(q)
    }
    return true
  })

  const adminCount = users.filter(u => u.role === 'admin').length
  const teamCount = users.filter(u => u.role === 'team').length
  const trainingCount = users.filter(u => u.role === 'training').length
  const clientCount = users.filter(u => u.role === 'client').length

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault()
    if (!newUser.name || !newUser.email || !newUser.password) {
      toast.error('Name, email, and password are required')
      return
    }
    if (newUser.password.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }
    if (newUser.password !== newUser.confirmPassword) {
      toast.error('Passwords do not match')
      return
    }
    setAdding(true)
    try {
      const res = await authFetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newUser.name,
          email: newUser.email,
          password: newUser.password,
          role: newUser.role,
          phone: newUser.phone || undefined,
          company: newUser.company || undefined,
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(`User "${newUser.name}" created successfully`)
      setShowAddDialog(false)
      setNewUser({ name: '', email: '', password: '', confirmPassword: '', role: 'team', phone: '', company: '' })
      fetchUsers()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create user')
    } finally {
      setAdding(false)
    }
  }

  async function handleToggleStatus(u: User) {
    const newStatus = u.status === 'active' ? 'inactive' : 'active'
    try {
      const res = await authFetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: u.id, status: newStatus })
      })
      if (!res.ok) throw new Error()
      toast.success(`User ${newStatus === 'active' ? 'activated' : 'deactivated'}`)
      fetchUsers()
    } catch {
      toast.error('Failed to update user status')
    }
  }

  async function handleChangeRole(u: User, newRole: string) {
    if (newRole === u.role) return
    try {
      const res = await authFetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: u.id, role: newRole })
      })
      if (!res.ok) throw new Error()
      toast.success(`Role updated to ${newRole}`)
      fetchUsers()
    } catch {
      toast.error('Failed to update user role')
    }
  }

  function openEditDialog(u: User) {
    setEditForm({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      phone: u.phone ?? '',
      company: u.company ?? '',
    })
    setEditOpen(true)
  }

  async function handleEditUser(e: React.FormEvent) {
    e.preventDefault()
    if (!editForm.name || !editForm.email) {
      toast.error('Name and email are required')
      return
    }
    setEditing(true)
    try {
      const res = await authFetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editForm.id,
          name: editForm.name,
          email: editForm.email,
          role: editForm.role,
          phone: editForm.phone || undefined,
          company: editForm.company || undefined,
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(`User "${editForm.name}" updated successfully`)
      setEditOpen(false)
      fetchUsers()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update user')
    } finally {
      setEditing(false)
    }
  }

  function openResetDialog(u: User) {
    setResetTarget({ id: u.id, name: u.name })
    setResetPassword('')
    setResetConfirm('')
    setResetOpen(true)
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault()
    if (!resetTarget) return
    if (!resetPassword) {
      toast.error('New password is required')
      return
    }
    if (resetPassword.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }
    if (resetPassword !== resetConfirm) {
      toast.error('Passwords do not match')
      return
    }
    setResetting(true)
    try {
      const res = await authFetch(`/api/users/${resetTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newPassword: resetPassword,
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(data.message || `Password reset for "${resetTarget.name}"`)
      setResetOpen(false)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to reset password')
    } finally {
      setResetting(false)
    }
  }

  async function handleDeleteUser(u: User) {
    setDeletingId(u.id)
    try {
      const res = await authFetch(`/api/users/${u.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Failed')
      }
      toast.success(`User "${u.name}" deleted`)
      fetchUsers()
      setDeleteConfirmUser(null)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete user')
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  return (
    <motion.div {...fadeIn} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">User Management</h2>
          <p className="text-sm text-muted-foreground">Create and manage all user accounts</p>
        </div>
        <Button onClick={() => setShowAddDialog(true)} className="bg-primary hover:bg-primary/90 text-primary-foreground">
          <UserPlus className="w-4 h-4 mr-2" />
          Add User
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Admins', count: adminCount, icon: Shield, color: 'text-emerald-600', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
          { label: 'Team Members', count: teamCount, icon: UserCog, color: 'text-amber-600', bg: 'bg-amber-100 dark:bg-amber-900/30' },
          { label: 'Training', count: trainingCount, icon: GraduationCap, color: 'text-sky-600', bg: 'bg-sky-100 dark:bg-sky-900/30' },
          { label: 'Clients', count: clientCount, icon: Briefcase, color: 'text-rose-600', bg: 'bg-rose-100 dark:bg-rose-900/30' },
        ].map((c) => (
          <Card key={c.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`h-10 w-10 rounded-lg ${c.bg} flex items-center justify-center`}>
                <c.icon className={`h-5 w-5 ${c.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{c.count}</p>
                <p className="text-xs text-muted-foreground">{c.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or company..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="team">Team</SelectItem>
                <SelectItem value="training">Training</SelectItem>
                <SelectItem value="client">Client</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[250px]">User</TableHead>
                  <TableHead className="hidden sm:table-cell">Role</TableHead>
                  <TableHead className="hidden md:table-cell">Status</TableHead>
                  <TableHead className="hidden lg:table-cell">Company</TableHead>
                  <TableHead className="hidden lg:table-cell">Tasks</TableHead>
                  <TableHead className="hidden xl:table-cell">Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      {search || roleFilter !== 'all' ? 'No users match your filters' : 'No users found'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs bg-primary/10 text-primary">
                              {getInitials(u.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{u.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Select
                          value={u.role}
                          onValueChange={(val) => handleChangeRole(u, val)}
                          disabled={u.id === adminUser?.id}
                        >
                          <SelectTrigger className="w-28 h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="team">Team</SelectItem>
                            <SelectItem value="training">Training</SelectItem>
                            <SelectItem value="client">Client</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge
                          variant="secondary"
                          className={u.status === 'active'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                            : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                          }
                        >
                          {u.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                        {u.company || '—'}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm">
                        {u._count ? (u._count.assignedTasks + u._count.createdTasks) : 0}
                      </TableCell>
                      <TableCell className="hidden xl:table-cell text-sm text-muted-foreground">
                        {formatDate(u.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" disabled={u.id === adminUser?.id}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditDialog(u)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit User
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openResetDialog(u)}>
                              <KeyRound className="h-4 w-4 mr-2" />
                              Reset Password
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleToggleStatus(u)}>
                              {u.status === 'active' ? (
                                <>
                                  <X className="h-4 w-4 mr-2" />
                                  Deactivate
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="h-4 w-4 mr-2" />
                                  Activate
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setDeleteConfirmUser(u)}
                              disabled={u.id === adminUser?.id}
                              className="text-rose-600 focus:text-rose-600 focus:bg-rose-50 dark:focus:bg-rose-900/20"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete User
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Delete User Confirmation */}
      <AlertDialog open={!!deleteConfirmUser} onOpenChange={(open) => { if (!open) setDeleteConfirmUser(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {deleteConfirmUser?.name}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmUser && handleDeleteUser(deleteConfirmUser)}
              disabled={!!deletingId}
              className="bg-rose-600 hover:bg-rose-700"
            >
              {deletingId ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add User Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
            <DialogDescription>Add a new member to the platform. They will receive their credentials from you.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddUser} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="add-name">Full Name *</Label>
              <Input
                id="add-name"
                placeholder="John Doe"
                value={newUser.name}
                onChange={(e) => setNewUser(p => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-email">Email *</Label>
              <Input
                id="add-email"
                type="email"
                placeholder="name@company.com"
                value={newUser.email}
                onChange={(e) => setNewUser(p => ({ ...p, email: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="add-role">Role *</Label>
                <Select value={newUser.role} onValueChange={(val: 'admin' | 'team' | 'training' | 'client') => setNewUser(p => ({ ...p, role: val }))}>
                  <SelectTrigger id="add-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="team">Team</SelectItem>
                    <SelectItem value="training">Training</SelectItem>
                    <SelectItem value="client">Client</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-phone">Phone</Label>
                <Input
                  id="add-phone"
                  placeholder="+1 (555) 000"
                  value={newUser.phone}
                  onChange={(e) => setNewUser(p => ({ ...p, phone: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-company">Company</Label>
              <Input
                id="add-company"
                placeholder="Acme Inc."
                value={newUser.company}
                onChange={(e) => setNewUser(p => ({ ...p, company: e.target.value }))}
              />
            </div>
            <Separator />
            <div className="space-y-3">
              <p className="text-sm font-medium">Set Password</p>
              {mounted && (
              <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="add-password">Password *</Label>
                  <Input
                    id="add-password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Min. 6 characters"
                    value={newUser.password}
                    onChange={(e) => setNewUser(p => ({ ...p, password: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="add-confirm">Confirm *</Label>
                  <Input
                    id="add-confirm"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Re-enter"
                    value={newUser.confirmPassword}
                    onChange={(e) => setNewUser(p => ({ ...p, confirmPassword: e.target.value }))}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Share the credentials with the new user after creation.</p>
              </>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={adding} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                {adding && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create User
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update user information. Changes are saved immediately.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditUser} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Full Name *</Label>
              <Input
                id="edit-name"
                placeholder="John Doe"
                value={editForm.name}
                onChange={(e) => setEditForm(p => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email *</Label>
              <Input
                id="edit-email"
                type="email"
                placeholder="name@company.com"
                value={editForm.email}
                onChange={(e) => setEditForm(p => ({ ...p, email: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="edit-role">Role *</Label>
                <Select value={editForm.role} onValueChange={(val) => setEditForm(p => ({ ...p, role: val }))}>
                  <SelectTrigger id="edit-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="team">Team</SelectItem>
                    <SelectItem value="training">Training</SelectItem>
                    <SelectItem value="client">Client</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-phone">Phone</Label>
                <Input
                  id="edit-phone"
                  placeholder="+1 (555) 000"
                  value={editForm.phone}
                  onChange={(e) => setEditForm(p => ({ ...p, phone: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-company">Company</Label>
              <Input
                id="edit-company"
                placeholder="Acme Inc."
                value={editForm.company}
                onChange={(e) => setEditForm(p => ({ ...p, company: e.target.value }))}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={editing} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                {editing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-amber-600" />
              Reset Password
            </DialogTitle>
            <DialogDescription>
              Set a new password for <span className="font-semibold text-foreground">{resetTarget?.name}</span>. Make sure to share the new credentials with them securely.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20 p-3">
              <p className="text-sm text-amber-800 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4 inline-block mr-1.5 -mt-0.5" />
                The user will need to use the new password for their next login.
              </p>
            </div>
            {mounted && (
            <>
            <div className="space-y-2">
              <Label htmlFor="reset-password">New Password *</Label>
              <Input
                id="reset-password"
                type="password"
                autoComplete="new-password"
                placeholder="Min. 6 characters"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reset-confirm">Confirm Password *</Label>
              <Input
                id="reset-confirm"
                type="password"
                autoComplete="new-password"
                placeholder="Re-enter new password"
                value={resetConfirm}
                onChange={(e) => setResetConfirm(e.target.value)}
              />
            </div>
            </>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setResetOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={resetting} className="bg-amber-600 hover:bg-amber-700 text-white">
                {resetting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Reset Password
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}

// ─── AdminProfile ──────────────────────────────────────────────────────────────

export function AdminProfile() {
  const { user, updateUser } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [profile, setProfile] = useState({
    name: '', email: '', phone: '', company: ''
  })
  const [passwords, setPasswords] = useState({
    currentPassword: '', newPassword: '', confirmPassword: ''
  })

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const currentUserId = user?.id
    if (!currentUserId) return
    async function fetchData() {
      try {
        const res = await authFetch(`/api/user/profile?userId=${currentUserId}`)
        if (!res.ok) throw new Error('Failed')
        const data = await res.json()
        setProfile({
          name: data.user.name ?? '',
          email: data.user.email ?? '',
          phone: data.user.phone ?? '',
          company: data.user.company ?? '',
        })
      } catch {
        toast.error('Failed to load profile')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [user])

  async function handleSave() {
    if (!user) return
    setSaving(true)
    try {
      const body: Record<string, string> = {
        userId: user.id,
        name: profile.name,
        email: profile.email,
        phone: profile.phone,
        company: profile.company,
      }
      if (passwords.currentPassword && passwords.newPassword) {
        if (passwords.newPassword !== passwords.confirmPassword) {
          toast.error('New passwords do not match')
          setSaving(false)
          return
        }
        if (passwords.newPassword.length < 6) {
          toast.error('Password must be at least 6 characters')
          setSaving(false)
          return
        }
        body.currentPassword = passwords.currentPassword
        body.newPassword = passwords.newPassword
      }
      const patchRes = await authFetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const data = await patchRes.json()
      if (!patchRes.ok) {
        throw new Error(data.error)
      }
      toast.success('Profile updated successfully')
      // Update store user
      if (data.user && user) {
        updateUser(data.user)
      }
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2"><CardContent className="p-6"><Skeleton className="h-72 w-full" /></CardContent></Card>
          <Card><CardContent className="p-6"><Skeleton className="h-72 w-full" /></CardContent></Card>
        </div>
      </div>
    )
  }

  return (
    <motion.div {...fadeIn} className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Profile Settings</h2>
        <p className="text-sm text-muted-foreground">Manage your account information and preferences</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Form */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Personal Information</CardTitle>
            <CardDescription>Update your account details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input id="name" value={profile.name} onChange={(e) => setProfile(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={profile.email} onChange={(e) => setProfile(p => ({ ...p, email: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={profile.phone} onChange={(e) => setProfile(p => ({ ...p, phone: e.target.value }))} placeholder="Optional" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company">Company</Label>
                <Input id="company" value={profile.company} onChange={(e) => setProfile(p => ({ ...p, company: e.target.value }))} placeholder="Optional" />
              </div>
            </div>

            <Separator />

            {/* Change Password */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Change Password</h3>
              {mounted && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="currentPass">Current Password</Label>
                  <Input id="currentPass" type="password" autoComplete="current-password" value={passwords.currentPassword} onChange={(e) => setPasswords(p => ({ ...p, currentPassword: e.target.value }))} placeholder="Enter current" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPass">New Password</Label>
                  <Input id="newPass" type="password" autoComplete="new-password" value={passwords.newPassword} onChange={(e) => setPasswords(p => ({ ...p, newPassword: e.target.value }))} placeholder="Enter new" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPass">Confirm Password</Label>
                  <Input id="confirmPass" type="password" autoComplete="new-password" value={passwords.confirmPassword} onChange={(e) => setPasswords(p => ({ ...p, confirmPassword: e.target.value }))} placeholder="Confirm new" />
                </div>
              </div>
              )}
              <p className="text-xs text-muted-foreground">Leave password fields empty to keep your current password.</p>
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Account Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Account Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col items-center text-center">
              <ProfileAvatarUpload
                userId={user?.id ?? ''}
                name={user?.name ?? ''}
                avatar={user?.avatar}
                size="lg"
                onAvatarChange={(newAvatar) => {
                  if (user) updateUser({ avatar: newAvatar })
                }}
              />
              <h3 className="font-semibold mt-3">{user?.name}</h3>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
              <p className="text-xs text-muted-foreground mt-1">Click photo to change</p>
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Role</span>
                <Badge variant="secondary" className={getRoleBadgeClasses(user?.role ?? '')}>
                  {user?.role ?? '—'}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                  {user?.status ?? 'active'}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Member since</span>
                <span className="text-sm font-medium">{user?.createdAt ? formatDate(user.createdAt) : '—'}</span>
              </div>
            </div>

            <Separator />

            <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
              <Shield className="h-5 w-5 text-emerald-600" />
              <div>
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Admin Access</p>
                <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70">Full platform management</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  )
}
// ─── Admin Time Tracking ───────────────────────────────────────────────────

interface LocalTimeEntry {
  id: string; userId: string; projectId?: string | null; taskId?: string | null;
  description?: string | null; date: string;
  timeIn?: string | null; timeOut?: string | null;
  duration: number; status: 'idle' | 'timed_in' | 'completed';
  createdAt: string; updatedAt: string;
  user?: { id: string; name: string; email: string; role: string; avatar?: string | null };
  project?: { id: string; name: string; color: string };
  task?: { id: string; title: string };
}

type DatePreset = 'today' | 'week' | 'month' | 'all' | 'custom'

// formatDuration and formatLiveTimer (formatElapsed) imported from @/lib/format
function formatLiveTimer(startTime: string): string {
  return formatElapsed(startTime)
}

function getDateRange(preset: DatePreset, customFrom?: Date, customTo?: Date): { from?: string; to?: string } {
  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]

  if (preset === 'custom') {
    return {
      from: customFrom ? format(customFrom, 'yyyy-MM-dd') : undefined,
      to: customTo ? format(customTo, 'yyyy-MM-dd') : todayStr,
    }
  }

  switch (preset) {
    case 'today':
      return { from: todayStr, to: todayStr }
    case 'week': {
      const dayOfWeek = now.getDay()
      const monday = new Date(now)
      monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7))
      return { from: monday.toISOString().split('T')[0], to: todayStr }
    }
    case 'month': {
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      return { from: firstOfMonth.toISOString().split('T')[0], to: todayStr }
    }
    case 'all':
      return {}
  }
}

export function AdminTimeTracking() {

  // Data state
  const [timeEntries, setTimeEntries] = useState<LocalTimeEntry[]>([])
  const [teamUsers, setTeamUsers] = useState<{ id: string; name: string; email: string; role: string; avatar?: string | null }[]>([])
  const [projects, setProjects] = useState<{ id: string; name: string; color: string }[]>([])

  // Loading state
  const [loading, setLoading] = useState(true)
  const [stoppingId, setStoppingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  // Admin's own timer display (synced from sidebar shared store)
  const { activeSession } = useTimeTrackingStore()

  // Filter state
  const [selectedUserId, setSelectedUserId] = useState<string>('all')
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all')
  const [datePreset, setDatePreset] = useState<DatePreset>('today')
  const [customDateFrom, setCustomDateFrom] = useState<Date>()
  const [customDateTo, setCustomDateTo] = useState<Date>()

  // Live timer tick
  const [timerTick, setTimerTick] = useState(0)

  // Fetch team users and projects
  useEffect(() => {
    async function fetchMetadata() {
      try {
        const [usersRes, projectsRes] = await Promise.all([
          authFetch('/api/users?role=team'),
          authFetch('/api/projects'),
        ])
        if (!usersRes.ok || !projectsRes.ok) {
          toast.error('Failed to load time tracking filters')
          return
        }
        const usersData = await usersRes.json()
        setTeamUsers(usersData.users ?? usersData ?? [])
        const projectsData = await projectsRes.json()
        setProjects(projectsData.projects ?? projectsData ?? [])
      } catch {
        toast.error('Failed to load time tracking filters')
      }
    }
    fetchMetadata()
  }, [])

  // Fetch time entries
  const fetchEntries = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (selectedUserId !== 'all') params.set('userId', selectedUserId)
      if (selectedProjectId !== 'all') params.set('projectId', selectedProjectId)
      const { from, to } = getDateRange(datePreset, customDateFrom, customDateTo)
      if (from) params.set('dateFrom', from)
      if (to) params.set('dateTo', to)

      const res = await authFetch(`/api/time-entries?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setTimeEntries(data.timeEntries ?? [])
      }
    } catch {
      // silent fail
    } finally {
      setLoading(false)
    }
  }, [selectedUserId, selectedProjectId, datePreset, customDateFrom, customDateTo])

  useEffect(() => {
    fetchEntries()
  }, [fetchEntries])

  // Live timer interval (also ticks when admin has own active session)
  useEffect(() => {
    const activeTimers = timeEntries.filter((e) => e.status === 'timed_in')
    if (activeTimers.length === 0 && !activeSession) return

    const interval = setInterval(() => {
      setTimerTick((t) => t + 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [timeEntries, activeSession])

  // Derived data
  const activeEntries = timeEntries.filter((e) => e.status === 'timed_in')
  const completedEntries = timeEntries.filter((e) => e.status === 'completed')

  const todayStr = new Date().toISOString().split('T')[0]
  const todayTotalMinutes = completedEntries
    .filter((e) => e.date === todayStr)
    .reduce((sum, e) => sum + e.duration, 0)

  const { from: weekFrom } = getDateRange('week')
  const weekTotalMinutes = completedEntries
    .filter((e) => weekFrom && e.date >= weekFrom)
    .reduce((sum, e) => sum + e.duration, 0)

  // Also count truly active timers (timed_in) for the stat (includes admin's own)
  const activeTimerCount = activeEntries.length + (activeSession ? 1 : 0)

  // Sorted entries (date desc)
  const sortedEntries = [...timeEntries].sort((a, b) => {
    const dateA = a.timeIn ? a.timeIn : a.date
    const dateB = b.timeIn ? b.timeIn : b.date
    return dateB.localeCompare(dateA)
  })

  // Actions
  async function handleTimeOut(entryId: string) {
    setStoppingId(entryId)
    try {
      const res = await authFetch(`/api/time-entries/${entryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'time_out' }),
      })
      if (res.ok) {
        toast.success('Timer stopped successfully')
        fetchEntries()
      } else {
        toast.error('Failed to stop timer')
      }
    } catch {
      toast.error('Failed to stop timer')
    } finally {
      setStoppingId(null)
    }
  }

  async function handleDelete(entryId: string) {
    setDeletingId(entryId)
    try {
      const res = await authFetch(`/api/time-entries/${entryId}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Time entry deleted')
        fetchEntries()
      } else {
        toast.error('Failed to delete entry')
      }
    } catch {
      toast.error('Failed to delete entry')
    } finally {
      setDeletingId(null)
    }
  }

  // Download report handler
  async function handleDownloadReport() {
    setExporting(true)
    try {
      const params = new URLSearchParams()
      params.set('role', 'admin')
      if (selectedUserId !== 'all') params.set('userId', selectedUserId)
      if (selectedProjectId !== 'all') params.set('projectId', selectedProjectId)
      const { from, to } = getDateRange(datePreset, customDateFrom, customDateTo)
      if (from) params.set('dateFrom', from)
      if (to) params.set('dateTo', to)

      const res = await authFetch(`/api/time-entries/export?${params.toString()}`)
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      // Extract filename from Content-Disposition
      const disposition = res.headers.get('Content-Disposition')
      const filenameMatch = disposition?.match(/filename="(.+)"/)
      a.download = filenameMatch?.[1] || 'time-report.csv'
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      toast.success('Report downloaded successfully!')
    } catch {
      toast.error('Failed to download report')
    } finally {
      setExporting(false)
    }
  }

  // timerTick referenced to ensure live timer re-renders
  const _timerTick = timerTick
  void _timerTick

  // My active timer entry derived from shared store
  const myActiveEntry = activeSession

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-emerald-600" />
          <h2 className="text-lg font-semibold">Time Tracking</h2>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={handleDownloadReport}
          disabled={exporting || loading}
        >
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Download Report
        </Button>
      </div>

      {/* Admin's Own Timer Status (read-only, managed by sidebar) */}
      {myActiveEntry && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.02 }}
        >
          <Card className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-900/30 shrink-0">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div className="flex flex-col items-start">
                <span className="text-xs text-muted-foreground">You are currently clocked in</span>
                <span className="text-2xl font-mono font-bold text-amber-600 dark:text-amber-400">
                  {myActiveEntry.timeIn ? formatLiveTimer(myActiveEntry.timeIn) : '00:00:00'}
                </span>
                <div className="flex items-center gap-2 mt-0.5">
                  {myActiveEntry.project && (
                    <div className="flex items-center gap-1.5">
                      <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: myActiveEntry.project.color || '#f59e0b' }} />
                      <span className="text-xs text-muted-foreground">{myActiveEntry.project.name}</span>
                    </div>
                  )}
                  {myActiveEntry.task && (
                    <span className="text-xs text-muted-foreground">· {myActiveEntry.task.title}</span>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.05 }}
        >
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                <CircleDot className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Timers</p>
                <span className="text-2xl font-bold">{loading ? <Skeleton className="h-8 w-8 inline-block" /> : activeTimerCount}</span>
              </div>
            </div>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.1 }}
        >
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Today&apos;s Total Hours</p>
                <span className="text-2xl font-bold">{loading ? <Skeleton className="h-8 w-16 inline-block" /> : `${(todayTotalMinutes / 60).toFixed(1)}h`}</span>
              </div>
            </div>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.15 }}
        >
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-100 dark:bg-rose-900/30">
                <TrendingUp className="h-5 w-5 text-rose-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">This Week&apos;s Hours</p>
                <span className="text-2xl font-bold">{loading ? <Skeleton className="h-8 w-16 inline-block" /> : `${(weekTotalMinutes / 60).toFixed(1)}h`}</span>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Filters Row */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.2 }}
      >
        <Card className="p-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center flex-wrap">
            {/* User Filter */}
            <div className="flex items-center gap-2 min-w-[160px]">
              <Label className="text-sm text-muted-foreground whitespace-nowrap">User:</Label>
              <Select value={selectedUserId} onValueChange={(v) => setSelectedUserId(v === 'all' ? 'all' : v)}>
                <SelectTrigger className="h-9 w-full">
                  <SelectValue placeholder="All Users" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  {teamUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date Preset */}
            <div className="flex items-center gap-2">
              <Label className="text-sm text-muted-foreground whitespace-nowrap">Period:</Label>
              <div className="flex gap-1 flex-wrap">
                {([
                  { key: 'today' as DatePreset, label: 'Today' },
                  { key: 'week' as DatePreset, label: 'This Week' },
                  { key: 'month' as DatePreset, label: 'This Month' },
                  { key: 'all' as DatePreset, label: 'All Time' },
                  { key: 'custom' as DatePreset, label: 'Custom' },
                ]).map((preset) => (
                  <Button
                    key={preset.key}
                    variant={datePreset === preset.key ? 'default' : 'outline'}
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => setDatePreset(preset.key)}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Custom Date Range */}
            {datePreset === 'custom' && (
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

            {/* Project Filter */}
            <div className="flex items-center gap-2 min-w-[160px]">
              <Label className="text-sm text-muted-foreground whitespace-nowrap">Project:</Label>
              <Select value={selectedProjectId} onValueChange={(v) => setSelectedProjectId(v === 'all' ? 'all' : v)}>
                <SelectTrigger className="h-9 w-full">
                  <SelectValue placeholder="All Projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Active Timers Section */}
      {!loading && activeEntries.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.25 }}
        >
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <CircleDot className="h-4 w-4 text-emerald-500" />
              Active Timers ({activeEntries.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {activeEntries.map((entry) => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  <Card className="p-4 border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar className="h-9 w-9 shrink-0">
                          <AvatarImage src={entry.user?.avatar ?? undefined} />
                          <AvatarFallback className="text-xs">{getInitials(entry.user?.name ?? '?')}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{entry.user?.name ?? 'Unknown'}</p>
                          {entry.project && (
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span
                                className="inline-block h-2 w-2 rounded-full shrink-0"
                                style={{ backgroundColor: entry.project.color }}
                              />
                              <span className="text-xs text-muted-foreground truncate">{entry.project.name}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 shrink-0 border-0 text-xs">
                        <CircleDot className="h-3 w-3 mr-1 animate-pulse" />
                        Active
                      </Badge>
                    </div>

                    {(entry.task?.title || entry.description) && (
                      <div className="mt-3 space-y-1">
                        {entry.task?.title && (
                          <p className="text-xs font-medium text-muted-foreground">Task: {entry.task.title}</p>
                        )}
                        {entry.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">{entry.description}</p>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-emerald-200/50 dark:border-emerald-800/50">
                      <div className="text-xs text-muted-foreground">
                        <span>Started: {entry.timeIn ? formatRelativeTime(entry.timeIn) : '—'}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {entry.timeIn && (
                          <span className="text-sm font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                            {formatLiveTimer(entry.timeIn)}
                          </span>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 dark:border-red-800 dark:hover:bg-red-950/50 dark:text-red-400 dark:hover:text-red-300"
                          onClick={() => handleTimeOut(entry.id)}
                          disabled={stoppingId === entry.id}
                        >
                          {stoppingId === entry.id ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}
                          Time Out
                        </Button>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Time Entries Table */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.3 }}
      >
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Time Entries</CardTitle>
            <CardDescription>
              {loading ? 'Loading...' : `${sortedEntries.length} entr${sortedEntries.length === 1 ? 'y' : 'ies'} found`}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </div>
            ) : sortedEntries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Clock className="h-10 w-10 mb-3 opacity-40" />
                <p className="text-sm font-medium">No time entries found</p>
                <p className="text-xs mt-1">Adjust your filters or check back later</p>
              </div>
            ) : (
              <ScrollArea className="max-h-[480px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="min-w-[160px]">User</TableHead>
                      <TableHead className="min-w-[100px]">Date</TableHead>
                      <TableHead className="min-w-[80px]">Time In</TableHead>
                      <TableHead className="min-w-[80px]">Time Out</TableHead>
                      <TableHead className="min-w-[80px]">Duration</TableHead>
                      <TableHead className="min-w-[120px]">Project</TableHead>
                      <TableHead className="min-w-[120px]">Task</TableHead>
                      <TableHead className="min-w-[140px]">Description</TableHead>
                      <TableHead className="min-w-[90px]">Status</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedEntries.map((entry) => {
                      const statusConfig = entry.status === 'timed_in'
                        ? { variant: 'default' as const, className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border-0', label: 'Active' }
                        : entry.status === 'completed'
                        ? { variant: 'default' as const, className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-0', label: 'Completed' }
                        : { variant: 'secondary' as const, className: 'bg-secondary text-secondary-foreground', label: 'Idle' }

                      return (
                        <TableRow key={entry.id} className="group">
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-7 w-7">
                                <AvatarImage src={entry.user?.avatar ?? undefined} />
                                <AvatarFallback className="text-[10px]">{getInitials(entry.user?.name ?? '?')}</AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{entry.user?.name ?? 'Unknown'}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{formatDate(entry.date)}</TableCell>
                          <TableCell className="text-sm font-mono text-muted-foreground">
                            {entry.timeIn ? new Date(entry.timeIn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—'}
                          </TableCell>
                          <TableCell className="text-sm font-mono text-muted-foreground">
                            {entry.status === 'timed_in' ? (
                              <span className="text-emerald-600 dark:text-emerald-400 font-mono">
                                {entry.timeIn ? formatLiveTimer(entry.timeIn) : '—'}
                              </span>
                            ) : entry.timeOut ? (
                              new Date(entry.timeOut).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
                            ) : '—'}
                          </TableCell>
                          <TableCell className="text-sm font-medium">
                            {entry.status === 'timed_in' && entry.timeIn ? (
                              <span className="text-emerald-600 dark:text-emerald-400">
                                {(() => {
                                  const diffMs = Date.now() - new Date(entry.timeIn!).getTime()
                                  const totalMin = Math.max(0, Math.floor(diffMs / 60000))
                                  return formatDuration(totalMin)
                                })()}
                              </span>
                            ) : entry.duration > 0 ? (
                              formatDuration(entry.duration)
                            ) : '—'}
                          </TableCell>
                          <TableCell>
                            {entry.project ? (
                              <div className="flex items-center gap-1.5">
                                <span
                                  className="inline-block h-2 w-2 rounded-full shrink-0"
                                  style={{ backgroundColor: entry.project.color }}
                                />
                                <span className="text-sm truncate">{entry.project.name}</span>
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground truncate block max-w-[120px]">
                              {entry.task?.title ?? '—'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground truncate block max-w-[140px]">
                              {entry.description ?? '—'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge variant={statusConfig.variant} className={cn('text-xs', statusConfig.className)}>
                              {entry.status === 'timed_in' && <CircleDot className="h-3 w-3 mr-1" />}
                              {statusConfig.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-600"
                                  disabled={deletingId === entry.id}
                                >
                                  {deletingId === entry.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-4 w-4" />
                                  )}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Time Entry</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete this time entry for {entry.user?.name ?? 'this user'}? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-red-600 hover:bg-red-700 text-white"
                                    onClick={() => handleDelete(entry.id)}
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  )
}
