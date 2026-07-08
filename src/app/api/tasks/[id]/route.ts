import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

const taskInclude = {
  assignments: { include: { user: { select: { id: true, name: true, email: true, role: true, avatar: true } } } },
  creator: { select: { id: true, name: true, email: true, role: true, avatar: true } },
  subtasks: { orderBy: { createdAt: 'asc' } },
  comments: { include: { user: { select: { id: true, name: true, role: true, avatar: true } } }, orderBy: { createdAt: 'asc' } },
  project: { select: { id: true, name: true, color: true } },
  _count: { select: { comments: true, subtasks: true } }
} as const

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const task = await db.task.findUnique({ where: { id }, include: taskInclude })
    if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ task: { ...task, assignees: task.assignments, _count: { ...task._count, completedSubtasks: task.subtasks.filter(s => s.completed).length } } })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const { title, description, status, priority, dueDate, tags } = body

    const task = await db.task.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }), ...(description !== undefined && { description }),
        ...(status && { status }), ...(priority && { priority }),
        ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
        ...(tags !== undefined && { tags }),
      },
      include: { ...taskInclude, _count: { select: { comments: true, subtasks: true } } }
    })

    if (status) {
      await db.activityLog.create({ data: { action: 'task_moved', details: `Moved "${task.title}" to ${status.replace('_', ' ')}`, userId: task.createdById, projectId: task.projectId, taskId: task.id } })
    }
    return NextResponse.json({ task: { ...task, assignees: task.assignments, _count: { ...task._count, completedSubtasks: task.subtasks.filter(s => s.completed).length } } })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const task = await db.task.findUnique({ where: { id } })
    await db.task.delete({ where: { id } })
    if (task) await db.activityLog.create({ data: { action: 'task_deleted', details: `Deleted "${task.title}"`, projectId: task.projectId } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}