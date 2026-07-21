'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  Camera, Trash2, Search, Eye, Download, Filter,
  Loader2, Image as ImageIcon, BarChart3, Users, Calendar,
  ChevronDown, ChevronUp, ArrowUpDown,
} from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import type { Screenshot } from '@/types'
import { formatRelativeTime, getInitials, getRoleBadgeClasses, formatDate } from '@/features/route-guard'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

// ─── Animations ──────────────────────────────────────────
const fadeIn = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.25 },
}
const staggerContainer = {
  initial: {},
  animate: { transition: { staggerChildren: 0.05 } },
}

// ─── Helpers ─────────────────────────────────────────────
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

type SortField = 'createdAt' | 'fileSize' | 'userName'
type SortDir = 'asc' | 'desc'

// ─── Admin Screenshot Report ─────────────────────────────
export function AdminScreenshotReport() {
  const { user } = useAuthStore()
  const [screenshots, setScreenshots] = useState<Screenshot[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState<string>('all')
  const [filterUser, setFilterUser] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewScreenshot, setPreviewScreenshot] = useState<Screenshot | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Screenshot | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [sortField, setSortField] = useState<SortField>('createdAt')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const fetchScreenshots = useCallback(async () => {
    if (!user) return
    try {
      const res = await fetch(`/api/screenshots?userId=${user.id}&admin=true`)
      if (res.ok) {
        const data = await res.json()
        setScreenshots(data.screenshots || [])
      }
    } catch {
      toast.error('Failed to load screenshot report')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { fetchScreenshots() }, [fetchScreenshots])

  const handleDelete = async () => {
    if (!deleteTarget || !user) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/screenshots/${deleteTarget.id}?userId=${user.id}&admin=true`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      toast.success('Screenshot deleted')
      setDeleteOpen(false)
      setDeleteTarget(null)
      fetchScreenshots()
    } catch {
      toast.error('Failed to delete screenshot')
    } finally {
      setDeleting(false)
    }
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  // Get unique users for filter
  const uniqueUsers = Array.from(
    new Map(screenshots.map(s => [s.userId, { id: s.userId, name: s.user?.name || 'Unknown', role: s.user?.role || '' }])).values()
  )

  // Filter and sort
  const filtered = screenshots
    .filter(s => {
      if (search.trim()) {
        const q = search.toLowerCase()
        if (!(s.title?.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q) || s.user?.name.toLowerCase().includes(q))) return false
      }
      if (filterRole !== 'all' && s.user?.role !== filterRole) return false
      if (filterUser !== 'all' && s.userId !== filterUser) return false
      return true
    })
    .sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1
      if (sortField === 'createdAt') return dir * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      if (sortField === 'fileSize') return dir * (a.fileSize - b.fileSize)
      if (sortField === 'userName') return dir * (a.user?.name || '').localeCompare(b.user?.name || '')
      return 0
    })

  // Stats
  const totalSize = screenshots.reduce((sum, s) => sum + s.fileSize, 0)
  const todayCount = screenshots.filter(s => {
    const today = new Date().toDateString()
    return new Date(s.createdAt).toDateString() === today
  }).length
  const thisWeekCount = screenshots.filter(s => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    return new Date(s.createdAt).getTime() > weekAgo
  }).length

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-52 rounded-lg" />)}
        </div>
      </div>
    )
  }

  return (
    <motion.div {...staggerContainer} initial="initial" animate="animate" className="space-y-4">
      {/* Header */}
      <motion.div {...fadeIn} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Camera className="w-5 h-5" />
            Screenshot Report
          </h2>
          <p className="text-sm text-muted-foreground">View all screenshots from team members</p>
        </div>
        <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
          <Button
            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 px-2.5 text-xs"
            onClick={() => setViewMode('grid')}
          >
            Grid
          </Button>
          <Button
            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 px-2.5 text-xs"
            onClick={() => setViewMode('list')}
          >
            List
          </Button>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <motion.div {...fadeIn} className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <ImageIcon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xl font-bold">{screenshots.length}</p>
              <p className="text-xs text-muted-foreground">Total Screenshots</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <Calendar className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-xl font-bold">{todayCount}</p>
              <p className="text-xs text-muted-foreground">Today</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <BarChart3 className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-xl font-bold">{thisWeekCount}</p>
              <p className="text-xs text-muted-foreground">This Week</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center">
              <Users className="h-5 w-5 text-rose-600 dark:text-rose-400" />
            </div>
            <div>
              <p className="text-xl font-bold">{uniqueUsers.length}</p>
              <p className="text-xs text-muted-foreground">Contributors</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Filters */}
      <motion.div {...fadeIn} className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by title, description, or user..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Select value={filterRole} onValueChange={setFilterRole}>
          <SelectTrigger className="h-9 w-40">
            <SelectValue placeholder="All Roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="team">Team</SelectItem>
            <SelectItem value="training">Training</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterUser} onValueChange={setFilterUser}>
          <SelectTrigger className="h-9 w-44">
            <SelectValue placeholder="All Users" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Users</SelectItem>
            {uniqueUsers.map(u => (
              <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </motion.div>

      {/* Results count */}
      <motion.div {...fadeIn} className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{filtered.length} screenshot{filtered.length !== 1 ? 's' : ''} found</span>
        <span>Total size: {formatFileSize(totalSize)}</span>
      </motion.div>

      {/* Empty state */}
      {filtered.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-16 text-center"
        >
          <div className="h-14 w-14 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
            <Camera className="h-7 w-7 text-slate-400" />
          </div>
          <h3 className="text-base font-semibold mb-1">No screenshots found</h3>
          <p className="text-sm text-muted-foreground max-w-sm">No screenshots match your current filters.</p>
        </motion.div>
      ) : viewMode === 'grid' ? (
        /* Grid View */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((ss) => (
            <motion.div key={ss.id} {...fadeIn}>
              <Card className="overflow-hidden group hover:shadow-md transition-shadow">
                <div
                  className="relative aspect-video bg-muted cursor-pointer overflow-hidden"
                  onClick={() => { setPreviewScreenshot(ss); setPreviewOpen(true) }}
                >
                  <img
                    src={ss.filePath}
                    alt={ss.title || 'Screenshot'}
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                    <Eye className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  {ss.project && (
                    <Badge className="absolute top-2 left-2 text-[10px]" style={{ backgroundColor: ss.project.color || '#f59e0b', color: '#fff' }}>
                      {ss.project.name}
                    </Badge>
                  )}
                </div>
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{ss.title || 'Untitled'}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        {ss.user && (
                          <div className="flex items-center gap-1.5">
                            <Avatar className="h-4 w-4">
                              <AvatarFallback className="text-[8px] bg-slate-200 dark:bg-slate-700">
                                {getInitials(ss.user.name)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-[11px] text-muted-foreground">{ss.user.name}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-muted-foreground">{formatFileSize(ss.fileSize)}</span>
                        <span className="text-[10px] text-muted-foreground">•</span>
                        <span className="text-[10px] text-muted-foreground">{formatRelativeTime(ss.createdAt)}</span>
                        {ss.user && (
                          <>
                            <span className="text-[10px] text-muted-foreground">•</span>
                            <Badge variant="secondary" className={cn('text-[9px] px-1 py-0 h-4', getRoleBadgeClasses(ss.user.role))}>
                              {ss.user.role}
                            </Badge>
                          </>
                        )}
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                          <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => { setDeleteTarget(ss); setDeleteOpen(true) }}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      ) : (
        /* List View */
        <Card>
          <CardContent className="p-0">
            <ScrollArea className="max-h-[600px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Preview</TableHead>
                    <TableHead>
                      <button onClick={() => handleSort('createdAt')} className="flex items-center gap-1 hover:text-foreground transition-colors">
                        Date
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>
                      <button onClick={() => handleSort('fileSize')} className="flex items-center gap-1 hover:text-foreground transition-colors">
                        Size
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((ss) => (
                    <TableRow key={ss.id} className="cursor-pointer" onClick={() => { setPreviewScreenshot(ss); setPreviewOpen(true) }}>
                      <TableCell>
                        <div className="h-10 w-16 rounded bg-muted overflow-hidden">
                          <img src={ss.filePath} alt="" className="w-full h-full object-cover" loading="lazy" />
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(ss.createdAt)}
                      </TableCell>
                      <TableCell>
                        <p className="text-sm font-medium truncate max-w-[200px]">{ss.title || 'Untitled'}</p>
                        {ss.description && (
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">{ss.description}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {ss.user && (
                            <Avatar className="h-6 w-6">
                              <AvatarFallback className="text-[9px] bg-slate-200 dark:bg-slate-700">
                                {getInitials(ss.user.name)}
                              </AvatarFallback>
                            </Avatar>
                          )}
                          <div>
                            <p className="text-sm">{ss.user?.name || 'Unknown'}</p>
                            {ss.user && (
                              <Badge variant="secondary" className={cn('text-[9px] px-1 py-0 h-4', getRoleBadgeClasses(ss.user.role))}>
                                {ss.user.role}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {ss.project ? (
                          <Badge variant="outline" className="text-[10px]" style={{ borderColor: ss.project.color || undefined }}>
                            {ss.project.name}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatFileSize(ss.fileSize)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => { e.stopPropagation(); setDeleteTarget(ss); setDeleteOpen(true) }}
                        >
                          <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {previewScreenshot?.title || 'Screenshot'}
            </DialogTitle>
            {previewScreenshot?.user && (
              <DialogDescription className="flex items-center gap-2">
                <Avatar className="h-5 w-5">
                  <AvatarFallback className="text-[9px] bg-slate-200 dark:bg-slate-700">
                    {getInitials(previewScreenshot.user.name)}
                  </AvatarFallback>
                </Avatar>
                <span>{previewScreenshot.user.name}</span>
                <Badge variant="secondary" className={cn('text-[9px] px-1 py-0 h-4', getRoleBadgeClasses(previewScreenshot.user.role))}>
                  {previewScreenshot.user.role}
                </Badge>
                <span>•</span>
                <span>{formatRelativeTime(previewScreenshot.createdAt)}</span>
              </DialogDescription>
            )}
          </DialogHeader>
          {previewScreenshot && (
            <div className="space-y-3">
              {previewScreenshot.description && (
                <p className="text-sm text-muted-foreground">{previewScreenshot.description}</p>
              )}
              <div className="rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                <img
                  src={previewScreenshot.filePath}
                  alt={previewScreenshot.title || 'Screenshot'}
                  className="max-w-full max-h-[60vh] object-contain"
                />
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                <span>{formatFileSize(previewScreenshot.fileSize)}</span>
                <span>•</span>
                <span>{formatDate(previewScreenshot.createdAt)}</span>
                {previewScreenshot.project && (
                  <>
                    <span>•</span>
                    <Badge variant="outline" style={{ borderColor: previewScreenshot.project.color || undefined }}>
                      {previewScreenshot.project.name}
                    </Badge>
                  </>
                )}
                {previewScreenshot.task && (
                  <>
                    <span>•</span>
                    <Badge variant="outline">Task: {previewScreenshot.task.title}</Badge>
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Screenshot</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.title || 'this screenshot'}&quot; uploaded by {deleteTarget?.user?.name || 'a user'}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  )
}