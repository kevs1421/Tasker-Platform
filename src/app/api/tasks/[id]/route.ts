import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

const taskInclude = {
  assignments: { include: { user: { select: { id: true, name: true, email: true, role: true, avatar: true } } } },
  creator: { select: { id: true, name: true, email: true, role: true, avatar: true } },
  comments: { include: { user: { select: { id: true, name: true, role: true, avatar: true } } }, orderBy: { createdAt: 'asc' } },
  project: { select: { id: true, name: true, color: true } },
  _count: { select: { comments: true } }
} as const

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const task = await db.task.findUnique({ where: { id }, include: taskInclude })
    if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ task: { ...task, assignees: task.assignments } })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch task' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const { title, description, status, priority, dueDate, tags, updatedBy } = body

    // Training users cannot update tasks
    if (updatedBy) {
      const user = await db.user.findUnique({ where: { id: updatedBy }, select: { role: true } })
      if (user?.role === 'training') {
        return NextResponse.json({ error: 'Training users cannot update tasks' }, { status: 403 })
      }
    }

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
      const updatedBy = body.updatedBy || task.createdById
      await db.activityLog.create({ data: { action: 'task_moved', details: `Moved "${task.title}" to ${status.replace('_', ' ')}`, userId: updatedBy, projectId: task.projectId, taskId: task.id } })
    }
    return NextResponse.json({ task: { ...task, assignees: task.assignments } })
  } catch {
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    let deletedBy = ''
    try { const b = await req.json(); deletedBy = b.deletedBy || '' } catch { /* no body */ }

    // Training users cannot delete tasks
    if (deletedBy) {
      const user = await db.user.findUnique({ where: { id: deletedBy }, select: { role: true } })
      if (user?.role === 'training') {
        return NextResponse.json({ error: 'Training users cannot delete tasks' }, { status: 403 })
      }
    }

    const task = await db.task.findUnique({ where: { id } })
    await db.task.delete({ where: { id } })
    if (task) await db.activityLog.create({ data: { action: 'task_deleted', details: `Deleted "${task.title}"`, userId: deletedBy || task.createdById, projectId: task.projectId, taskId: task.id } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 })
  }
}