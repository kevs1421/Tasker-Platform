import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, handleApiError } from '@/lib/api-auth'

export async function POST(request: NextRequest) {
  try {
    await requireAuth(request)
    const { userId, taskId, assignedBy } = await request.json()
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
        details: assignedBy
          ? `Assigned ${assignment.user?.name || userId} to task`
          : `User ${assignment.user?.name || userId} assigned to task`,
        userId: assignedBy || userId,
        taskId,
      }
    })

    return NextResponse.json({ assignment }, { status: 201 })
  } catch (error) { return handleApiError(error) }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireAuth(request)
    const { userId, taskId } = await request.json()
    if (!userId || !taskId) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    await db.taskAssignment.deleteMany({ where: { userId, taskId } })
    return NextResponse.json({ success: true })
  } catch (error) { return handleApiError(error) }
}