import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, handleApiError } from '@/lib/api-auth'

export async function POST(request: NextRequest) {
  try {
    const authed = await requireAuth(request)
    // Client role cannot manage assignments
    if (authed.role === 'client') {
      return NextResponse.json({ error: 'Client users cannot manage task assignments' }, { status: 403 })
    }
    const { userId, taskId } = await request.json()
    if (!userId || !taskId) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const existing = await db.taskAssignment.findUnique({ where: { taskId_userId: { taskId, userId } } })
    if (existing) return NextResponse.json({ error: 'Already assigned' }, { status: 409 })

    const assignment = await db.taskAssignment.create({
      data: { userId, taskId },
      include: { user: { select: { id: true, name: true, email: true, role: true, avatar: true } } },
    })

    // Log who assigned the user
    await db.activityLog.create({
      data: {
        action: 'task_assigned',
        details: `Assigned ${assignment.user?.name || userId} to task`,
        userId: authed.id,
        taskId,
      }
    })

    return NextResponse.json({ assignment }, { status: 201 })
  } catch (error) { return handleApiError(error) }
}

export async function DELETE(request: NextRequest) {
  try {
    const authed = await requireAuth(request)
    // Client role cannot manage assignments
    if (authed.role === 'client') {
      return NextResponse.json({ error: 'Client users cannot manage task assignments' }, { status: 403 })
    }
    const { userId, taskId } = await request.json()
    if (!userId || !taskId) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    await db.taskAssignment.deleteMany({ where: { userId, taskId } })
    return NextResponse.json({ success: true })
  } catch (error) { return handleApiError(error) }
}