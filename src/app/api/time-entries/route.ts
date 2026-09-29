import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, handleApiError } from '@/lib/api-auth'

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request)
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const projectId = searchParams.get('projectId')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    // Check for any active timer (timed_in status)
    const activeParam = searchParams.get('active')
    if (activeParam === 'true') {
      const activeEntry = await db.timeEntry.findFirst({
        where: { status: 'timed_in', userId: userId || undefined },
        include: {
          user: { select: { id: true, name: true, avatar: true, role: true } },
          project: { select: { id: true, name: true, color: true } },
          task: { select: { id: true, title: true } },
        },
        orderBy: { createdAt: 'desc' },
      })
      return NextResponse.json({ timeEntries: activeEntry ? [activeEntry] : [], total: activeEntry ? 1 : 0 })
    }

    const where: Record<string, unknown> = {}
    if (userId) where.userId = userId
    if (projectId) where.projectId = projectId
    if (dateFrom || dateTo) {
      where.date = {}
      if (dateFrom) (where.date as Record<string, unknown>).gte = dateFrom
      if (dateTo) (where.date as Record<string, unknown>).lte = dateTo
    }

    const [timeEntries, total] = await Promise.all([
      db.timeEntry.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, avatar: true, role: true } },
          project: { select: { id: true, name: true, color: true } },
          task: { select: { id: true, title: true } },
        },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.timeEntry.count({ where }),
    ])

    return NextResponse.json({ timeEntries, total })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const authed = await requireAuth(request)
    const body = await request.json()
    const { userId, projectId, taskId, description, date, action } = body

    // Normalize: treat empty strings as null/undefined
    const cleanProjectId = projectId && typeof projectId === 'string' && projectId.trim() ? projectId : null
    const cleanTaskId = taskId && typeof taskId === 'string' && taskId.trim() ? taskId : null
    const cleanDescription = description && typeof description === 'string' && description.trim() ? description.trim() : null

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    // Authorization: non-admin users can only create time entries for themselves
    if (authed.role !== 'admin' && authed.id !== userId) {
      return NextResponse.json({ error: 'You can only create time entries for yourself' }, { status: 403 })
    }

    if (action === 'time_in') {
      // Check if user already has an active timer
      const existing = await db.timeEntry.findFirst({
        where: { userId, status: 'timed_in' },
      })
      if (existing) {
        return NextResponse.json({ error: 'You already have an active timer. Please time out first.' }, { status: 400 })
      }

      const today = date || new Date().toISOString().split('T')[0]
      const entry = await db.timeEntry.create({
        data: {
          userId,
          projectId: cleanProjectId,
          taskId: cleanTaskId,
          description: cleanDescription,
          date: today,
          timeIn: new Date().toISOString(),
          status: 'timed_in',
          duration: 0,
        },
        include: {
          user: { select: { id: true, name: true, avatar: true, role: true } },
          project: { select: { id: true, name: true, color: true } },
          task: { select: { id: true, title: true, status: true } },
        },
      })

      return NextResponse.json({ timeEntry: entry })
    }

    if (action === 'manual') {
      if (!body.timeIn || !body.timeOut) {
        return NextResponse.json({ error: 'timeIn and timeOut are required for manual entry' }, { status: 400 })
      }
      const start = new Date(body.timeIn)
      const end = new Date(body.timeOut)
      const durationMin = Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000))
      const entryDate = date || new Date().toISOString().split('T')[0]

      const entry = await db.timeEntry.create({
        data: {
          userId,
          projectId: projectId || null,
          taskId: taskId || null,
          description: description || null,
          date: entryDate,
          timeIn: start.toISOString(),
          timeOut: end.toISOString(),
          duration: durationMin,
          status: 'completed',
        },
        include: {
          user: { select: { id: true, name: true, avatar: true, role: true } },
          project: { select: { id: true, name: true, color: true } },
          task: { select: { id: true, title: true } },
        },
      })

      return NextResponse.json({ timeEntry: entry })
    }

    return NextResponse.json({ error: 'Invalid action. Use "time_in" or "manual".' }, { status: 400 })
  } catch (error) {
    return handleApiError(error)
  }
}