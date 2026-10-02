'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday, addMonths, subMonths, startOfWeek, endOfWeek, isSameDay, isSameMonth, parseISO } from 'date-fns'
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Trash2, Pencil, StickyNote } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth'
import { authFetch } from '@/lib/client-fetch'
import type { CalendarNote } from '@/types'
import { motion, AnimatePresence } from 'framer-motion'

const NOTE_COLORS = [
  { value: '#f59e0b', label: 'Amber' },
  { value: '#ef4444', label: 'Red' },
  { value: '#22c55e', label: 'Green' },
  { value: '#3b82f6', label: 'Blue' },
  { value: '#a855f7', label: 'Purple' },
  { value: '#ec4899', label: 'Pink' },
]

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function CalendarNotesDashboard() {
  const user = useAuthStore((s) => s.user)
  const userId = user?.id ?? ''

  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [notes, setNotes] = useState<CalendarNote[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [noteColor, setNoteColor] = useState('#f59e0b')
  const [editingNote, setEditingNote] = useState<CalendarNote | null>(null)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const monthStr = format(currentMonth, 'yyyy-MM')

  const fetchNotes = useCallback(async () => {
    if (!userId) return
    try {
      setLoading(true)
      const res = await authFetch(`/api/calendar-notes?month=${monthStr}&userId=${userId}`)
      if (res.ok) {
        const data = await res.json()
        setNotes(data)
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [monthStr, userId])

  useEffect(() => {
    fetchNotes()
  }, [fetchNotes])

  // Calendar grid: include leading/trailing days for a full 6-week grid
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(currentMonth)
    const calStart = startOfWeek(monthStart)
    const calEnd = endOfWeek(monthEnd)
    return eachDayOfInterval({ start: calStart, end: calEnd })
  }, [currentMonth])

  const notesByDate = useMemo(() => {
    const map = new Map<string, CalendarNote[]>()
    notes.forEach((n) => {
      const list = map.get(n.date) || []
      list.push(n)
      map.set(n.date, list)
    })
    return map
  }, [notes])

  const selectedDateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null
  const selectedDayNotes = selectedDateStr ? (notesByDate.get(selectedDateStr) ?? []) : []

  // All notes for the month sorted by date desc for the list
  const allMonthNotes = useMemo(() => {
    return [...notes].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
  }, [notes])

  const getNotesForDay = (day: Date) => {
    return notesByDate.get(format(day, 'yyyy-MM-dd')) ?? []
  }

  const handleDayClick = (day: Date) => {
    setSelectedDate(day)
  }

  const handleAddNote = () => {
    if (!selectedDate) return
    setEditingNote(null)
    setNoteText('')
    setNoteColor('#f59e0b')
    setDialogOpen(true)
  }

  const handleEditNote = (note: CalendarNote) => {
    setEditingNote(note)
    setNoteText(note.content)
    setNoteColor(note.color)
    setDialogOpen(true)
  }

  const handleSaveNote = async () => {
    if (!noteText.trim()) return

    setSaving(true)
    try {
      if (editingNote) {
        const res = await authFetch('/api/calendar-notes', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingNote.id, userId, content: noteText, color: noteColor }),
        })
        if (res.ok) toast.success('Note updated')
        else toast.error('Failed to update note')
      } else {
        const dateStr = format(selectedDate!, 'yyyy-MM-dd')
        const res = await authFetch('/api/calendar-notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, date: dateStr, content: noteText, color: noteColor }),
        })
        if (res.ok) toast.success('Note added')
        else toast.error('Failed to add note')
      }
      setDialogOpen(false)
      fetchNotes()
    } catch {
      toast.error('Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteNote = async (noteId: string) => {
    setDeletingId(noteId)
    try {
      const res = await authFetch(`/api/calendar-notes/${noteId}?userId=${userId}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Note deleted')
        fetchNotes()
        if (editingNote?.id === noteId) setDialogOpen(false)
      }
    } catch {
      toast.error('Failed to delete note')
    } finally {
      setDeletingId(null)
    }
  }

  const todayNoteCount = getNotesForDay(new Date()).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Calendar Notes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Organize your notes by date. Click a day to view or add notes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {todayNoteCount > 0 && (
            <Badge variant="secondary" className="gap-1">
              <StickyNote className="w-3 h-3" />
              {todayNoteCount} note{todayNoteCount !== 1 ? 's' : ''} today
            </Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Calendar */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <CalendarDays className="w-5 h-5" />
                {format(currentMonth, 'MMMM yyyy')}
              </CardTitle>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" className="h-8 px-3" onClick={() => { setCurrentMonth(new Date()); setSelectedDate(new Date()) }}>
                  Today
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Day Labels */}
            <div className="grid grid-cols-7 mb-1">
              {DAY_LABELS.map((d) => (
                <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">
                  {d}
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 border-t border-l">
              {calendarDays.map((day) => {
                const dayNotes = getNotesForDay(day)
                const hasNotes = dayNotes.length > 0
                const today = isToday(day)
                const inMonth = isSameMonth(day, currentMonth)
                const isSelected = selectedDate && isSameDay(day, selectedDate)

                return (
                  <button
                    key={day.toISOString()}
                    className={cn(
                      'relative min-h-[72px] sm:min-h-[80px] p-1.5 border-r border-b text-left transition-colors hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-primary/20',
                      !inMonth && 'bg-muted/30',
                      isSelected && 'bg-primary/5 ring-2 ring-primary/30 ring-inset',
                    )}
                    onClick={() => handleDayClick(day)}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={cn(
                          'text-sm font-medium inline-flex items-center justify-center w-7 h-7 rounded-full',
                          today && 'bg-primary text-primary-foreground',
                          !today && !inMonth && 'text-muted-foreground/50',
                        )}
                      >
                        {format(day, 'd')}
                      </span>
                      {hasNotes && (
                        <span className="text-[10px] text-muted-foreground font-medium">
                          {dayNotes.length}
                        </span>
                      )}
                    </div>

                    {/* Note indicators */}
                    {hasNotes && (
                      <div className="mt-0.5 space-y-0.5">
                        {dayNotes.slice(0, 2).map((n) => (
                          <div
                            key={n.id}
                            className="text-[10px] leading-tight truncate rounded px-1 py-0.5 text-white"
                            style={{ backgroundColor: n.color }}
                          >
                            {n.content}
                          </div>
                        ))}
                        {dayNotes.length > 2 && (
                          <span className="text-[10px] text-muted-foreground pl-1">
                            +{dayNotes.length - 2} more
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Right: Selected Day Notes + Note List */}
        <div className="space-y-4">
          {/* Selected Day Panel */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  {selectedDate
                    ? isToday(selectedDate)
                      ? 'Today'
                      : format(selectedDate, 'EEEE, MMM dd')
                    : 'Select a Day'}
                </CardTitle>
                {selectedDate && (
                  <Button size="sm" className="h-7 gap-1" onClick={handleAddNote}>
                    <Plus className="w-3.5 h-3.5" />
                    Add
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {!selectedDate ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Click a day on the calendar to view notes
                </p>
              ) : selectedDayNotes.length === 0 ? (
                <div className="text-center py-8">
                  <StickyNote className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">No notes for this day</p>
                  <Button variant="link" size="sm" className="mt-1" onClick={handleAddNote}>
                    Add one
                  </Button>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  <AnimatePresence>
                    {selectedDayNotes.map((note) => (
                      <motion.div
                        key={note.id}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="group rounded-lg border p-3 hover:shadow-sm transition-shadow"
                      >
                        <div className="flex items-start gap-2">
                          <span
                            className="w-3 h-3 rounded-full mt-0.5 shrink-0"
                            style={{ backgroundColor: note.color }}
                          />
                          <p className="text-sm leading-relaxed whitespace-pre-wrap flex-1">
                            {note.content}
                          </p>
                          <div className="flex gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => handleEditNote(note)}
                            >
                              <Pencil className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-destructive hover:text-destructive"
                              onClick={() => handleDeleteNote(note.id)}
                              disabled={deletingId === note.id}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1.5 pl-5">
                          {format(parseISO(note.updatedAt), 'hh:mm a')}
                        </p>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </CardContent>
          </Card>

          {/* All Notes This Month */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <StickyNote className="w-4 h-4" />
                All Notes
                <Badge variant="secondary" className="ml-auto text-xs">
                  {allMonthNotes.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full rounded-lg" />
                  ))}
                </div>
              ) : allMonthNotes.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No notes this month
                </p>
              ) : (
                <ScrollArea className="max-h-[300px]">
                  <div className="space-y-2 pr-2">
                    {allMonthNotes.map((note) => (
                      <button
                        key={note.id}
                        className="w-full text-left rounded-lg border p-3 hover:shadow-sm transition-shadow group"
                        onClick={() => setSelectedDate(parseISO(note.date))}
                      >
                        <div className="flex items-start gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full mt-1 shrink-0"
                            style={{ backgroundColor: note.color }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm truncate">{note.content}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              {format(parseISO(note.date), 'MMM dd, yyyy')}
                            </p>
                          </div>
                          <div className="flex gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={(e) => { e.stopPropagation(); handleEditNote(note) }}
                            >
                              <Pencil className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-destructive hover:text-destructive"
                              onClick={(e) => { e.stopPropagation(); handleDeleteNote(note.id) }}
                              disabled={deletingId === note.id}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add/Edit Note Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <StickyNote className="w-4 h-4" />
              {editingNote
                ? 'Edit Note'
                : selectedDate
                  ? `Note for ${format(selectedDate, 'MMM dd, yyyy')}`
                  : 'Add Note'}
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

            <div>
              <span className="text-xs text-muted-foreground mb-2 block">Color</span>
              <div className="flex gap-2.5">
                {NOTE_COLORS.map((c) => (
                  <button
                    key={c.value}
                    className={cn(
                      'w-7 h-7 rounded-full transition-all border-2',
                      noteColor === c.value ? 'border-foreground scale-110' : 'border-transparent hover:scale-105'
                    )}
                    style={{ backgroundColor: c.value }}
                    onClick={() => setNoteColor(c.value)}
                    aria-label={c.label}
                  />
                ))}
              </div>
            </div>

            {/* Existing notes for this date (when adding new) */}
            {selectedDate && !editingNote && (() => {
              const existing = getNotesForDay(selectedDate)
              if (existing.length === 0) return null
              return (
                <div>
                  <Separator className="mb-2" />
                  <span className="text-xs text-muted-foreground mb-1.5 block">
                    {existing.length} existing note{existing.length !== 1 ? 's' : ''} on this day
                  </span>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto">
                    {existing.map((n) => (
                      <div
                        key={n.id}
                        className="flex items-start gap-2 group rounded-md border p-2 hover:bg-accent/30"
                      >
                        <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: n.color }} />
                        <p className="text-xs flex-1 leading-relaxed whitespace-pre-wrap">{n.content}</p>
                        <div className="flex gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleEditNote(n)}>
                            <Pencil className="w-3 h-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive hover:text-destructive" onClick={() => handleDeleteNote(n.id)}>
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
              <Button variant="destructive" size="sm" onClick={() => handleDeleteNote(editingNote.id)} className="mr-auto">
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
