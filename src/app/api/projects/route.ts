import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const projects = await db.project.findMany({
      include: {
        creator: { select: { id: true, name: true, email: true, role: true } },
        members: { include: { user: { select: { id: true, name: true, email: true, role: true, avatar: true } } } },
        _count: { select: { tasks: true, members: true, onboardingForms: true } }
      },
      orderBy: { createdAt: 'desc' }
    })
    return NextResponse.json({ projects })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, description, color, priority, dueDate, createdBy, memberIds } = await request.json()
    if (!name || !createdBy) return NextResponse.json({ error: 'Name and createdBy required' }, { status: 400 })

    const project = await db.project.create({
      data: {
        name, description: description || null, color: color || '#f59e0b',
        priority: priority || 'medium', dueDate: dueDate ? new Date(dueDate) : null, createdBy,
        members: { create: [{ userId: createdBy, role: 'owner' }, ...(memberIds || []).map((id: string) => ({ userId: id, role: 'member' }))] }
      },
      include: {
        creator: { select: { id: true, name: true, role: true } },
        members: { include: { user: { select: { id: true, name: true, role: true, avatar: true } } } },
        _count: { select: { tasks: true, members: true } }
      }
    })
    await db.activityLog.create({ data: { action: 'project_created', details: `Created project "${name}"`, userId: createdBy, projectId: project.id } })
    return NextResponse.json({ project }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}