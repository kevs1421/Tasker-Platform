import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requireAdmin, handleApiError } from '@/lib/api-auth'

// GET - list members of a project
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(req)
    const { id } = await params
    const members = await db.projectMember.findMany({
      where: { projectId: id },
      include: { user: { select: { id: true, name: true, email: true, role: true, avatar: true, status: true } } },
      orderBy: { role: 'asc' }
    })
    return NextResponse.json({ members })
  } catch (error) {
    return handleApiError(error)
  }
}

// POST - add members to a project
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(req)
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
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE - remove a member from a project
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(req)
    const { id } = await params
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')
    if (!userId) return NextResponse.json({ error: 'userId query param required' }, { status: 400 })

    await db.projectMember.deleteMany({ where: { projectId: id, userId } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error)
  }
}