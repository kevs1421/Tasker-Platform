'use client'

import { useState, useEffect, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { 
  X, CalendarIcon, MessageSquare, Plus, Trash2, 
  ArrowRight, Check, Circle, Clock, Eye, Send
} from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import type { Task, Comment, Subtask } from '@/types'
import { priorityConfig, getInitials } from './TaskCard'

interface TaskDetailProps {
  task: Task | null
  open: boolean
  onClose: () => void
  onUpdate: () => void
}

export function TaskDetail({ task, open, onClose, onUpdate }: TaskDetailProps) {
  const { user } = useAuthStore()
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [newSubtask, setNewSubtask] = useState('')
  const [addingSubtask, setAddingSubtask] = useState(false)
  const [dueDate, setDueDate] = useState<Date | undefined>(
    task?.dueDate ? new Date(task.dueDate) : undefined
  )
  const [dateOpen, setDateOpen] = useState(false)
  const prevTaskIdRef = useRef<string | null>(null)

  // Reset form state when task changes
  const currentTaskId = task?.id ?? null
  if (currentTaskId !== prevTaskIdRef.current) {
    prevTaskIdRef.current = currentTaskId
    setNewComment('')
    setNewSubtask('')
    setAddingSubtask(false)
    setDueDate(task?.dueDate ? new Date(task.dueDate) : undefined)
  }

  useEffect(() => {
    if (task?.id) {
      fetch(`/api/comments?taskId=${task.id}`)
        .then(r => r.json())
        .then(d => setComments(d.comments || []))
    }
  }, [task?.id])

  if (!task) return null

  const handleStatusChange = async (newStatus: string) => {
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        toast.success('Task status updated')
        onUpdate()
      }
    } catch {
      toast.error('Failed to update status')
    }
  }

  const handlePriorityChange = async (newPriority: string) => {
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority: newPriority }),
      })
      if (res.ok) {
        toast.success('Priority updated')
        onUpdate()
      }
    } catch {
      toast.error('Failed to update priority')
    }
  }

  const handleDateSelect = async (date: Date | undefined) => {
    setDueDate(date)
    setDateOpen(false)
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dueDate: date ? date.toISOString() : null }),
      })
      if (res.ok) {
        toast.success('Due date updated')
        onUpdate()
      }
    } catch {
      toast.error('Failed to update due date')
    }
  }

  const handleAddComment = async () => {
    if (!newComment.trim() || !user) return
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newComment, taskId: task.id, userId: user.id }),
      })
      if (res.ok) {
        const data = await res.json()
        setComments(prev => [...prev, data.comment])
        setNewComment('')
        toast.success('Comment added')
        onUpdate()
      }
    } catch {
      toast.error('Failed to add comment')
    }
  }

  const handleToggleSubtask = async (subtask: Subtask) => {
    try {
      const res = await fetch('/api/tasks/subtasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: subtask.id, completed: !subtask.completed }),
      })
      if (res.ok) {
        onUpdate()
      }
    } catch {
      toast.error('Failed to update subtask')
    }
  }

  const handleAddSubtask = async () => {
    if (!newSubtask.trim()) return
    try {
      const res = await fetch('/api/tasks/subtasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newSubtask, taskId: task.id }),
      })
      if (res.ok) {
        setNewSubtask('')
        setAddingSubtask(false)
        toast.success('Subtask added')
        onUpdate()
      }
    } catch {
      toast.error('Failed to add subtask')
    }
  }

  const handleDeleteTask = async () => {
    if (!confirm('Delete this task? This cannot be undone.')) return
    try {
      const res = await fetch(`/api/tasks/${task.id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Task deleted')
        onClose()
        onUpdate()
      }
    } catch {
      toast.error('Failed to delete task')
    }
  }

  const statusOptions = [
    { value: 'todo', label: 'To Do', icon: Circle },
    { value: 'in_progress', label: 'In Progress', icon: Clock },
    { value: 'in_review', label: 'In Review', icon: Eye },
    { value: 'done', label: 'Done', icon: Check },
  ]

  const currentStatus = statusOptions.find(s => s.value === task.status)
  const priority = priorityConfig[task.priority]

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <div className="flex items-start justify-between">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={`text-[10px] px-1.5 py-0 border-0 ${priority.color}`}>
                  {priority.label}
                </Badge>
                {task.tags && task.tags.split(',').filter(Boolean).map(tag => (
                  <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0 font-normal">
                    {tag.trim()}
                  </Badge>
                ))}
              </div>
              <DialogTitle className="text-xl">{task.title}</DialogTitle>
            </div>
            <Button variant="ghost" size="icon" className="shrink-0 -mt-1 -mr-2" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-120px)]">
          <div className="px-6 pb-6 space-y-6">
            {/* Status & Priority & Due Date */}
            <div className="flex flex-wrap items-center gap-3">
              <Select value={task.status} onValueChange={handleStatusChange}>
                <SelectTrigger className="w-40 h-8 text-xs">
                  {currentStatus && <currentStatus.icon className="w-3.5 h-3.5 mr-1.5" />}
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                      <div className="flex items-center gap-1.5">
                        <opt.icon className="w-3.5 h-3.5" />
                        {opt.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={task.priority} onValueChange={handlePriorityChange}>
                <SelectTrigger className="w-32 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(priorityConfig).map(([key, val]) => (
                    <SelectItem key={key} value={key} className="text-xs">{val.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Popover open={dateOpen} onOpenChange={setDateOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-xs">
                    <CalendarIcon className="w-3.5 h-3.5 mr-1.5" />
                    {dueDate ? format(dueDate, 'MMM d, yyyy') : 'Set due date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dueDate}
                    onSelect={handleDateSelect}
                    initialFocus
                  />
                  {dueDate && (
                    <div className="border-t p-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-xs text-destructive"
                        onClick={() => handleDateSelect(undefined)}
                      >
                        Remove date
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            </div>

            {/* Description */}
            {task.description && (
              <div className="text-sm text-muted-foreground leading-relaxed">
                {task.description}
              </div>
            )}

            {/* Subtasks */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  Subtasks
                  {task._count && task._count.subtasks > 0 && (
                    <span className="text-muted-foreground font-normal">
                      {task._count.completedSubtasks}/{task._count.subtasks}
                    </span>
                  )}
                </h4>
                {!addingSubtask ? (
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setAddingSubtask(true)}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add
                  </Button>
                ) : null}
              </div>

              {addingSubtask && (
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Subtask title..."
                    className="h-8 text-sm"
                    value={newSubtask}
                    onChange={e => setNewSubtask(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddSubtask()}
                    autoFocus
                  />
                  <Button size="sm" className="h-8" onClick={handleAddSubtask}>Add</Button>
                  <Button variant="ghost" size="sm" className="h-8" onClick={() => { setAddingSubtask(false); setNewSubtask('') }}>Cancel</Button>
                </div>
              )}

              {task.subtasks && task.subtasks.length > 0 ? (
                <div className="space-y-1">
                  {task.subtasks.map(subtask => (
                    <div key={subtask.id} className="flex items-center gap-3 group py-1">
                      <Checkbox
                        checked={subtask.completed}
                        onCheckedChange={() => handleToggleSubtask(subtask)}
                      />
                      <span className={`text-sm flex-1 ${subtask.completed ? 'line-through text-muted-foreground' : ''}`}>
                        {subtask.title}
                      </span>
                    </div>
                  ))}
                </div>
              ) : !addingSubtask ? (
                <p className="text-xs text-muted-foreground">No subtasks yet</p>
              ) : null}
            </div>

            <Separator />

            {/* Comments */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Comments ({comments.length})
              </h4>

              <div className="flex gap-2">
                <Avatar className="w-8 h-8 shrink-0">
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                    {user ? getInitials(user.name) : '?'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 flex gap-2">
                  <Textarea
                    placeholder="Write a comment..."
                    className="min-h-[60px] text-sm"
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        handleAddComment()
                      }
                    }}
                  />
                  <Button
                    size="icon"
                    className="shrink-0 self-end"
                    onClick={handleAddComment}
                    disabled={!newComment.trim()}
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {comments.length > 0 ? (
                <div className="space-y-3">
                  {comments.map(comment => (
                    <div key={comment.id} className="flex gap-3">
                      <Avatar className="w-7 h-7 shrink-0 mt-0.5">
                        <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                          {comment.user ? getInitials(comment.user.name) : '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{comment.user?.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(comment.createdAt), 'MMM d, h:mm a')}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5 whitespace-pre-wrap">{comment.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No comments yet. Start the conversation!</p>
              )}
            </div>

            <Separator />

            {/* Footer actions */}
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                Created {format(new Date(task.createdAt), 'MMM d, yyyy')}
                {task.creator && <span> by {task.creator.name}</span>}
              </div>
              <Button variant="ghost" size="sm" className="text-destructive h-8 text-xs" onClick={handleDeleteTask}>
                <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete task
              </Button>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}