'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import type { Task, User } from '@/types'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  FolderKanban, UserCircle,
  Calendar, Users, Loader2, FileText, Shield, Lock, Save,
  Upload, File, ImageIcon, FileSpreadsheet, Trash2, Download, BarChart3,
  LayoutGrid, List, MessageCircle,
} from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { authFetch } from '@/lib/client-fetch'
import type { Project } from '@/types'
import {
  getRoleBadgeClasses, getPriorityConfig, getStatusConfig,
  formatDate, formatRelativeTime, getInitials,
} from '@/features/route-guard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { isBefore, parseISO } from 'date-fns'
import { cn } from '@/lib/utils'
import { ProfileAvatarUpload } from '@/components/profile-avatar-upload'


// ─── Extended project type with task stats ────────────────────
interface ClientProject extends Project {
  taskStats?: {
    todo: number
    in_progress: number
    in_review: number
    done: number
  }
  progress?: number
}

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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Skeleton className="h-80 rounded-xl lg:col-span-2" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
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
export function ClientProjects() {
  const { user } = useAuthStore()
  const [projects, setProjects] = useState<ClientProject[]>([])
  const [loading, setLoading] = useState(true)

  // Upload files state
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ url: string; originalName: string; filename: string; size: number; type: string; uploadedAt: string; projectId: string }>>([])
  const [uploading, setUploading] = useState(false)
  const [uploadDragOver, setUploadDragOver] = useState<string | null>(null) // projectId
  const [uploadDialogProjectId, setUploadDialogProjectId] = useState<string>('')
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Onboarding creation state


  const fetchProjects = useCallback(async () => {
    if (!user?.id) return
    try {
      // Use the client-only endpoint that queries through ClientProject table
      // This ensures only projects explicitly assigned to this client are returned
      const res = await authFetch(`/api/client/projects?clientId=${user.id}`)
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to load projects')
      }
      const data = await res.json()
      setProjects(data.projects || [])
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load projects')
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  // Fetch uploaded files from localStorage
  const fetchUploadedFiles = useCallback(() => {
    if (!user) return
    try {
      const stored = localStorage.getItem(`client-uploads-${user.id}`)
      if (stored) setUploadedFiles(JSON.parse(stored))
    } catch { /* ignore */ }
  }, [user])

  const saveUploadedFiles = useCallback((files: typeof uploadedFiles) => {
    if (!user) return
    localStorage.setItem(`client-uploads-${user.id}`, JSON.stringify(files))
  }, [user])

  useEffect(() => { fetchProjects(); fetchUploadedFiles() }, [fetchProjects, fetchUploadedFiles])

  // File upload handler — always uploads to the project set in uploadDialogProjectId
  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    if (!uploadDialogProjectId) {
      toast.error('No project selected')
      return
    }
    setUploading(true)
    const newFiles: typeof uploadedFiles = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      try {
        // Client-side validation
        if (file.size > 10 * 1024 * 1024) {
          throw new Error(`File size (${(file.size / 1024 / 1024).toFixed(1)}MB) exceeds 10MB limit`)
        }
        if (file.size === 0) {
          throw new Error('File is empty')
        }
        const formData = new FormData()
        formData.append('file', file)
        const res = await authFetch('/api/upload', { method: 'POST', body: formData })
        const data = await res.json()
        if (!res.ok) {
          throw new Error(data.error || 'Upload failed')
        }
        newFiles.push({ ...data, uploadedAt: new Date().toISOString(), projectId: uploadDialogProjectId })
      } catch (e: unknown) {
        toast.error(`${file.name}: ${e instanceof Error ? e.message : 'Upload failed'}`)
      }
    }
    if (newFiles.length > 0) {
      const updated = [...uploadedFiles, ...newFiles]
      setUploadedFiles(updated)
      saveUploadedFiles(updated)
      toast.success(`${newFiles.length} file${newFiles.length > 1 ? 's' : ''} uploaded successfully`)
    }
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleDrop = (e: React.DragEvent, projectId: string) => {
    e.preventDefault()
    setUploadDragOver(null)
    setUploadDialogProjectId(projectId)
    handleFileUpload(e.dataTransfer.files)
  }

  const openUploadDialog = (projectId: string) => {
    setUploadDialogProjectId(projectId)
    setUploadDialogOpen(true)
  }

  const deleteUploadedFile = (idx: number) => {
    const updated = uploadedFiles.filter((_, i) => i !== idx)
    setUploadedFiles(updated)
    saveUploadedFiles(updated)
    toast.success('File removed')
  }

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <ImageIcon className="w-4 h-4 text-emerald-600" />
    if (type.includes('pdf')) return <FileText className="w-4 h-4 text-red-500" />
    if (type.includes('word') || type.includes('document')) return <FileText className="w-4 h-4 text-blue-500" />
    if (type.includes('excel') || type.includes('sheet') || type.includes('spreadsheet')) return <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
    return <File className="w-4 h-4 text-muted-foreground" />
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  if (loading) return <PageSkeleton />

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
          <FolderKanban className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">My Projects</h1>
          <p className="text-sm text-muted-foreground">Track progress on all your active projects</p>
        </div>
      </div>

      {/* ─── Upload Files Section (hidden input + dialog) ─── */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".jpg,.jpeg,.png,.gif,.webp,.svg,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
        className="hidden"
        onChange={(e) => { handleFileUpload(e.target.files); setUploadDialogOpen(false) }}
      />
      <Dialog open={uploadDialogOpen} onOpenChange={(open) => { if (!open) setUploadDialogOpen(false) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-primary" />
              Upload Files
            </DialogTitle>
            <DialogDescription>Choose files to upload for this project</DialogDescription>
          </DialogHeader>
          <div
            onDragOver={(e) => { e.preventDefault(); setUploadDragOver('__dialog__') }}
            onDragLeave={() => setUploadDragOver(null)}
            onDrop={(e) => {
              e.preventDefault()
              setUploadDragOver(null)
              // Set the project context before handling files
              const files = e.dataTransfer.files
              if (files && files.length > 0) {
                // Use a separate handler for dialog drops
                void (async () => {
                  setUploading(true)
                  const newFiles: typeof uploadedFiles = []
                  for (let i = 0; i < files.length; i++) {
                    const file = files[i]
                    try {
                      if (file.size > 10 * 1024 * 1024) throw new Error(`File size exceeds 10MB limit`)
                      if (file.size === 0) throw new Error('File is empty')
                      const formData = new FormData()
                      formData.append('file', file)
                      const res = await authFetch('/api/upload', { method: 'POST', body: formData })
                      const data = await res.json()
                      if (!res.ok) {
                        throw new Error(data.error || 'Upload failed')
                      }
                      newFiles.push({ ...data, uploadedAt: new Date().toISOString(), projectId: uploadDialogProjectId })
                    } catch (err: unknown) {
                      toast.error(`${file.name}: ${err instanceof Error ? err.message : 'Upload failed'}`)
                    }
                  }
                  if (newFiles.length > 0) {
                    const updated = [...uploadedFiles, ...newFiles]
                    setUploadedFiles(updated)
                    saveUploadedFiles(updated)
                    toast.success(`${newFiles.length} file${newFiles.length > 1 ? 's' : ''} uploaded successfully`)
                  }
                  setUploading(false)
                })()
              }
            }}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
              uploadDragOver === '__dialog__' ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30'
            )}
          >
            {uploading ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
                <p className="text-sm text-muted-foreground">Uploading...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  <Upload className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">Drop files here or click to browse</p>
                  <p className="text-xs text-muted-foreground mt-1">JPG, PNG, PDF, DOC, DOCX, XLS, XLSX and more (max 10MB each)</p>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Project Progress Overview ──────────────────────────── */}
      {projects.length > 0 && (
        <motion.div {...fadeSlide} transition={{ delay: 0.1 }}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                Project Progress
              </CardTitle>
              <p className="text-sm text-muted-foreground">Overview of task progress across your projects</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-5">
                {projects.map((project) => {
                  const todo = project.taskStats?.todo || 0
                  const inProgress = project.taskStats?.in_progress || 0
                  const inReview = project.taskStats?.in_review || 0
                  const completed = project.taskStats?.done || 0
                  const total = todo + inProgress + inReview + completed
                  if (total === 0) return null

                  const todoPct = Math.round((todo / total) * 100)
                  const inProgressPct = Math.round((inProgress / total) * 100)
                  const inReviewPct = Math.round((inReview / total) * 100)
                  const completedPct = Math.round((completed / total) * 100)

                  return (
                    <div key={project.id} className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: project.color }} />
                          <span className="text-sm font-medium">{project.name}</span>
                        </div>
                        <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{completedPct}%</span>
                      </div>
                      {/* Stacked progress bar */}
                      <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
                        {todo > 0 && (
                          <div
                            className="bg-slate-400 dark:bg-slate-500 transition-all duration-500"
                            style={{ width: `${todoPct}%` }}
                            title={`Not Started: ${todo}`}
                          />
                        )}
                        {inProgress > 0 && (
                          <div
                            className="bg-amber-500 transition-all duration-500"
                            style={{ width: `${inProgressPct}%` }}
                            title={`In Progress: ${inProgress}`}
                          />
                        )}
                        {inReview > 0 && (
                          <div
                            className="bg-blue-500 transition-all duration-500"
                            style={{ width: `${inReviewPct}%` }}
                            title={`In Review: ${inReview}`}
                          />
                        )}
                        {completed > 0 && (
                          <div
                            className="bg-emerald-500 transition-all duration-500"
                            style={{ width: `${completedPct}%` }}
                            title={`Completed: ${completed}`}
                          />
                        )}
                      </div>
                      {/* Legend */}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-sm bg-slate-400 dark:bg-slate-500" />
                          Not Started ({todo})
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-sm bg-amber-500" />
                          In Progress ({inProgress})
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-sm bg-blue-500" />
                          In Review ({inReview})
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                          Completed ({completed})
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No active projects"
          description="You don't have any active projects yet."
        />
      ) : (
        <>
          {/* ─── Project Cards ──────────────────────────────────── */}
          <div className="space-y-4">
            {projects.map((project, i) => {
              const doneTasks = project.taskStats?.done || 0
              const totalT = project._count?.tasks || 0
              const pct = project.progress ?? 0
              const isOverdue = project.dueDate && isBefore(parseISO(project.dueDate), new Date())

              // Compute progress bar gradient colors
              const barColor = pct >= 75 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#ef4444'

              // Files for this project only
              const projectFiles = uploadedFiles.filter(f => f.projectId === project.id)

              return (
                <motion.div
                  key={project.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Card
                    className="hover:shadow-md transition-all border-l-4"
                    style={{ borderLeftColor: project.color }}
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
                        <div className="flex items-center gap-2 shrink-0 text-sm flex-wrap">
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
                            onClick={(e) => { e.stopPropagation(); openUploadDialog(project.id) }}
                          >
                            <Upload className="w-3.5 h-3.5" />
                            Upload Files
                          </Button>
                        </div>
                      </div>

                      {/* Progress bar with percentage */}
                      <div className="mt-3 space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{doneTasks}/{totalT} tasks completed</span>
                          <span className="font-semibold" style={{ color: barColor }}>{pct}%</span>
                        </div>
                        <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-primary/20">
                          <div
                            className="absolute top-0 left-0 h-2.5 rounded-full transition-all duration-500"
                            style={{
                              width: `${pct}%`,
                              background: `linear-gradient(90deg, ${barColor}88, ${barColor})`,
                            }}
                          />
                        </div>
                      </div>

                      {/* Per-project uploaded files */}
                      {projectFiles.length > 0 && (
                        <div className="mt-4 pt-3 border-t">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                            Files ({projectFiles.length})
                          </p>
                          <div className="space-y-1.5 max-h-48 overflow-y-auto">
                            {projectFiles.map((file, idx) => {
                              const globalIdx = uploadedFiles.indexOf(file)
                              return (
                                <motion.div
                                  key={file.filename}
                                  initial={{ opacity: 0, x: -8 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-muted/30 group"
                                >
                                  <div className="w-7 h-7 rounded-md bg-muted flex items-center justify-center shrink-0">
                                    {getFileIcon(file.type)}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium truncate">{file.originalName}</p>
                                    <p className="text-[11px] text-muted-foreground">{formatFileSize(file.size)}</p>
                                  </div>
                                  <a
                                    href={file.url}
                                    download={file.originalName}
                                    className="p-1 rounded-md hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <Download className="w-3 h-3 text-muted-foreground" />
                                  </a>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); deleteUploadedFile(globalIdx) }}
                                    className="p-1 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <Trash2 className="w-3 h-3 text-red-500" />
                                  </button>
                                </motion.div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })}
          </div>
        </>
      )}

    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// CLIENT TASKS — Read-only Kanban board
// ═══════════════════════════════════════════════════════════════════

const CLIENT_STATUS_COLUMNS = [
  { key: 'todo' as const, label: 'To Do', color: 'bg-slate-400', headerBg: 'bg-slate-100 dark:bg-slate-800/60' },
  { key: 'in_progress' as const, label: 'In Progress', color: 'bg-amber-500', headerBg: 'bg-amber-100 dark:bg-amber-900/40' },
  { key: 'in_review' as const, label: 'In Review', color: 'bg-purple-500', headerBg: 'bg-purple-100 dark:bg-purple-900/40' },
  { key: 'done' as const, label: 'Done', color: 'bg-emerald-500', headerBg: 'bg-emerald-100 dark:bg-emerald-900/40' },
]

export function ClientTasks() {
  const { user } = useAuthStore()
  const [projects, setProjects] = useState<ClientProject[]>([])
  const [selectedProject, setSelectedProject] = useState<string>('')
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [detailTask, setDetailTask] = useState<Task | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [comments, setComments] = useState<{ id: string; content: string; createdAt: string; user?: { id: string; name: string; avatar?: string | null } }[]>([])
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board')

  const fetchProjects = useCallback(async () => {
    if (!user?.id) return
    try {
      const res = await authFetch(`/api/client/projects?clientId=${user.id}`)
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to load projects')
      }
      const data = await res.json()
      setProjects(data.projects || [])
      if ((data.projects || []).length > 0 && !selectedProject) {
        setSelectedProject(data.projects[0].id)
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load projects')
    }
  }, [user?.id, selectedProject])

  const fetchTasks = useCallback(async () => {
    if (!selectedProject) return
    setLoading(true)
    try {
      const res = await authFetch(`/api/tasks?projectId=${selectedProject}`)
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to load tasks')
      }
      const data = await res.json()
      setTasks(data.tasks || [])
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load tasks')
    } finally {
      setLoading(false)
    }
  }, [selectedProject])

  useEffect(() => { fetchProjects() }, [fetchProjects])
  useEffect(() => { fetchTasks() }, [fetchTasks])

  const openDetail = async (task: Task) => {
    setDetailTask(task)
    setDetailOpen(true)
    try {
      const res = await authFetch(`/api/tasks/${task.id}`)
      if (res.ok) {
        const data = await res.json()
        setDetailTask(data.task)
        setComments(data.task?.comments ?? [])
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load task details')
    }
  }

  const currentProject = projects.find((p) => p.id === selectedProject)

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

  if (!loading && projects.length === 0) {
    return (
      <EmptyState
        icon={FolderKanban}
        title="No projects yet"
        description="You haven't been assigned to any projects yet. Tasks will appear here once you're added to a project."
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
        </div>
      </div>

      {/* Board View (read-only — no drag-and-drop) */}
      {viewMode === 'board' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {CLIENT_STATUS_COLUMNS.map((col) => {
            const colTasks = tasks.filter((t) => t.status === col.key)
            return (
              <div key={col.key} className="flex flex-col bg-muted/30 rounded-xl p-2 gap-2 min-h-[200px]">
                <div className={cn('flex items-center gap-2 px-3 py-2 rounded-lg', col.headerBg)}>
                  <div className={cn('h-2.5 w-2.5 rounded-full', col.color)} />
                  <span className="text-sm font-semibold">{col.label}</span>
                  <Badge variant="secondary" className="ml-auto text-xs h-5 min-w-5 justify-center">
                    {colTasks.length}
                  </Badge>
                </div>
                <ScrollArea className="max-h-[calc(100vh-280px)]">
                  <div className="space-y-2 pb-2">
                    {colTasks.length === 0 ? (
                      <div className="text-center py-8 text-xs text-muted-foreground border-2 border-dashed border-border/50 rounded-lg">
                        No tasks
                      </div>
                    ) : (
                      colTasks.map((task) => (
                        <Card
                          key={task.id}
                          className="cursor-pointer hover:shadow-md transition-shadow p-3 gap-2"
                          onClick={() => openDetail(task)}
                        >
                          <div className="space-y-2">
                            <p className="text-sm font-medium leading-tight">{task.title}</p>
                            {task.tags && (
                              <div className="flex flex-wrap gap-1">
                                {task.tags.split(',').slice(0, 2).map((t) => (
                                  <Badge key={t} variant="outline" className="text-[10px] px-1 py-0 h-4">{t.trim()}</Badge>
                                ))}
                              </div>
                            )}
                            <div className="flex items-center justify-between gap-2">
                              <PriorityBadge priority={task.priority} />
                              {task.dueDate && (
                                <span className="text-[10px] text-muted-foreground">{formatDate(task.dueDate)}</span>
                              )}
                            </div>
                            {(task.assignees && task.assignees.length > 0) && (
                              <div className="flex -space-x-1.5">
                                {task.assignees.slice(0, 3).map((a) => (
                                  a.user ? (
                                    <Avatar key={a.userId} className="h-5 w-5 border-2 border-background">
                                      <AvatarImage src={a.user.avatar || undefined} />
                                      <AvatarFallback className="text-[8px] bg-slate-200 dark:bg-slate-700">
                                        {getInitials(a.user.name)}
                                      </AvatarFallback>
                                    </Avatar>
                                  ) : null
                                ))}
                                {task.assignees.length > 3 && (
                                  <span className="text-[10px] text-muted-foreground ml-2">+{task.assignees.length - 3}</span>
                                )}
                              </div>
                            )}
                          </div>
                        </Card>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>
            )
          })}
        </div>
      ) : (
        /* List View (read-only) */
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40%]">Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Assignees</TableHead>
                <TableHead>Due Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-sm">
                    No tasks found
                  </TableCell>
                </TableRow>
              ) : (
                tasks.map((task) => {
                  const sConf = getStatusConfig(task.status)
                  const assignees = (task.assignees || []).map((a) => a.user).filter((u): u is User => !!u)
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
                        <PriorityBadge priority={task.priority} />
                      </TableCell>
                      <TableCell>
                        <div className="flex -space-x-1.5">
                          {assignees.slice(0, 3).map((u) => (
                            <Avatar key={u.id} className="h-6 w-6 border-2 border-background">
                              <AvatarImage src={u.avatar || undefined} />
                              <AvatarFallback className="text-[10px] bg-slate-200 dark:bg-slate-700">
                                {getInitials(u.name)}
                              </AvatarFallback>
                            </Avatar>
                          ))}
                          {assignees.length > 3 && (
                            <span className="text-xs text-muted-foreground ml-2">+{assignees.length - 3}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {task.dueDate ? (
                          <span className="text-xs text-muted-foreground">{formatDate(task.dueDate)}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
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

      {/* Task Detail Dialog (read-only for clients) */}
      <Dialog open={detailOpen} onOpenChange={(open) => { setDetailOpen(open); if (!open) { setDetailTask(null); setComments([]) } }}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          {detailTask && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <div className={cn('h-3 w-3 rounded-full', getStatusConfig(detailTask.status).dotColor)} />
                  <DialogTitle className="text-lg">{detailTask.title}</DialogTitle>
                </div>
                <DialogDescription className="sr-only">Task details</DialogDescription>
              </DialogHeader>

              <div className="space-y-6">
                {/* Status / Priority / Due Date — read-only display */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Status</Label>
                    <Badge className={cn('text-xs', getStatusConfig(detailTask.status).color)}>
                      {getStatusConfig(detailTask.status).label}
                    </Badge>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Priority</Label>
                    <PriorityBadge priority={detailTask.priority} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Due Date</Label>
                    <p className="text-sm">
                      {detailTask.dueDate ? formatDate(detailTask.dueDate) : '—'}
                    </p>
                  </div>
                </div>

                {/* Description */}
                {detailTask.description && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Description</Label>
                    <p className="text-sm whitespace-pre-wrap">{detailTask.description}</p>
                  </div>
                )}

                {/* Tags */}
                {detailTask.tags && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Tags</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {detailTask.tags.split(',').map((t) => t.trim()).filter(Boolean).map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Assignees */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Assignees</Label>
                  {detailTask.assignees && detailTask.assignees.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {detailTask.assignees.map((a) => (
                        <div key={a.id || a.userId} className="flex items-center gap-1.5 bg-muted/50 rounded-lg px-2 py-1">
                          <Avatar className="h-5 w-5">
                            <AvatarFallback className="text-[9px] bg-slate-200 dark:bg-slate-700">
                              {getInitials(a.user?.name || '?')}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs font-medium">{a.user?.name || 'Unknown'}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No one assigned yet</p>
                  )}
                </div>

                <Separator />

                {/* Comments (read-only) */}
                <div className="space-y-3">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <MessageCircle className="h-4 w-4" /> Comments
                    {comments.length > 0 && (
                      <Badge variant="secondary" className="text-xs h-5">{comments.length}</Badge>
                    )}
                  </Label>
                  {comments.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No comments yet</p>
                  ) : (
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {comments.map((c) => (
                        <div key={c.id} className="flex gap-2.5">
                          <Avatar className="h-7 w-7 shrink-0">
                            <AvatarFallback className="text-[10px] bg-slate-200 dark:bg-slate-700">
                              {getInitials(c.user?.name || '?')}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-xs font-medium">{c.user?.name || 'Unknown'}</span>
                              <span className="text-[10px] text-muted-foreground">{formatRelativeTime(c.createdAt)}</span>
                            </div>
                            <p className="text-sm whitespace-pre-wrap">{c.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
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
  const { user, updateUser } = useAuthStore()
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
        const res = await authFetch(`/api/user/profile?userId=${user.id}`)
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Failed to load profile')
        }
        const data = await res.json()
        if (data.user) {
          setName(data.user.name || '')
          setEmail(data.user.email || '')
          setPhone(data.user.phone || '')
          setCompany(data.user.company || '')
        }
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : 'Failed to load profile')
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
      const res = await authFetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, name, email, phone, company })
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed')
      }
      toast.success('Profile updated successfully')
      // Update user in store
      if (data.user && user) {
        updateUser({ name: data.user.name, email: data.user.email, phone: data.user.phone, company: data.user.company })
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
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    setSavingPassword(true)
    try {
      const res = await authFetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          currentPassword,
          newPassword
        })
      })
      const data = await res.json()
      if (!res.ok) {
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

      {/* Profile Avatar Card */}
      <motion.div {...fadeSlide}>
        <Card>
          <CardContent className="p-6">
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
              <h2 className="text-lg font-semibold mt-3">{user?.name}</h2>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
              <p className="text-xs text-muted-foreground mt-1">Click photo to change</p>
              <div className="flex flex-wrap gap-2 mt-3 justify-center">
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${getRoleBadgeClasses(user?.role || 'client')}`}>
                  Client
                </span>
                {user?.createdAt && (
                  <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-muted text-muted-foreground">
                    Member since {formatDate(user.createdAt)}
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Profile Card */}
      <motion.div {...fadeSlide}>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Personal Information</CardTitle>
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