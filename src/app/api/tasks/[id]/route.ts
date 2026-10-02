import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, handleApiError } from '@/lib/api-auth'

const taskInclude = {
  assignments: { include: { user: { select: { id: true, name: true, email: true, role: true, avatar: true } } } },
  creator: { select: { id: true, name: true, email: true, role: true, avatar: true } },
  comments: { include: { user: { select: { id: true, name: true, role: true, avatar: true } } }, orderBy: { createdAt: 'asc' } },
  project: { select: { id: true, name: true, color: true } },
  _count: { select: { comments: true } }
} as const

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authed = await requireAuth(req)
    const { id } = await params
    const task = await db.task.findUnique({ where: { id }, include: taskInclude })
    if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Non-admin users can only view tasks in projects they are members of
    if (authed.role !== 'admin') {
      const membership = await db.projectMember.findUnique({
        where: { projectId_userId: { projectId: task.projectId, userId: authed.id } }
      })
      if (!membership) return NextResponse.json({ error: 'Not a member of this project' }, { status: 403 })
    }

    return NextResponse.json({ task: { ...task, assignees: task.assignments } })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(req)
    // Training users cannot update tasks
    if (user.role === 'training') {
      return NextResponse.json({ error: 'Training users cannot update tasks' }, { status: 403 })
    }
    const { id } = await params
    const body = await req.json()
    const { title, description, status, priority, dueDate, tags } = body

    const task = await db.task.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(status !== undefined && { status }),
        ...(priority !== undefined && { priority }),
        ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
        ...(tags !== undefined && { tags }),
      },
      include: taskInclude
    })

    if (status) {
      await db.activityLog.create({ data: { action: 'task_moved', details: `Moved "${task.title}" to ${status.replace('_', ' ')}`, userId: user.id, projectId: task.projectId, taskId: task.id } })
    }
    return NextResponse.json({ task: { ...task, assignees: task.assignments } })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(req)
    // Training users cannot delete tasks — always check authenticated user's role
    if (user.role === 'training') {
      return NextResponse.json({ error: 'Training users cannot delete tasks' }, { status: 403 })
    }
    const { id } = await params

    const task = await db.task.findUnique({ where: { id } })
    await db.task.delete({ where: { id } })
    if (task) await db.activityLog.create({ data: { action: 'task_deleted', details: `Deleted "${task.title}"`, userId: user.id, projectId: task.projectId, taskId: task.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error)
  }
}