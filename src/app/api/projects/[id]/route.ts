import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const project = await db.project.findUnique({
      where: { id },
      include: {
        creator: { select: { id: true, name: true, role: true, avatar: true } },
        members: { include: { user: { select: { id: true, name: true, email: true, role: true, avatar: true } } } },
        tasks: {
          include: {
            assignments: { include: { user: { select: { id: true, name: true, email: true, role: true, avatar: true } } }, orderBy: { assignedAt: 'asc' } },
            creator: { select: { id: true, name: true, role: true, avatar: true } },
            _count: { select: { comments: true } }
          },
          orderBy: { createdAt: 'desc' }
        },
        _count: { select: { tasks: true, members: true, onboardingForms: true } }
      }
    })
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const tasks = project.tasks.map(t => ({
      ...t,
      assignees: t.assignments
    }))
    return NextResponse.json({ project: { ...project, tasks } })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const project = await db.project.update({
      where: { id },
      data: {
        ...(body.name && { name: body.name }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.color && { color: body.color }),
        ...(body.priority && { priority: body.priority }),
        ...(body.dueDate !== undefined && { dueDate: body.dueDate ? new Date(body.dueDate) : null }),
        ...(body.status && { status: body.status }),
      },
      include: { _count: { select: { tasks: true, members: true } } }
    })
    return NextResponse.json({ project })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await db.project.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}