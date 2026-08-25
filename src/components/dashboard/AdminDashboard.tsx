'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { format, formatDistanceToNow } from 'date-fns'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  FolderKanban,
  Users,
  UserCheck,
  TrendingUp,
  ListTodo,
  Eye,
  Plus,
  Pencil,
  MoreHorizontal,
  Activity,
  MessageSquare,
  Trash2,
  ArrowUpRight,
  ArrowRight,
  CalendarDays,
  CircleDot,
  Star,
  UserCog,
  UserX,
  Shield,
} from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

import { useAuthStore } from '@/stores/auth'
import type { User, Project, ActivityLog, DashboardStats } from '@/types'

// ─── Constants ────────────────────────────────────────────────────────────────

const PRESET_COLORS = [
  '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#14b8a6',
  '#6366f1', '#84cc16', '#e11d48', '#0ea5e9',
]

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  team: 'bg-amber-100 text-amber-700 border-amber-200',
  client: 'bg-rose-100 text-rose-700 border-rose-200',
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'bg-rose-100 text-rose-700 border-rose-200',
  high: 'bg-orange-100 text-orange-700 border-orange-200',
  medium: 'bg-amber-100 text-amber-700 border-amber-200',
  low: 'bg-emerald-100 text-emerald-700 border-emerald-200',
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  inactive: 'bg-gray-100 text-gray-500',
  archived: 'bg-zinc-100 text-zinc-500',
}

const ACTIVITY_ICONS: Record<string, React.ReactNode> = {
  created: <CircleDot className="h-4 w-4 text-emerald-500" />,
  updated: <Pencil className="h-4 w-4 text-amber-500" />,
  commented: <MessageSquare className="h-4 w-4 text-violet-500" />,
  completed: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
  deleted: <Trash2 className="h-4 w-4 text-rose-500" />,
  assigned: <UserCheck className="h-4 w-4 text-cyan-500" />,
  status_changed: <ArrowRight className="h-4 w-4 text-amber-500" />,
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExtendedDashboardStats extends DashboardStats {
  inReviewTasks: number
  todoTasks: number
  totalClients: number
  thisWeekCompleted: number
}

interface ExtendedUser extends User {
  _count?: {
    assignedTasks: number
    createdTasks: number
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const { adminView, user: currentUser } = useAuthStore()

  // ── State ──
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<ExtendedDashboardStats | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [users, setUsers] = useState<ExtendedUser[]>([])
  const [activities, setActivities] = useState<ActivityLog[]>([])

  // ── Create Project Dialog State ──
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [newProject, setNewProject] = useState({
    name: '',
    description: '',
    color: '#10b981',
    priority: 'medium',
    dueDate: '',
  })
  const [creating, setCreating] = useState(false)

  // ── Data Fetching ──

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/stats')
      if (!res.ok) throw new Error('Failed to fetch stats')
      const data = await res.json()
      setStats(data.stats)
    } catch {
      toast.error('Failed to load dashboard stats')
    }
  }, [])

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/projects')
      if (!res.ok) throw new Error('Failed to fetch projects')
      const data = await res.json()
      setProjects(data.projects)
    } catch {
      toast.error('Failed to load projects')
    }
  }, [])

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/users')
      if (!res.ok) throw new Error('Failed to fetch users')
      const data = await res.json()
      setUsers(data.users)
    } catch {
      toast.error('Failed to load users')
    }
  }, [])

  const fetchActivities = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/activity')
      if (!res.ok) throw new Error('Failed to fetch activities')
      const data = await res.json()
      setActivities(data.activities)
    } catch {
      toast.error('Failed to load activities')
    }
  }, [])

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true)
      await Promise.all([fetchStats(), fetchProjects(), fetchUsers(), fetchActivities()])
      setLoading(false)
    }
    loadAll()
  }, [fetchStats, fetchProjects, fetchUsers, fetchActivities])

  // ── Handlers ──

  const handleCreateProject = useCallback(async () => {
    if (!newProject.name.trim()) {
      toast.error('Project name is required')
      return
    }
    if (!currentUser) return

    setCreating(true)
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newProject,
          createdBy: currentUser.id,
          dueDate: newProject.dueDate || null,
        }),
      })
      if (!res.ok) throw new Error('Failed to create project')
      toast.success('Project created successfully')
      setCreateDialogOpen(false)
      setNewProject({ name: '', description: '', color: '#10b981', priority: 'medium', dueDate: '' })
      fetchProjects()
      fetchStats()
    } catch {
      toast.error('Failed to create project')
    } finally {
      setCreating(false)
    }
  }, [newProject, currentUser, fetchProjects, fetchStats])

  const handleUpdateUserRole = useCallback(async (userId: string, role: string) => {
    try {
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: userId, role }),
      })
      if (!res.ok) throw new Error('Failed to update user role')
      toast.success('User role updated')
      fetchUsers()
    } catch {
      toast.error('Failed to update user role')
    }
  }, [fetchUsers])

  const handleToggleUserStatus = useCallback(async (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active'
    try {
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: userId, status: newStatus }),
      })
      if (!res.ok) throw new Error('Failed to update user status')
      toast.success(`User ${newStatus === 'active' ? 'activated' : 'deactivated'}`)
      fetchUsers()
    } catch {
      toast.error('Failed to update user status')
    }
  }, [fetchUsers])

  const handleUpdateProjectStatus = useCallback(async (projectId: string, status: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error('Failed to update project status')
      toast.success('Project status updated')
      fetchProjects()
      fetchStats()
    } catch {
      toast.error('Failed to update project status')
    }
  }, [fetchProjects, fetchStats])

  // ── Chart Data ──

  const chartData = stats
    ? [
        { name: 'Todo', count: stats.todoTasks, fill: '#6366f1' },
        { name: 'In Progress', count: stats.inProgressTasks, fill: '#f59e0b' },
        { name: 'In Review', count: stats.inReviewTasks, fill: '#06b6d4' },
        { name: 'Done', count: stats.completedTasks, fill: '#10b981' },
      ]
    : []

  // ── Render Helpers ──

  const getActivityIcon = (action: string) => {
    const lower = action.toLowerCase()
    if (lower.includes('comment')) return ACTIVITY_ICONS.commented
    if (lower.includes('complet') || lower.includes('done')) return ACTIVITY_ICONS.completed
    if (lower.includes('delet')) return ACTIVITY_ICONS.deleted
    if (lower.includes('assign')) return ACTIVITY_ICONS.assigned
    if (lower.includes('status') || lower.includes('move')) return ACTIVITY_ICONS.status_changed
    if (lower.includes('updat') || lower.includes('edit')) return ACTIVITY_ICONS.updated
    return ACTIVITY_ICONS.created
  }

  // ── Loading State ──

  if (loading) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    )
  }

  // ── Tab Rendering ──

  return (
    <div className="space-y-6 p-4 md:p-6">
      {adminView === 'overview' && (
        <OverviewTab
          stats={stats!}
          chartData={chartData}
          activities={activities}
          getActivityIcon={getActivityIcon}
        />
      )}
      {adminView === 'projects' && (
        <ProjectsTab
          projects={projects}
          onCreateClick={() => setCreateDialogOpen(true)}
          onUpdateStatus={handleUpdateProjectStatus}
        />
      )}
      {adminView === 'users' && (
        <UsersTab
          users={users}
          onUpdateRole={handleUpdateUserRole}
          onToggleStatus={handleToggleUserStatus}
        />
      )}
      {adminView === 'activity' && (
        <ActivityTab
          activities={activities}
          getActivityIcon={getActivityIcon}
        />
      )}

      {/* ── Create Project Dialog ── */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
            <DialogDescription>
              Add a new project to your workspace. Fill in the details below.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="project-name">Name *</Label>
              <Input
                id="project-name"
                placeholder="Enter project name"
                value={newProject.name}
                onChange={(e) => setNewProject((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-desc">Description</Label>
              <Textarea
                id="project-desc"
                placeholder="Brief project description"
                value={newProject.description}
                onChange={(e) => setNewProject((p) => ({ ...p, description: e.target.value }))}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className="h-8 w-8 rounded-full border-2 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
                    style={{
                      backgroundColor: c,
                      borderColor: newProject.color === c ? '#000' : 'transparent',
                    }}
                    onClick={() => setNewProject((p) => ({ ...p, color: c }))}
                  />
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select
                  value={newProject.priority}
                  onValueChange={(val) => setNewProject((p) => ({ ...p, priority: val }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="project-due">Due Date</Label>
                <Input
                  id="project-due"
                  type="date"
                  value={newProject.dueDate}
                  onChange={(e) => setNewProject((p) => ({ ...p, dueDate: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateProject} disabled={creating || !newProject.name.trim()}>
              {creating ? 'Creating...' : 'Create Project'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({
  stats,
  chartData,
  activities,
  getActivityIcon,
}: {
  stats: ExtendedDashboardStats
  chartData: { name: string; count: number; fill: string }[]
  activities: ActivityLog[]
  getActivityIcon: (action: string) => React.ReactNode
}) {
  const statCards = [
    {
      label: 'Total Tasks',
      value: stats.totalTasks,
      icon: <ListTodo className="h-5 w-5" />,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      label: 'Completed',
      value: stats.completedTasks,
      icon: <CheckCircle2 className="h-5 w-5" />,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      label: 'In Progress',
      value: stats.inProgressTasks,
      icon: <Clock className="h-5 w-5" />,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      label: 'Overdue',
      value: stats.overdueTasks,
      icon: <AlertTriangle className="h-5 w-5" />,
      color: 'text-rose-600',
      bg: 'bg-rose-50',
    },
    {
      label: 'Projects',
      value: stats.totalProjects,
      icon: <FolderKanban className="h-5 w-5" />,
      color: 'text-violet-600',
      bg: 'bg-violet-50',
    },
    {
      label: 'Members',
      value: stats.totalMembers,
      icon: <Users className="h-5 w-5" />,
      color: 'text-cyan-600',
      bg: 'bg-cyan-50',
    },
    {
      label: 'Clients',
      value: stats.totalClients,
      icon: <UserCheck className="h-5 w-5" />,
      color: 'text-pink-600',
      bg: 'bg-pink-50',
    },
  ]

  const completionRate = stats.totalTasks > 0
    ? Math.round((stats.completedTasks / stats.totalTasks) * 100)
    : 0

  return (
    <>
      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{card.label}</p>
                    <p className="text-2xl font-bold mt-1">{card.value}</p>
                  </div>
                  <div className={`p-2.5 rounded-lg ${card.bg}`}>
                    <span className={card.color}>{card.icon}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Completion Rate Banner */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-emerald-500" />
                <span className="font-medium text-sm">Overall Completion Rate</span>
              </div>
              <span className="text-2xl font-bold text-emerald-600">{completionRate}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2.5">
              <div
                className="bg-emerald-500 h-2.5 rounded-full transition-all duration-500"
                style={{ width: `${completionRate}%` }}
              />
            </div>
            <div className="flex justify-between mt-2 text-xs text-muted-foreground">
              <span>{stats.thisWeekCompleted} completed this week</span>
              <span>{stats.totalTasks - stats.completedTasks} remaining</span>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Chart + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Task Distribution</CardTitle>
              <CardDescription>Breakdown by current status</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 12, fill: '#6b7280' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: '#6b7280' }}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: '8px',
                        border: '1px solid #e5e7eb',
                        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                        fontSize: '13px',
                      }}
                    />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]} fill="#10b981">
                      {chartData.map((entry, index) => (
                        <rect key={index} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.3 }}
        >
          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
              <CardDescription>Latest actions across the workspace</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <ScrollArea className="h-64 pr-3">
                <div className="space-y-4">
                  {activities.slice(0, 10).map((activity) => (
                    <div key={activity.id} className="flex items-start gap-3">
                      <div className="mt-0.5 shrink-0">
                        {getActivityIcon(activity.action)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm leading-snug">
                          {activity.user ? (
                            <span className="font-medium">{activity.user.name}</span>
                          ) : (
                            <span className="text-muted-foreground">System</span>
                          )}
                          {' '}
                          <span className="text-muted-foreground">{activity.action.toLowerCase()}</span>
                          {' '}
                          <span className="font-medium">{activity.details}</span>
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  ))}
                  {activities.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No recent activity
                    </p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </>
  )
}

// ─── Projects Tab ─────────────────────────────────────────────────────────────

function ProjectsTab({
  projects,
  onCreateClick,
  onUpdateStatus,
}: {
  projects: Project[]
  onCreateClick: () => void
  onUpdateStatus: (id: string, status: string) => void
}) {
  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Projects</h2>
          <p className="text-sm text-muted-foreground">Manage all workspace projects</p>
        </div>
        <Button onClick={onCreateClick} className="gap-2">
          <Plus className="h-4 w-4" />
          Create Project
        </Button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card>
          <CardContent className="p-0">
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead className="text-center">Tasks</TableHead>
                    <TableHead className="text-center">Members</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projects.map((project) => (
                    <TableRow key={project.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div
                            className="h-3 w-3 rounded-full shrink-0"
                            style={{ backgroundColor: project.color }}
                          />
                          <div>
                            <p className="font-medium text-sm">{project.name}</p>
                            {project.description && (
                              <p className="text-xs text-muted-foreground line-clamp-1 max-w-[200px]">
                                {project.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={PRIORITY_COLORS[project.priority] || ''}
                        >
                          {project.priority}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-medium">{project._count?.tasks ?? 0}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-medium">{project.members?.length ?? 0}</span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={STATUS_COLORS[project.status] || ''}
                        >
                          {project.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => onUpdateStatus(project.id, 'active')}
                              disabled={project.status === 'active'}
                            >
                              <CheckCircle2 className="h-4 w-4 mr-2 text-emerald-500" />
                              Set Active
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => onUpdateStatus(project.id, 'inactive')}
                              disabled={project.status === 'inactive'}
                            >
                              <Clock className="h-4 w-4 mr-2 text-amber-500" />
                              Set Inactive
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => onUpdateStatus(project.id, 'archived')}
                              disabled={project.status === 'archived'}
                            >
                              <FolderKanban className="h-4 w-4 mr-2 text-zinc-500" />
                              Archive
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                  {projects.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                        No projects found. Create your first project to get started.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden p-4 space-y-3">
              {projects.map((project) => (
                <Card key={project.id} className="border shadow-none bg-muted/30">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-3 w-3 rounded-full shrink-0"
                          style={{ backgroundColor: project.color }}
                        />
                        <p className="font-medium text-sm">{project.name}</p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => onUpdateStatus(project.id, 'active')}
                            disabled={project.status === 'active'}
                          >
                            Set Active
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => onUpdateStatus(project.id, 'inactive')}
                            disabled={project.status === 'inactive'}
                          >
                            Set Inactive
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => onUpdateStatus(project.id, 'archived')}
                            disabled={project.status === 'archived'}
                          >
                            Archive
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    {project.description && (
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {project.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={PRIORITY_COLORS[project.priority] || ''}>
                        {project.priority}
                      </Badge>
                      <Badge variant="secondary" className={STATUS_COLORS[project.status] || ''}>
                        {project.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <ListTodo className="h-3 w-3" />
                        {project._count?.tasks ?? 0} tasks
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {project.members?.length ?? 0} members
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {projects.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No projects found. Create your first project to get started.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </>
  )
}

// ─── Users Tab ────────────────────────────────────────────────────────────────

function UsersTab({
  users,
  onUpdateRole,
  onToggleStatus,
}: {
  users: ExtendedUser[]
  onUpdateRole: (userId: string, role: string) => void
  onToggleStatus: (userId: string, currentStatus: string) => void
}) {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const avatarColors = [
    'bg-emerald-500',
    'bg-amber-500',
    'bg-rose-500',
    'bg-violet-500',
    'bg-cyan-500',
    'bg-orange-500',
    'bg-pink-500',
    'bg-teal-500',
  ]

  const getAvatarColor = (id: string) => {
    let hash = 0
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash)
    }
    return avatarColors[Math.abs(hash) % avatarColors.length]
  }

  return (
    <>
      <div>
        <h2 className="text-xl font-semibold">Users</h2>
        <p className="text-sm text-muted-foreground">Manage workspace members and roles</p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card>
          <CardContent className="p-0">
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">Assigned</TableHead>
                    <TableHead className="text-center">Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div
                            className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium text-white shrink-0 ${getAvatarColor(u.id)}`}
                          >
                            {u.avatar ? (
                              <img
                                src={u.avatar}
                                alt={u.name}
                                className="h-8 w-8 rounded-full object-cover"
                              />
                            ) : (
                              getInitials(u.name)
                            )}
                          </div>
                          <span className="font-medium text-sm">{u.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={ROLE_COLORS[u.role] || ''}>
                          {u.role === 'admin' && <Shield className="h-3 w-3 mr-1" />}
                          {u.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={
                            u.status === 'active'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-gray-100 text-gray-500'
                          }
                        >
                          {u.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-medium text-sm">
                          {u._count?.assignedTasks ?? 0}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-medium text-sm">
                          {u._count?.createdTasks ?? 0}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onUpdateRole(u.id, 'admin')}>
                              <Shield className="h-4 w-4 mr-2 text-emerald-500" />
                              Set as Admin
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onUpdateRole(u.id, 'team')}>
                              <UserCog className="h-4 w-4 mr-2 text-amber-500" />
                              Set as Team
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onUpdateRole(u.id, 'client')}>
                              <UserX className="h-4 w-4 mr-2 text-rose-500" />
                              Set as Client
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => onToggleStatus(u.id, u.status)}
                            >
                              {u.status === 'active' ? (
                                <>
                                  <UserX className="h-4 w-4 mr-2 text-rose-500" />
                                  Deactivate
                                </>
                              ) : (
                                <>
                                  <UserCheck className="h-4 w-4 mr-2 text-emerald-500" />
                                  Activate
                                </>
                              )}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                  {users.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                        No users found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden p-4 space-y-3">
              {users.map((u) => (
                <Card key={u.id} className="border shadow-none bg-muted/30">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-medium text-white shrink-0 ${getAvatarColor(u.id)}`}
                        >
                          {u.avatar ? (
                            <img
                              src={u.avatar}
                              alt={u.name}
                              className="h-9 w-9 rounded-full object-cover"
                            />
                          ) : (
                            getInitials(u.name)
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{u.name}</p>
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onUpdateRole(u.id, 'admin')}>
                            Set as Admin
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onUpdateRole(u.id, 'team')}>
                            Set as Team
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onUpdateRole(u.id, 'client')}>
                            Set as Client
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onToggleStatus(u.id, u.status)}>
                            {u.status === 'active' ? 'Deactivate' : 'Activate'}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={ROLE_COLORS[u.role] || ''}>
                        {u.role}
                      </Badge>
                      <Badge
                        variant="secondary"
                        className={
                          u.status === 'active'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-gray-100 text-gray-500'
                        }
                      >
                        {u.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{u._count?.assignedTasks ?? 0} assigned</span>
                      <span>{u._count?.createdTasks ?? 0} created</span>
                      <span>Joined {format(new Date(u.createdAt), 'MMM d, yyyy')}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {users.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No users found.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </>
  )
}

// ─── Activity Tab ─────────────────────────────────────────────────────────────

function ActivityTab({
  activities,
  getActivityIcon,
}: {
  activities: ActivityLog[]
  getActivityIcon: (action: string) => React.ReactNode
}) {
  const getTimelineColor = (action: string) => {
    const lower = action.toLowerCase()
    if (lower.includes('complet') || lower.includes('done')) return 'border-emerald-500'
    if (lower.includes('delet')) return 'border-rose-500'
    if (lower.includes('comment')) return 'border-violet-500'
    if (lower.includes('updat') || lower.includes('edit') || lower.includes('status') || lower.includes('move'))
      return 'border-amber-500'
    return 'border-emerald-500'
  }

  const getIconBg = (action: string) => {
    const lower = action.toLowerCase()
    if (lower.includes('complet') || lower.includes('done')) return 'bg-emerald-100'
    if (lower.includes('delet')) return 'bg-rose-100'
    if (lower.includes('comment')) return 'bg-violet-100'
    if (lower.includes('updat') || lower.includes('edit') || lower.includes('status') || lower.includes('move'))
      return 'bg-amber-100'
    return 'bg-emerald-100'
  }

  return (
    <>
      <div>
        <h2 className="text-xl font-semibold">Activity</h2>
        <p className="text-sm text-muted-foreground">Timeline of all recent workspace activity</p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card>
          <CardContent className="p-0">
            <ScrollArea className="max-h-[600px]">
              <div className="p-4 md:p-6">
                {activities.length === 0 ? (
                  <div className="text-center py-16">
                    <Activity className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
                    <p className="text-muted-foreground">No activity recorded yet</p>
                    <p className="text-sm text-muted-foreground/60 mt-1">
                      Activity will appear here as your team works on tasks
                    </p>
                  </div>
                ) : (
                  <div className="relative">
                    {/* Timeline line */}
                    <div className="absolute left-5 top-0 bottom-0 w-px bg-border hidden sm:block" />

                    <div className="space-y-6">
                      {activities.map((activity, index) => (
                        <div key={activity.id} className="relative flex gap-4 sm:gap-6">
                          {/* Timeline dot */}
                          <div className="hidden sm:flex flex-col items-center shrink-0 z-10">
                            <div
                              className={`h-10 w-10 rounded-full flex items-center justify-center ${getIconBg(activity.action)}`}
                            >
                              {getActivityIcon(activity.action)}
                            </div>
                            {index < activities.length - 1 && (
                              <div className={`w-px flex-1 mt-2 ${getTimelineColor(activity.action)}`} />
                            )}
                          </div>

                          {/* Mobile icon */}
                          <div className="sm:hidden shrink-0 mt-0.5">
                            <div
                              className={`h-8 w-8 rounded-full flex items-center justify-center ${getIconBg(activity.action)}`}
                            >
                              {getActivityIcon(activity.action)}
                            </div>
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0 pb-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              {activity.user ? (
                                <span className="font-medium text-sm">{activity.user.name}</span>
                              ) : (
                                <span className="text-sm text-muted-foreground">System</span>
                              )}
                              <span className="text-sm text-muted-foreground">
                                {activity.action.toLowerCase()}
                              </span>
                              <span className="font-medium text-sm truncate">
                                {activity.details}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(activity.createdAt), {
                                  addSuffix: true,
                                })}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                &middot; {format(new Date(activity.createdAt), 'MMM d, h:mm a')}
                              </span>
                            </div>

                            {/* Project / Task context */}
                            {(activity.projectId || activity.taskId) && (
                              <div className="flex items-center gap-2 mt-2">
                                {activity.projectId && (
                                  <Badge variant="outline" className="text-xs gap-1">
                                    <FolderKanban className="h-3 w-3" />
                                    Project
                                  </Badge>
                                )}
                                {activity.taskId && (
                                  <Badge variant="outline" className="text-xs gap-1">
                                    <ListTodo className="h-3 w-3" />
                                    Task
                                  </Badge>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </motion.div>
    </>
  )
}