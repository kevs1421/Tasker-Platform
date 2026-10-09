import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requireAdmin, handleApiError } from '@/lib/api-auth'

// GET - list members of a project
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authed = await requireAuth(req)
    const { id } = await params

    // Non-admin users can only see members of projects they are members of
    if (authed.role !== 'admin') {
      const membership = await db.projectMember.findUnique({
        where: { projectId_userId: { projectId: id, userId: authed.id } }
      })
      if (!membership) return NextResponse.json({ error: 'Not a member of this project' }, { status: 403 })
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

    // Auto-create ClientProject links for any client-role members added
    // so they can see the project in their client portal
    const clientUsers = await db.user.findMany({
      where: { id: { in: userIds }, role: 'client' },
      select: { id: true },
    })
    if (clientUsers.length > 0) {
      await Promise.all(
        clientUsers.map(u =>
          db.clientProject.upsert({
            where: { clientId_projectId: { clientId: u.id, projectId: id } },
            create: { clientId: u.id, projectId: id },
            update: {},
          })
        )
      )
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

    // Also remove ClientProject link if the user is a client
    // so the project disappears from their client portal
    const user = await db.user.findUnique({ where: { id: userId }, select: { role: true } })
    if (user?.role === 'client') {
      await db.clientProject.deleteMany({ where: { projectId: id, clientId: userId } })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error)
  }
}