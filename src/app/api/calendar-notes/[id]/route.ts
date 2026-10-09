import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, handleApiError } from '@/lib/api-auth'

// DELETE /api/calendar-notes/[id]?userId=xxx
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authed = await requireAuth(req)
    const { id } = await params

    const note = await db.calendarNote.findFirst({
      where: { id },
    })

    if (!note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }

    // Ownership check: non-admin users can only delete their own notes
    if (note.userId !== authed.id && authed.role !== 'admin') {
      return NextResponse.json({ error: 'You can only delete your own notes' }, { status: 403 })
    }

    await db.calendarNote.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error)
  }
}
