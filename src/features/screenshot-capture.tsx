'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  Camera, Upload, Trash2, Eye,
  Loader2, Search,
} from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { authFetch } from '@/lib/client-fetch'
import type { Screenshot } from '@/types'
import { formatRelativeTime } from '@/features/route-guard'
import { cn } from '@/lib/utils'
import { formatFileSize } from '@/lib/format'
import { fadeIn, staggerContainer } from '@/lib/animations'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// ─── Animations imported from @/lib/animations ──────────

// ─── Helpers imported from @/lib/format ──────────────────

// ─── Team Screenshot Capture (team + training see only their own) ─────────
export function TeamScreenshots() {
  const { user } = useAuthStore()
  const [screenshots, setScreenshots] = useState<Screenshot[]>([])
  const [loading, setLoading] = useState(true)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewScreenshot, setPreviewScreenshot] = useState<Screenshot | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Screenshot | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [search, setSearch] = useState('')

  // Upload form
  const [uploading, setUploading] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [filePreview, setFilePreview] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const fetchScreenshots = useCallback(async () => {
    if (!user) return
    try {
      const res = await authFetch(`/api/screenshots`)
      if (res.ok) {
        const data = await res.json()
        setScreenshots(data.screenshots || [])
      }
    } catch {
      toast.error('Failed to load screenshots')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { fetchScreenshots() }, [fetchScreenshots])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.type.startsWith('image/')) {
      toast.error('Only image files are allowed')
      return
    }
    if (f.size > 20 * 1024 * 1024) {
      toast.error('File too large (max 20MB)')
      return
    }
    setFile(f)
    setTitle(f.name.replace(/\.[^.]+$/, ''))
    const reader = new FileReader()
    reader.onload = () => setFilePreview(reader.result as string)
    reader.readAsDataURL(f)
  }

  const handleUpload = async () => {
    if (!file || !user) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      if (title.trim()) formData.append('title', title.trim())
      if (description.trim()) formData.append('description', description.trim())

      const res = await authFetch('/api/screenshots', {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Upload failed')
      }
      toast.success('Screenshot uploaded')
      setUploadOpen(false)
      setFile(null)
      setFilePreview(null)
      setTitle('')
      setDescription('')
      fetchScreenshots()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
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

  const filtered = screenshots.filter(s => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      s.title?.toLowerCase().includes(q) ||
      s.description?.toLowerCase().includes(q) ||
      s.user?.name.toLowerCase().includes(q)
    )
  })

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-52 rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <motion.div {...staggerContainer} initial="initial" animate="animate" className="space-y-4">
      {/* Header */}
      <motion.div {...fadeIn} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Screenshots</h2>
          <p className="text-sm text-muted-foreground">Capture and manage your work screenshots</p>
        </div>
        <Button onClick={() => setUploadOpen(true)} className="gap-2">
          <Camera className="w-4 h-4" />
          Capture Screenshot
        </Button>
      </motion.div>

      {/* Search */}
      <motion.div {...fadeIn} className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search screenshots..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9"
        />
      </motion.div>

      {/* Screenshot Grid */}
      {filtered.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-16 text-center"
        >
          <div className="h-14 w-14 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
            <Camera className="h-7 w-7 text-slate-400" />
          </div>
          <h3 className="text-base font-semibold mb-1">No screenshots yet</h3>
          <p className="text-sm text-muted-foreground max-w-sm">Capture your first screenshot to start building your visual work log.</p>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((ss) => (
            <motion.div key={ss.id} {...fadeIn}>
              <Card className="overflow-hidden group hover:shadow-md transition-shadow">
                {/* Thumbnail */}
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
                {/* Info */}
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{ss.title || 'Untitled'}</p>
                      {ss.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{ss.description}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[10px] text-muted-foreground">{formatFileSize(ss.fileSize)}</span>
                        <span className="text-[10px] text-muted-foreground">•</span>
                        <span className="text-[10px] text-muted-foreground">{formatRelativeTime(ss.createdAt)}</span>
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
      )}

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={(open) => {
        setUploadOpen(open)
        if (!open) { setFile(null); setFilePreview(null); setTitle(''); setDescription('') }
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="w-5 h-5" />
              Capture Screenshot
            </DialogTitle>
            <DialogDescription>Upload a screenshot to document your work progress.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* File drop zone */}
            <div
              className={cn(
                'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors',
                filePreview ? 'border-primary/50 bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'
              )}
              onClick={() => fileRef.current?.click()}
            >
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
              {filePreview ? (
                <div className="space-y-3">
                  <img src={filePreview} alt="Preview" className="max-h-48 mx-auto rounded-md object-contain" />
                  <p className="text-sm text-muted-foreground">{file?.name} ({formatFileSize(file?.size || 0)})</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="w-8 h-8 mx-auto text-muted-foreground" />
                  <p className="text-sm font-medium">Click to select an image</p>
                  <p className="text-xs text-muted-foreground">PNG, JPG, GIF, WebP up to 20MB</p>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Title</Label>
              <Input
                placeholder="Screenshot title..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Description (optional)</Label>
              <Textarea
                placeholder="Add context about this screenshot..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)}>Cancel</Button>
            <Button onClick={handleUpload} disabled={!file || uploading} className="gap-2">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uploading ? 'Uploading...' : 'Upload'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{previewScreenshot?.title || 'Screenshot'}</DialogTitle>
            {previewScreenshot?.description && (
              <DialogDescription>{previewScreenshot.description}</DialogDescription>
            )}
          </DialogHeader>
          {previewScreenshot && (
            <div className="space-y-3">
              <div className="rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                <img
                  src={previewScreenshot.filePath}
                  alt={previewScreenshot.title || 'Screenshot'}
                  className="max-w-full max-h-[60vh] object-contain"
                />
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{formatFileSize(previewScreenshot.fileSize)} • {formatRelativeTime(previewScreenshot.createdAt)}</span>
                {previewScreenshot.project && (
                  <Badge variant="secondary" className="text-[10px]">{previewScreenshot.project.name}</Badge>
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
              Are you sure you want to delete &quot;{deleteTarget?.title || 'this screenshot'}&quot;? This action cannot be undone.
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
