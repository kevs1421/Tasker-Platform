import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, handleApiError } from '@/lib/api-auth'

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request)
    const { searchParams } = new URL(request.url)
    const taskId = searchParams.get('taskId')
    if (!taskId) return NextResponse.json({ error: 'taskId required' }, { status: 400 })

    const comments = await db.comment.findMany({
      where: { taskId },
      include: { user: { select: { id: true, name: true, role: true, avatar: true } } },
      orderBy: { createdAt: 'asc' }
    })
    return NextResponse.json({ comments })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth(request)
    const { content, taskId, userId } = await request.json()
    if (!content || !taskId || !userId) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    // Training users cannot post comments
    const user = await db.user.findUnique({ where: { id: userId }, select: { role: true } })
    if (user?.role === 'training') {
      return NextResponse.json({ error: 'Training users cannot post comments' }, { status: 403 })
    }

    const comment = await db.comment.create({
      data: { content, taskId, userId },
      include: { user: { select: { id: true, name: true, role: true, avatar: true } } }
    })

    const task = await db.task.findUnique({ where: { id: taskId } })
    if (task) await db.activityLog.create({ data: { action: 'comment_added', details: `Commented on "${task.title}"`, userId, projectId: task.projectId, taskId } })
    return NextResponse.json({ comment }, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}