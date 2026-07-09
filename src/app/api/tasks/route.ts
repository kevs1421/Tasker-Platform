import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

const taskInclude = {
  assignments: { include: { user: { select: { id: true, name: true, email: true, role: true, avatar: true } } }, orderBy: { assignedAt: 'asc' } },
  creator: { select: { id: true, name: true, email: true, role: true, avatar: true } },
  subtasks: true,
  project: { select: { id: true, name: true, color: true, members: { include: { user: { select: { id: true, name: true, email: true, role: true, avatar: true } } } } } },
  _count: { select: { comments: true, subtasks: true } }
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
      assignees: t.assignments,
      _count: { ...t._count, completedSubtasks: t.subtasks.filter(s => s.completed).length }
    }))
    return NextResponse.json({ tasks: result })
  } catch (e) {
    console.error('Tasks GET error:', e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { title, description, status, priority, dueDate, projectId, createdById, assigneeIds, tags } = body
    if (!title || !projectId || !createdById) return NextResponse.json({ error: 'Title, projectId, createdById required' }, { status: 400 })

    const task = await db.task.create({
      data: {
        title, description: description || null, status: status || 'todo', priority: priority || 'medium',
        dueDate: dueDate ? new Date(dueDate) : null, projectId, createdById, tags: tags || '',
        assignments: { create: (assigneeIds || []).map((id: string) => ({ userId: id })) }
      },
      include: {
        ...taskInclude,
        _count: { select: { comments: true, subtasks: true } }
      }
    })

    const taskWithAssignees = { ...task, assignees: task.assignments }
    await db.activityLog.create({ data: { action: 'task_created', details: `Created task "${title}"`, userId: createdById, projectId, taskId: task.id } })
    return NextResponse.json({ task: taskWithAssignees }, { status: 201 })
  } catch (e) {
    console.error('Tasks POST error:', e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}