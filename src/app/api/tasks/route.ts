import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

const taskInclude = {
  assignments: { include: { user: { select: { id: true, name: true, email: true, role: true, avatar: true } } }, orderBy: { assignedAt: 'asc' } },
  creator: { select: { id: true, name: true, email: true, role: true, avatar: true } },
  project: { select: { id: true, name: true, color: true, members: { include: { user: { select: { id: true, name: true, email: true, role: true, avatar: true } } } } } },
  _count: { select: { comments: true } }
} as const

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    const status = searchParams.get('status')
    const assigneeId = searchParams.get('assigneeId')

    let tasks
    if (projectId) {
      tasks = await db.task.findMany({ where: { projectId }, include: taskInclude, orderBy: { createdAt: 'desc' } })
    } else if (status) {
      tasks = await db.task.findMany({ where: { status }, include: taskInclude, orderBy: { createdAt: 'desc' } })
    } else if (assigneeId) {
      tasks = await db.task.findMany({ where: { assignments: { some: { userId: assigneeId } } }, include: taskInclude, orderBy: { createdAt: 'desc' } })
    } else {
      tasks = await db.task.findMany({ include: taskInclude, orderBy: { createdAt: 'desc' } })
    }

    const result = tasks.map(t => ({
      ...t,
      assignees: t.assignments
    }))
    return NextResponse.json({ tasks: result })
  } catch {
    return NextResponse.json({ error: 'Failed to process task request' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { title, description, status, priority, dueDate, projectId, createdById, assigneeIds, tags } = body
    if (!title || !projectId || !createdById) return NextResponse.json({ error: 'Title, projectId, createdById required' }, { status: 400 })

    // Check if creator is a training user — they cannot create tasks
    const creator = await db.user.findUnique({ where: { id: createdById }, select: { role: true } })
    if (creator?.role === 'training') {
      return NextResponse.json({ error: 'Training users cannot create tasks' }, { status: 403 })
    }

    const task = await db.task.create({
      data: {
        title, description: description || null, status: status || 'todo', priority: priority || 'medium',
        dueDate: dueDate ? new Date(dueDate) : null, projectId, createdById, tags: tags || '',
        assignments: { create: (assigneeIds || []).map((id: string) => ({ userId: id })) }
      },
      include: taskInclude
    })

    const taskWithAssignees = { ...task, assignees: task.assignments }
    await db.activityLog.create({ data: { action: 'task_created', details: `Created task "${title}"`, userId: createdById, projectId, taskId: task.id } })
    return NextResponse.json({ task: taskWithAssignees }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to process task request' }, { status: 500 })
  }
}