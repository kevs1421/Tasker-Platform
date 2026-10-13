'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  FolderKanban, UserCircle,
  Calendar, Users, Loader2, FileText, Shield, Lock, Save,
  Upload, File, ImageIcon, FileSpreadsheet, Trash2, Download, BarChart3,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts'
import { useAuthStore } from '@/stores/auth'
import { authFetch } from '@/lib/client-fetch'
import type { Project } from '@/types'
import {
  getRoleBadgeClasses, getPriorityConfig,
  formatDate,
} from '@/features/route-guard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { isBefore, parseISO, startOfDay } from 'date-fns'
import { cn } from '@/lib/utils'
import { formatFileSize } from '@/lib/format'
import { fadeSlide } from '@/lib/animations'
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

// ─── Animation variants imported from @/lib/animations ──────────────

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
  const [error, setError] = useState<string | null>(null)

  // Upload files state
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ url: string; originalName: string; filename: string; size: number; type: string; uploadedAt: string; projectId: string }>>([])
  const [uploading, setUploading] = useState(false)
  const [uploadDragOver, setUploadDragOver] = useState<string | null>(null) // projectId
  const [uploadDialogProjectId, setUploadDialogProjectId] = useState<string>('')
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Onboarding creation state


  const fetchProjects = useCallback(async () => {
    if (!user?.id) return // Don't set loading=false — parent ensures user is hydrated before mounting
    setLoading(true)
    setError(null)
    try {
      // Use the client-only endpoint that queries through ClientProject table
      // This ensures only projects explicitly assigned to this client are returned
      const res = await authFetch(`/api/client/projects?clientId=${user.id}`)

      // Handle 401 — session expired or invalid, force logout
      if (res.status === 401) {
        useAuthStore.getState().forceLogout()
        return
      }

      if (!res.ok) {
        let errorMsg = 'Failed to load projects'
        try {
          const data = await res.json()
          errorMsg = data.error || errorMsg
        } catch { /* response not JSON */ }
        throw new Error(errorMsg)
      }
      const data = await res.json()
      setProjects(data.projects || [])
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load projects'
      setError(msg)
      toast.error(msg)
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

  // formatFileSize is now imported from @/lib/format

  if (loading) return <PageSkeleton />

  // Error state with retry button
  if (error && projects.length === 0) {
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
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-sm text-muted-foreground mb-3">{error}</p>
            <Button variant="outline" onClick={() => fetchProjects()} className="gap-2">
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

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
              handleFileUpload(e.dataTransfer.files)
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
      {projects.length > 0 && (() => {
        // Build bar chart data: one entry per project with task counts by status
        const barData = projects.map(project => ({
          name: project.name.length > 16 ? project.name.slice(0, 14) + '…' : project.name,
          fullName: project.name,
          'To Do': project.taskStats?.todo || 0,
          'In Progress': project.taskStats?.in_progress || 0,
          'In Review': project.taskStats?.in_review || 0,
          'Done': project.taskStats?.done || 0,
          total: (project.taskStats?.todo || 0) + (project.taskStats?.in_progress || 0) + (project.taskStats?.in_review || 0) + (project.taskStats?.done || 0),
          progress: project.progress ?? 0,
        }))

        // Custom tooltip
        const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) => {
          if (!active || !payload?.length) return null
          const item = barData.find(d => d.name === label || d.fullName === label)
          return (
            <div className="bg-popover border rounded-lg shadow-lg p-3 text-sm">
              <p className="font-semibold mb-1.5">{item?.fullName || label}</p>
              {payload.map((entry, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: entry.color }} />
                  <span className="text-muted-foreground">{entry.name}:</span>
                  <span className="font-medium">{entry.value}</span>
                </div>
              ))}
              {item && (
                <div className="mt-1.5 pt-1.5 border-t text-emerald-600 dark:text-emerald-400 font-medium">
                  {item.progress}% complete
                </div>
              )}
            </div>
          )
        }

        return (
          <motion.div {...fadeSlide} transition={{ delay: 0.1 }}>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-primary" />
                  Project Progress
                </CardTitle>
                <p className="text-sm text-muted-foreground">Task breakdown by status for each project</p>
              </CardHeader>
              <CardContent>
                {barData.some(d => d.total > 0) ? (
                  <div className="w-full" style={{ height: Math.max(220, 260) }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={barData}
                        margin={{ top: 10, right: 10, left: 0, bottom: 5 }}
                        barCategoryGap="20%"
                        barGap={2}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 12, fill: 'var(--color-muted-foreground)' }}
                          axisLine={{ stroke: 'var(--color-border)' }}
                          tickLine={false}
                        />
                        <YAxis
                          allowDecimals={false}
                          tick={{ fontSize: 12, fill: 'var(--color-muted-foreground)' }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend
                          iconType="square"
                          iconSize={10}
                          wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                        />
                        <Bar dataKey="To Do" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="In Progress" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="In Review" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Done" fill="#10b981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-24 text-sm text-muted-foreground">
                    No tasks across your projects yet
                  </div>
                )}
                {/* Per-project progress summary below chart */}
                <div className="mt-4 space-y-2">
                  {barData.map((d) => (
                    <div key={d.fullName} className="flex items-center justify-between text-sm">
                      <span className="font-medium">{d.fullName}</span>
                      <span className={cn(
                        'font-semibold',
                        d.progress >= 75 ? 'text-emerald-600 dark:text-emerald-400' :
                        d.progress >= 40 ? 'text-amber-600 dark:text-amber-400' :
                        'text-red-500'
                      )}>
                        {d.total > 0 ? `${d.progress}% (${d['Done']}/${d.total} tasks)` : 'No tasks'}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )
      })()}

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
              const todoT = project.taskStats?.todo || 0
              const inProgressT = project.taskStats?.in_progress || 0
              const inReviewT = project.taskStats?.in_review || 0
              const doneTasks = project.taskStats?.done || 0
              const totalT = project._count?.tasks || 0
              const pct = project.progress ?? 0
              const isOverdue = project.dueDate && isBefore(parseISO(project.dueDate), startOfDay(new Date()))

              // Compute progress bar segment widths (consistent with overview)
              const todoPctT = totalT > 0 ? Math.round((todoT / totalT) * 100) : 0
              const inProgressPctT = totalT > 0 ? Math.round((inProgressT / totalT) * 100) : 0
              const inReviewPctT = totalT > 0 ? Math.round((inReviewT / totalT) * 100) : 0
              const donePctT = totalT > 0 ? Math.max(0, 100 - todoPctT - inProgressPctT - inReviewPctT) : 0

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

                      {/* Progress bar with percentage & task breakdown */}
                      <div className="mt-3 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">
                            {totalT > 0 ? `${doneTasks}/${totalT} tasks completed` : 'No tasks yet'}
                          </span>
                          <span className="font-semibold" style={{ color: totalT > 0 ? barColor : '#94a3b8' }}>
                            {totalT > 0 ? `${pct}%` : '—'}
                          </span>
                        </div>
                        {totalT > 0 ? (
                          <>
                            <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
                              {todoT > 0 && (
                                <div className="bg-slate-400 dark:bg-slate-500 transition-all duration-500" style={{ width: `${todoPctT}%` }} />
                              )}
                              {inProgressT > 0 && (
                                <div className="bg-amber-500 transition-all duration-500" style={{ width: `${inProgressPctT}%` }} />
                              )}
                              {inReviewT > 0 && (
                                <div className="bg-blue-500 transition-all duration-500" style={{ width: `${inReviewPctT}%` }} />
                              )}
                              {doneTasks > 0 && (
                                <div className="bg-emerald-500 transition-all duration-500" style={{ width: `${donePctT}%` }} />
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                              {(project.taskStats?.todo || 0) > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-slate-400 dark:bg-slate-500" />To Do ({project.taskStats?.todo})</span>}
                              {(project.taskStats?.in_progress || 0) > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-500" />In Progress ({project.taskStats?.in_progress})</span>}
                              {(project.taskStats?.in_review || 0) > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-blue-500" />In Review ({project.taskStats?.in_review})</span>}
                              {doneTasks > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500" />Done ({doneTasks})</span>}
                            </div>
                          </>
                        ) : (
                          <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted" />
                        )}
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
        const data = await res.json()
        if (!res.ok) {
          throw new Error(data.error || 'Failed to load profile')
        }
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