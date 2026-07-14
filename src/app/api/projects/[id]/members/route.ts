import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET - list members of a project
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const members = await db.projectMember.findMany({
      where: { projectId: id },
      include: { user: { select: { id: true, name: true, email: true, role: true, avatar: true, status: true } } },
      orderBy: { role: 'asc' }
    })
    return NextResponse.json({ members })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch project members' }, { status: 500 })
  }
}

// POST - add members to a project
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { userIds } = await req.json()
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json({ error: 'userIds array required' }, { status: 400 })
    }

    // Verify project exists
    const project = await db.project.findUnique({ where: { id } })
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

    // Add members one by one, skip if already exists
    for (const userId of userIds) {
      const exists = await db.projectMember.findUnique({ where: { projectId_userId: { projectId: id, userId } } })
      if (!exists) {
        await db.projectMember.create({ data: { projectId: id, userId, role: 'member' } })
      }
    }

    const members = await db.projectMember.findMany({
      where: { projectId: id },
      include: { user: { select: { id: true, name: true, email: true, role: true, avatar: true, status: true } } },
      orderBy: { role: 'asc' }
    })

    return NextResponse.json({ members })
  } catch {
    return NextResponse.json({ error: 'Failed to add project members' }, { status: 500 })
  }
}

// DELETE - remove a member from a project
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')
    if (!userId) return NextResponse.json({ error: 'userId query param required' }, { status: 400 })

    await db.projectMember.deleteMany({ where: { projectId: id, userId } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to remove project member' }, { status: 500 })
  }
}