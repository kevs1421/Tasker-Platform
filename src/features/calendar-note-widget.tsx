'use client'

import { useState, useEffect, useCallback } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday, addMonths, subMonths } from 'date-fns'
import { CalendarIcon, Trash2, ChevronLeft, ChevronRight, StickyNote } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { CalendarNote } from '@/types'

const NOTE_COLORS = [
  { value: '#f59e0b', label: 'Amber' },
  { value: '#ef4444', label: 'Red' },
  { value: '#22c55e', label: 'Green' },
  { value: '#3b82f6', label: 'Blue' },
  { value: '#a855f7', label: 'Purple' },
  { value: '#ec4899', label: 'Pink' },
]

interface CalendarNoteWidgetProps {
  userId: string
}

export function CalendarNoteWidget({ userId }: CalendarNoteWidgetProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [notes, setNotes] = useState<CalendarNote[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [noteColor, setNoteColor] = useState('#f59e0b')
  const [editingNote, setEditingNote] = useState<CalendarNote | null>(null)
  const [saving, setSaving] = useState(false)

  const monthStr = format(currentMonth, 'yyyy-MM')

  const fetchNotes = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/calendar-notes?month=${monthStr}&userId=${userId}`)
      if (res.ok) {
        const data = await res.json()
        setNotes(data)
      }
    } catch {
      // silent fail
    } finally {
      setLoading(false)
    }
  }, [monthStr])

  useEffect(() => {
    fetchNotes()
  }, [fetchNotes])

  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  })

  const getNotesForDay = (day: Date) => {
    const dateStr = format(day, 'yyyy-MM-dd')
    return notes.filter((n) => n.date === dateStr)
  }

  const handleDayClick = (day: Date) => {
    setSelectedDate(day)
    setEditingNote(null)
    setNoteText('')
    setNoteColor('#f59e0b')
    setDialogOpen(true)
  }

  const handleEditNote = (note: CalendarNote, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingNote(note)
    setNoteText(note.content)
    setNoteColor(note.color)
    setDialogOpen(true)
  }

  const handleSaveNote = async () => {
    if (!noteText.trim()) return
    if (!selectedDate && !editingNote) return

    setSaving(true)
    try {
      if (editingNote) {
        const res = await fetch('/api/calendar-notes', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingNote.id, userId, content: noteText, color: noteColor }),
        })
        if (res.ok) {
          toast.success('Note updated')
        } else {
          toast.error('Failed to update note')
        }
      } else {
        const dateStr = format(selectedDate!, 'yyyy-MM-dd')
        const res = await fetch('/api/calendar-notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, date: dateStr, content: noteText, color: noteColor }),
        })
        if (res.ok) {
          toast.success('Note added')
        } else {
          toast.error('Failed to add note')
        }
      }
      setDialogOpen(false)
      fetchNotes()
    } catch {
      toast.error('Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteNote = async (noteId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const res = await fetch(`/api/calendar-notes/${noteId}?userId=${userId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        toast.success('Note deleted')
        fetchNotes()
        // close dialog if deleting the note being edited
        if (editingNote?.id === noteId) {
          setDialogOpen(false)
        }
      }
    } catch {
      toast.error('Failed to delete note')
    }
  }

  return (
    <div className="mb-3">
      {/* Calendar Header */}
      <div className="flex items-center justify-between px-1 mb-2">
        <div className="flex items-center gap-1.5">
          <CalendarIcon className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-medium">Notes</span>
        </div>
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
            <ChevronLeft className="w-3 h-3" />
          </Button>
          <span className="text-[11px] font-medium w-14 text-center tabular-nums">
            {format(currentMonth, 'MMM yyyy')}
          </span>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
            <ChevronRight className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Day Labels */}
      <div className="grid grid-cols-7 gap-px mb-1 px-0.5">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
          <div key={d} className="text-[9px] text-muted-foreground text-center font-medium py-0.5">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-px px-0.5">
        {days.map((day) => {
          const dayNotes = getNotesForDay(day)
          const hasNotes = dayNotes.length > 0
          const today = isToday(day)

          return (
            <button
              key={day.toISOString()}
              className={cn(
                'relative h-6 w-full text-[10px] rounded-sm transition-colors hover:bg-accent flex items-center justify-center',
                today && 'bg-primary text-primary-foreground hover:bg-primary/90 font-bold'
              )}
              onClick={() => handleDayClick(day)}
            >
              {format(day, 'd')}
              {hasNotes && !today && (
                <span
                  className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: dayNotes[0].color }}
                />
              )}
            </button>
          )
        })}
      </div>

      {/* Today's Notes Preview */}
      {(() => {
        const todayNotes = getNotesForDay(new Date())
        if (todayNotes.length === 0) return null
        return (
          <div className="mt-2 space-y-1">
            <div className="text-[10px] text-muted-foreground font-medium px-1">Today</div>
            {todayNotes.slice(0, 2).map((note) => (
              <div
                key={note.id}
                className="flex items-start gap-1.5 group cursor-pointer rounded px-1.5 py-1 hover:bg-accent/50"
                onClick={() => handleEditNote(note, { stopPropagation: () => {} } as React.MouseEvent)}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full mt-1 shrink-0"
                  style={{ backgroundColor: note.color }}
                />
                <span className="text-[11px] leading-tight line-clamp-2 flex-1">{note.content}</span>
              </div>
            ))}
            {todayNotes.length > 2 && (
              <span className="text-[10px] text-muted-foreground px-1">+{todayNotes.length - 2} more</span>
            )}
          </div>
        )
      })()}

      {/* Add/Edit Note Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <StickyNote className="w-4 h-4" />
              {editingNote ? 'Edit Note' : selectedDate ? `Note for ${format(selectedDate, 'MMM dd, yyyy')}` : 'Add Note'}
            </DialogTitle>
            <DialogDescription>
              {editingNote ? 'Update your note below.' : 'Write a note for this date.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <Textarea
              placeholder="Write your note here..."
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              rows={4}
              className="resize-none"
              autoFocus
            />

            {/* Color Picker */}
            <div>
              <span className="text-xs text-muted-foreground mb-2 block">Color</span>
              <div className="flex gap-2">
                {NOTE_COLORS.map((c) => (
                  <button
                    key={c.value}
                    className={cn(
                      'w-6 h-6 rounded-full transition-all border-2',
                      noteColor === c.value ? 'border-foreground scale-110' : 'border-transparent hover:scale-105'
                    )}
                    style={{ backgroundColor: c.value }}
                    onClick={() => setNoteColor(c.value)}
                    aria-label={c.label}
                  />
                ))}
              </div>
            </div>

            {/* Existing notes for this date */}
            {selectedDate && !editingNote && (() => {
              const existingNotes = getNotesForDay(selectedDate)
              if (existingNotes.length === 0) return null
              return (
                <div>
                  <Separator className="mb-2" />
                  <span className="text-xs text-muted-foreground mb-1.5 block">Existing notes</span>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto">
                    {existingNotes.map((n) => (
                      <div
                        key={n.id}
                        className="flex items-start gap-2 group rounded-md border p-2 hover:bg-accent/30"
                      >
                        <span
                          className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                          style={{ backgroundColor: n.color }}
                        />
                        <p className="text-xs flex-1 leading-relaxed whitespace-pre-wrap">{n.content}</p>
                        <div className="flex gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5"
                            onClick={(e) => handleEditNote(n, e)}
                          >
                            <Pencil className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 text-destructive hover:text-destructive"
                            onClick={(e) => handleDeleteNote(n.id, e)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}
          </div>

          <DialogFooter className="gap-2">
            {editingNote && (
              <Button
                variant="destructive"
                size="sm"
                onClick={(e) => handleDeleteNote(editingNote.id, e)}
                className="mr-auto"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" />
                Delete
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSaveNote} disabled={!noteText.trim() || saving}>
              {saving ? 'Saving...' : editingNote ? 'Update' : 'Save Note'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Pencil({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  )
}
