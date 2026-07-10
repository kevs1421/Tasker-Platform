'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { format, isPast, isToday, differenceInDays } from 'date-fns'
import { MessageSquare, Paperclip, Calendar, GripVertical } from 'lucide-react'
import type { Task, User } from '@/types'

const priorityConfig = {
  urgent: { label: 'Urgent', color: 'bg-red-500 text-white' },
  high: { label: 'High', color: 'bg-orange-500 text-white' },
  medium: { label: 'Medium', color: 'bg-yellow-500 text-white' },
  low: { label: 'Low', color: 'bg-slate-400 text-white' },
}

const statusColors: Record<string, string> = {
  todo: 'border-l-slate-400',
  in_progress: 'border-l-amber-500',
  in_review: 'border-l-purple-500',
  done: 'border-l-emerald-500',
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

function DueDateBadge({ dueDate }: { dueDate: string | null }) {
  if (!dueDate) return null
  const date = new Date(dueDate)
  const past = isPast(date) && !isToday(date)
  const today = isToday(date)
  const daysLeft = differenceInDays(date, new Date())

  return (
    <div className={`flex items-center gap-1 text-xs ${past ? 'text-destructive' : today ? 'text-amber-600' : 'text-muted-foreground'}`}>
      <Calendar className="w-3 h-3" />
      <span>{today ? 'Today' : past ? `${Math.abs(daysLeft)}d overdue` : format(date, 'MMM d')}</span>
    </div>
  )
}

interface TaskCardProps {
  task: Task
  onClick: (task: Task) => void
  dragHandleProps?: Record<string, unknown>
  compact?: boolean
}

export function TaskCard({ task, onClick, compact = false }: TaskCardProps) {
  const priority = priorityConfig[task.priority]

  return (
    <Card
      className={`border-l-4 ${statusColors[task.status] || 'border-l-slate-300'} cursor-pointer hover:shadow-md transition-all duration-200 group ${compact ? 'p-3' : 'p-4'}`}
      onClick={() => onClick(task)}
    >
      <CardContent className={`p-0 space-y-2.5 ${compact ? '' : ''}`}>
        {/* Tags */}
        {task.tags && (
          <div className="flex flex-wrap gap-1">
            {task.tags.split(',').filter(Boolean).map((tag) => (
              <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0 font-normal">
                {tag.trim()}
              </Badge>
            ))}
          </div>
        )}

        {/* Title */}
        <h4 className={`font-medium text-sm leading-snug ${task.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>
          {task.title}
        </h4>

        {/* Footer */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2">
            {task.dueDate && <DueDateBadge dueDate={task.dueDate} />}
            {task._count && task._count.comments > 0 && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <MessageSquare className="w-3 h-3" />
                <span>{task._count.comments}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge className={`text-[10px] px-1.5 py-0 border-0 ${priority.color}`}>
                    {priority.label}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>Priority: {priority.label}</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {task.assignees && task.assignees.length > 0 && (
              <div className="flex -space-x-1.5">
                {task.assignees.slice(0, 3).map((assignment) => (
                  <Avatar key={assignment.userId} className="w-6 h-6 border-2 border-background">
                    <AvatarFallback className="text-[9px] bg-primary/10 text-primary">
                      {assignment.user ? getInitials(assignment.user.name) : '?'}
                    </AvatarFallback>
                  </Avatar>
                ))}
                {task.assignees.length > 3 && (
                  <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[9px] font-medium border-2 border-background">
                    +{task.assignees.length - 3}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export { priorityConfig, getInitials, DueDateBadge, statusColors }