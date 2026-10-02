'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  Camera, Trash2, Search, Eye, Download,
  Loader2, Image as ImageIcon, BarChart3, Users, Calendar,
  ArrowUpDown, Zap, Settings2, Save, Clock, Shield,
} from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { authFetch } from '@/lib/client-fetch'
import type { Screenshot } from '@/types'
import { formatRelativeTime, getInitials, getRoleBadgeClasses, formatDate } from '@/features/route-guard'
import { cn } from '@/lib/utils'
import { formatFileSize } from '@/lib/format'
import { fadeIn, staggerContainer } from '@/lib/animations'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
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

// ─── Animations imported from @/lib/animations ──────────

// ─── Helpers ─────────────────────────────────────────────
// formatFileSize imported from @/lib/format

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
  const [filterAuto, setFilterAuto] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewScreenshot, setPreviewScreenshot] = useState<Screenshot | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Screenshot | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [sortField, setSortField] = useState<SortField>('createdAt')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  // Screenshot config settings
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [configEnabled, setConfigEnabled] = useState(true)
  const [configInterval, setConfigInterval] = useState('5')
  const [savingConfig, setSavingConfig] = useState(false)

  const fetchScreenshots = useCallback(async () => {
    if (!user) return
    try {
      const res = await authFetch(`/api/screenshots`)
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

  // Fetch config on mount
  const fetchConfig = useCallback(async () => {
    if (!user) return
    try {
      const res = await authFetch(`/api/screenshot-config?userId=${user.id}`)
      if (res.ok) {
        const data = await res.json()
        if (data.isAdmin) {
          setConfigEnabled(data.autoEnabled)
          setConfigInterval(String(data.intervalMinutes))
        }
      }
    } catch {
      // silent
    }
  }, [user])

  useEffect(() => { fetchScreenshots(); fetchConfig() }, [fetchScreenshots, fetchConfig])

  // Save screenshot config
  const handleSaveConfig = async () => {
    if (!user) return
    setSavingConfig(true)
    try {
      const res = await authFetch('/api/screenshot-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          autoEnabled: configEnabled,
          intervalMinutes: Number(configInterval),
        }),
      })
      if (res.ok) {
        toast.success('Screenshot settings saved')
        setSettingsOpen(false)
      } else {
        toast.error('Failed to save settings')
      }
    } catch {
      toast.error('Failed to save settings')
    } finally {
      setSavingConfig(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget || !user) return
    setDeleting(true)
    try {
      const res = await authFetch(`/api/screenshots/${deleteTarget.id}`, { method: 'DELETE' })
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

  // Download screenshot
  const handleDownload = (ss: Screenshot) => {
    const link = document.createElement('a')
    link.href = ss.filePath
    link.download = `${ss.title || 'screenshot'}.png`
    link.click()
  }

  // Download all filtered screenshots
  const handleDownloadAll = () => {
    filtered.forEach((ss, i) => {
      setTimeout(() => handleDownload(ss), i * 300)
    })
    toast.info(`Downloading ${filtered.length} screenshots...`)
  }

  // Get unique users for filter
  const uniqueUsers = Array.from(
    new Map(screenshots.map(s => [s.userId, { id: s.userId, name: s.user?.name || 'Unknown', role: s.user?.role || '' }])).values()
  )

  // Group screenshots by date
  const groupedByDate: { date: string; label: string; screenshots: Screenshot[] }[] = []
  const filtered = screenshots
    .filter(s => {
      if (search.trim()) {
        const q = search.toLowerCase()
        if (!(s.title?.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q) || s.user?.name.toLowerCase().includes(q))) return false
      }
      if (filterRole !== 'all' && s.user?.role !== filterRole) return false
      if (filterUser !== 'all' && s.userId !== filterUser) return false
      if (filterAuto !== 'all') {
        if (filterAuto === 'auto' && !s.isAuto) return false
        if (filterAuto === 'manual' && s.isAuto) return false
      }
      return true
    })
    .sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1
      if (sortField === 'createdAt') return dir * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      if (sortField === 'fileSize') return dir * (a.fileSize - b.fileSize)
      if (sortField === 'userName') return dir * (a.user?.name || '').localeCompare(b.user?.name || '')
      return 0
    })

  filtered.forEach(ss => {
    const dateStr = new Date(ss.createdAt).toLocaleDateString()
    const last = groupedByDate[groupedByDate.length - 1]
    if (last && last.date === dateStr) {
      last.screenshots.push(ss)
    } else {
      const today = new Date().toDateString()
      const yesterday = new Date(Date.now() - 86400000).toDateString()
      let label = formatDate(ss.createdAt)
      if (new Date(ss.createdAt).toDateString() === today) label = 'Today'
      else if (new Date(ss.createdAt).toDateString() === yesterday) label = 'Yesterday'
      groupedByDate.push({ date: dateStr, label, screenshots: [ss] })
    }
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
  const autoCount = screenshots.filter(s => s.isAuto).length

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
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
          <p className="text-sm text-muted-foreground">View and manage all screenshot monitoring data</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Settings Button */}
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setSettingsOpen(true)}>
            <Settings2 className="w-4 h-4" />
            Settings
          </Button>
          {filtered.length > 0 && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleDownloadAll}>
              <Download className="w-4 h-4" />
              Download All
            </Button>
          )}
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
        </div>
      </motion.div>

      {/* Stats Cards */}
      <motion.div {...fadeIn} className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
        <Card>
          <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
            <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <ImageIcon className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-lg sm:text-xl font-bold">{screenshots.length}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Total</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
            <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
              <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="min-w-0">
              <p className="text-lg sm:text-xl font-bold">{todayCount}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Today</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
            <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
              <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="min-w-0">
              <p className="text-lg sm:text-xl font-bold">{thisWeekCount}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground truncate">This Week</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
            <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
              <Zap className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="min-w-0">
              <p className="text-lg sm:text-xl font-bold">{autoCount}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Auto-Captured</p>
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-2 sm:col-span-1">
          <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
            <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center shrink-0">
              <Users className="h-4 w-4 sm:h-5 sm:w-5 text-rose-600 dark:text-rose-400" />
            </div>
            <div className="min-w-0">
              <p className="text-lg sm:text-xl font-bold">{uniqueUsers.length}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Contributors</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Filters */}
      <motion.div {...fadeIn} className="flex flex-col sm:flex-row gap-2 sm:gap-3">
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
          <SelectTrigger className="h-9 w-32 sm:w-40">
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
          <SelectTrigger className="h-9 w-36 sm:w-44">
            <SelectValue placeholder="All Users" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Users</SelectItem>
            {uniqueUsers.map(u => (
              <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterAuto} onValueChange={setFilterAuto}>
          <SelectTrigger className="h-9 w-32">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="auto">Auto-Captured</SelectItem>
            <SelectItem value="manual">Manual</SelectItem>
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
        /* Grid View grouped by date */
        <div className="space-y-6">
          {groupedByDate.map(group => (
            <div key={group.date}>
              <div className="flex items-center gap-3 mb-3">
                <h3 className="text-sm font-semibold text-muted-foreground">{group.label}</h3>
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground">{group.screenshots.length} screenshot{group.screenshots.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {group.screenshots.map((ss) => (
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
                        {ss.isAuto && (
                          <Badge className="absolute top-2 right-2 text-[10px] bg-purple-500/90 text-white border-0 gap-1">
                            <Zap className="h-2.5 w-2.5" />
                            Auto
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
                              <DropdownMenuItem onClick={() => handleDownload(ss)}>
                                <Download className="w-4 h-4 mr-2" />Download
                              </DropdownMenuItem>
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
            </div>
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
                    <TableHead className="w-20"></TableHead>
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
                        {ss.isAuto && (
                          <Badge className="mt-1 text-[9px] bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400 border-0 gap-0.5 h-4 px-1">
                            <Zap className="h-2.5 w-2.5" />
                            Auto
                          </Badge>
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
                        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleDownload(ss)}
                          >
                            <Download className="w-3.5 h-3.5 text-muted-foreground" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => { setDeleteTarget(ss); setDeleteOpen(true) }}
                          >
                            <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Settings Dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="w-5 h-5" />
              Screenshot Monitoring Settings
            </DialogTitle>
            <DialogDescription>
              Configure automatic screenshot capture settings for all users. These settings apply globally when users clock in.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* Enable/Disable */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Camera className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <Label className="text-sm font-medium">Auto Screenshot Capture</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Automatically capture screenshots during active time-in sessions
                  </p>
                </div>
              </div>
              <Switch
                checked={configEnabled}
                onCheckedChange={setConfigEnabled}
              />
            </div>

            {/* Interval */}
            <div className={cn('rounded-lg border p-4 space-y-3', !configEnabled && 'opacity-50 pointer-events-none')}>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <Label className="text-sm font-medium">Capture Interval</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    How often to capture screenshots during a session
                  </p>
                </div>
              </div>
              <Select value={configInterval} onValueChange={setConfigInterval}>
                <SelectTrigger className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Every 1 minute</SelectItem>
                  <SelectItem value="3">Every 3 minutes</SelectItem>
                  <SelectItem value="5">Every 5 minutes</SelectItem>
                  <SelectItem value="10">Every 10 minutes</SelectItem>
                  <SelectItem value="15">Every 15 minutes</SelectItem>
                  <SelectItem value="30">Every 30 minutes</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                <Shield className="w-3.5 h-3.5 shrink-0" />
                <span>Screenshots are captured using the user&apos;s browser and stored securely. Only administrators can view all screenshots.</span>
              </div>
            </div>

            {/* Info cards */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-muted/50 p-3 text-center">
                <p className="text-lg font-bold">{screenshots.length}</p>
                <p className="text-[10px] text-muted-foreground">Total Stored</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3 text-center">
                <p className="text-lg font-bold">{formatFileSize(totalSize)}</p>
                <p className="text-[10px] text-muted-foreground">Storage Used</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3 text-center">
                <p className="text-lg font-bold">{uniqueUsers.length}</p>
                <p className="text-[10px] text-muted-foreground">Active Users</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettingsOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveConfig} disabled={savingConfig} className="gap-1.5">
              {savingConfig && <Loader2 className="w-4 h-4 animate-spin" />}
              <Save className="w-4 h-4" />
              Save Settings
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                  <span>{formatFileSize(previewScreenshot.fileSize)}</span>
                  <span>•</span>
                  <span>{formatDate(previewScreenshot.createdAt)}</span>
                  {previewScreenshot.isAuto && (
                    <>
                      <span>•</span>
                      <Badge className="text-[10px] bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400 border-0 gap-0.5 h-5 px-1.5">
                        <Zap className="h-2.5 w-2.5" />
                        Auto-Captured
                      </Badge>
                    </>
                  )}
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
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handleDownload(previewScreenshot)}>
                  <Download className="w-4 h-4" />
                  Download
                </Button>
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