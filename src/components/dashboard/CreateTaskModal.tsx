'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { toast } from 'sonner'
import { CalendarIcon, X, Users, Check } from 'lucide-react'
import { format } from 'date-fns'
import { useAuthStore } from '@/stores/auth'
import type { User } from '@/types'
import { getInitials } from './TaskCard'
import { cn } from '@/lib/utils'

interface CreateTaskModalProps {
  open: boolean
  onClose: () => void
  projectId: string
  projectMembers?: (User & { _pivot_role?: string })[]
  onCreated: () => void
}

export function CreateTaskModal({ open, onClose, projectId, projectMembers, onCreated }: CreateTaskModalProps) {
  const { user } = useAuthStore()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('medium')
  const [status, setStatus] = useState('todo')
  const [dueDate, setDueDate] = useState<Date | undefined>()
  const [tags, setTags] = useState('')
  const [assigneeIds, setAssigneeIds] = useState<string[]>([])
  const [dateOpen, setDateOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [availableMembers, setAvailableMembers] = useState<User[]>([])

  // Fetch all team/admin users for assignee selection
  useEffect(() => {
    if (open) {
      if (projectMembers && projectMembers.length > 0) {
        setAvailableMembers(projectMembers)
      } else {
        fetch('/api/users')
          .then(r => r.json())
          .then(d => {
            const members = (d.users || []).filter((u: User) => u.role === 'team' || u.role === 'admin')
            setAvailableMembers(members)
          })
          .catch(() => {})
      }
    }
  }, [open, projectMembers])

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error('Task title is required')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          priority,
          status,
          dueDate: dueDate ? dueDate.toISOString() : null,
          projectId,
          createdById: user?.id,
          assigneeIds,
          tags: tags.trim(),
        }),
      })
      if (res.ok) {
        toast.success('Task created!')
        resetForm()
        onCreated()
        onClose()
      } else {
        const data = await res.json()
        throw new Error(data.error)
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create task')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setTitle('')
    setDescription('')
    setPriority('medium')
    setStatus('todo')
    setDueDate(undefined)
    setTags('')
    setAssigneeIds([])
  }

  const toggleAssignee = (id: string) => {
    setAssigneeIds(prev => prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id])
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { resetForm(); onClose() } }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create New Task</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="task-title">Title *</Label>
            <Input
              id="task-title"
              placeholder="What needs to be done?"
              value={title}
              onChange={e => setTitle(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-desc">Description</Label>
            <Textarea
              id="task-desc"
              placeholder="Add more detail..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
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
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Popover open={dateOpen} onOpenChange={setDateOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full h-9 justify-start text-sm font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dueDate ? format(dueDate, 'MMM d, yyyy') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dueDate} onSelect={(d) => { setDueDate(d); setDateOpen(false) }} initialFocus />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Tags</Label>
              <Input
                placeholder="frontend, urgent"
                value={tags}
                onChange={e => setTags(e.target.value)}
                className="h-9"
              />
            </div>
          </div>

          {availableMembers.length > 0 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                Assignees ({assigneeIds.length} selected)
              </Label>
              <div className="max-h-32 overflow-y-auto rounded-md border p-1.5 space-y-0.5">
                {availableMembers.map(member => {
                  const isSelected = assigneeIds.includes(member.id)
                  return (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => toggleAssignee(member.id)}
                      className={cn(
                        'w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-left text-sm transition-colors cursor-pointer',
                        isSelected ? 'bg-primary/5' : 'hover:bg-accent'
                      )}
                    >
                      <Avatar className="w-6 h-6 shrink-0">
                        <AvatarFallback className="text-[9px] bg-primary/10 text-primary">
                          {getInitials(member.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="flex-1 truncate">{member.name}</span>
                      <span className="text-[10px] text-muted-foreground uppercase">{member.role}</span>
                      {isSelected ? (
                        <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center shrink-0">
                          <Check className="w-2.5 h-2.5 text-primary-foreground" />
                        </div>
                      ) : (
                        <div className="w-4 h-4 rounded-full border border-muted shrink-0" />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => { resetForm(); onClose() }}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={loading || !title.trim()}>
              {loading ? 'Creating...' : 'Create Task'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}