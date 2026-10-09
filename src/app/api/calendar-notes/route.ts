import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, handleApiError } from '@/lib/api-auth'

// GET /api/calendar-notes?month=2025-01&userId=xxx
export async function GET(req: NextRequest) {
  try {
    const authed = await requireAuth(req)
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')
    // Non-admin users can only see their own notes
    const effectiveUserId = authed.role === 'admin' ? userId : authed.id
    if (!effectiveUserId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 })
    }

    const month = searchParams.get('month') // YYYY-MM
    const date = searchParams.get('date') // YYYY-MM-DD (single day)

    const where: Record<string, unknown> = { userId: effectiveUserId }

    if (date) {
      where.date = date
    } else if (month) {
      where.date = { startsWith: month }
    }

    const notes = await db.calendarNote.findMany({
      where,
      orderBy: { date: 'asc' },
    })

    return NextResponse.json(notes)
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/calendar-notes
export async function POST(req: NextRequest) {
  try {
    const authed = await requireAuth(req)
    const body = await req.json()
    const { date, content, color } = body

    // Non-admin users can only create notes for themselves
    const userId = authed.role === 'admin' ? (body.userId || authed.id) : authed.id
    if (!userId || !date || !content?.trim()) {
      return NextResponse.json({ error: 'userId, date and content are required' }, { status: 400 })
    }

    const note = await db.calendarNote.create({
      data: {
        userId,
        date,
        content: content.trim(),
        color: color || '#f59e0b',
      },
    })

    return NextResponse.json(note, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}

// PUT /api/calendar-notes
export async function PUT(req: NextRequest) {
  try {
    const authed = await requireAuth(req)
    const body = await req.json()
    const { id, content, color } = body

    if (!id) {
      return NextResponse.json({ error: 'Note ID is required' }, { status: 400 })
    }

    const note = await db.calendarNote.findFirst({
      where: { id },
    })

    if (!note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }

    // Ownership check: non-admin users can only update their own notes
    if (note.userId !== authed.id && authed.role !== 'admin') {
      return NextResponse.json({ error: 'You can only update your own notes' }, { status: 403 })
    }

    const updated = await db.calendarNote.update({
      where: { id },
      data: {
        ...(content !== undefined && { content: content.trim() }),
        ...(color !== undefined && { color }),
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    return handleApiError(error)
  }
}
