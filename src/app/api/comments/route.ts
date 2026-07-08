import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const taskId = searchParams.get('taskId')
    if (!taskId) return NextResponse.json({ error: 'taskId required' }, { status: 400 })

    const comments = await db.comment.findMany({
      where: { taskId },
      include: { user: { select: { id: true, name: true, role: true, avatar: true } } },
      orderBy: { createdAt: 'asc' }
    })
    return NextResponse.json({ comments })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { content, taskId, userId } = await request.json()
    if (!content || !taskId || !userId) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const comment = await db.comment.create({
      data: { content, taskId, userId },
      include: { user: { select: { id: true, name: true, role: true, avatar: true } } }
    })

    const task = await db.task.findUnique({ where: { id: taskId } })
    if (task) await db.activityLog.create({ data: { action: 'comment_added', details: `Commented on "${task.title}"`, userId, projectId: task.projectId, taskId } })
    return NextResponse.json({ comment }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}