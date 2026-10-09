'use client'

import { useState, useRef } from 'react'
import { Camera, Loader2, Trash2 } from 'lucide-react'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { getInitials } from '@/features/route-guard'
import { cn } from '@/lib/utils'
import { authFetch } from '@/lib/client-fetch'

interface ProfileAvatarUploadProps {
  userId: string
  name: string
  avatar?: string | null
  size?: 'sm' | 'md' | 'lg'
  onAvatarChange?: (avatar: string | null) => void
}

const sizeClasses = {
  sm: 'h-12 w-12',
  md: 'h-20 w-20',
  lg: 'h-28 w-28',
}

const iconClasses = {
  sm: 'h-3.5 w-3.5',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
}

const cameraSize = {
  sm: 'h-3 w-3',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
}

export function ProfileAvatarUpload({ userId, name, avatar, size = 'md', onAvatarChange }: ProfileAvatarUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(avatar ?? null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be under 2MB')
      return
    }

    if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
      toast.error('Only JPEG, PNG, GIF, and WebP images are allowed')
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('avatar', file)
      formData.append('userId', userId)

      const res = await authFetch('/api/avatar', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Upload failed')
      }

      setPreview(data.avatar)
      onAvatarChange?.(data.avatar)
      toast.success('Profile image updated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to upload image')
    } finally {
      setUploading(false)
      // reset input so same file can be selected again
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const handleRemove = async () => {
    try {
      const res = await authFetch(`/api/avatar?userId=${userId}`, { method: 'DELETE' })
      if (res.ok) {
        setPreview(null)
        onAvatarChange?.(null)
        toast.success('Profile image removed')
      }
    } catch {
      toast.error('Failed to remove image')
    }
  }

  const currentAvatar = preview || avatar

  return (
    <div className="relative inline-flex group">
      <Avatar className={cn(sizeClasses[size], 'ring-2 ring-border transition-all group-hover:ring-primary/30')}
      >
        {currentAvatar && <AvatarImage src={currentAvatar} alt={name} className="object-cover" />}
        <AvatarFallback className={cn(
          'font-semibold transition-colors',
          size === 'sm' && 'text-xs bg-primary/10 text-primary',
          size === 'md' && 'text-xl bg-slate-200 dark:bg-slate-700',
          size === 'lg' && 'text-2xl bg-slate-200 dark:bg-slate-700',
        )}>
          {getInitials(name)}
        </AvatarFallback>
      </Avatar>

      {/* Upload overlay */}
      <button
        type="button"
        className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? (
          <Loader2 className={cn(cameraSize[size], 'text-white animate-spin')} />
        ) : currentAvatar ? (
          <div className="flex items-center gap-1">
            <Camera className={cn(cameraSize[size], 'text-white')} />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Trash2 className={cn(cameraSize[size], 'text-white')} onClick={(e) => e.stopPropagation()} />
              </AlertDialogTrigger>
              <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remove Avatar</AlertDialogTitle>
                  <AlertDialogDescription>Are you sure you want to remove your profile image?</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleRemove} className="bg-destructive text-white hover:bg-destructive/90">Remove</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        ) : (
          <Camera className={cn(cameraSize[size], 'text-white')} />
        )}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        className="hidden"
        onChange={handleUpload}
      />
    </div>
  )
}
