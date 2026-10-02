import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, handleApiError } from '@/lib/api-auth'

const taskInclude = {
  assignments: { include: { user: { select: { id: true, name: true, email: true, role: true, avatar: true } } }, orderBy: { assignedAt: 'asc' } },
  creator: { select: { id: true, name: true, email: true, role: true, avatar: true } },
  project: { select: { id: true, name: true, color: true, members: { include: { user: { select: { id: true, name: true, email: true, role: true, avatar: true } } } } } },
  _count: { select: { comments: true } }
} as const

export async function GET(request: NextRequest) {
  try {
    const authed = await requireAuth(request)
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    const status = searchParams.get('status')
    const assigneeId = searchParams.get('assigneeId')

    // Build where clause with role-based filtering
    // Non-admin users can only see tasks in projects they are members of
    const baseWhere: Record<string, unknown> = {}
    if (authed.role !== 'admin') {
      baseWhere.project = { members: { some: { userId: authed.id } } }
    }

    let tasks
    if (projectId) {
      tasks = await db.task.findMany({ where: { ...baseWhere, projectId }, include: taskInclude, orderBy: { createdAt: 'desc' } })
    } else if (status) {
      tasks = await db.task.findMany({ where: { ...baseWhere, status }, include: taskInclude, orderBy: { createdAt: 'desc' } })
    } else if (assigneeId) {
      tasks = await db.task.findMany({ where: { ...baseWhere, assignments: { some: { userId: assigneeId } } }, include: taskInclude, orderBy: { createdAt: 'desc' } })
    } else {
      tasks = await db.task.findMany({ where: baseWhere, include: taskInclude, orderBy: { createdAt: 'desc' } })
    }

    const result = tasks.map(t => ({
      ...t,
      assignees: t.assignments
    }))
    return NextResponse.json({ tasks: result })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const authed = await requireAuth(request)
    const body = await request.json()
    const { title, description, status, priority, dueDate, projectId, assigneeIds, tags } = body
    // Use the authenticated user's ID as creator — prevents impersonation
    const createdById = authed.id
    if (!title || !projectId) return NextResponse.json({ error: 'Title and projectId required' }, { status: 400 })

    // Check if creator is a training user — they cannot create tasks
    if (authed.role === 'training') {
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
  } catch (error) {
    return handleApiError(error)
  }
}