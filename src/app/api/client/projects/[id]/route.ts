import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, handleApiError } from '@/lib/api-auth'

/**
 * GET /api/client/projects/:id?clientId=xxx
 *
 * Returns a single project ONLY if it belongs to the requesting client
 * via either the ClientProject join table OR the ProjectMember table.
 * Also back-fills a missing ClientProject link if found via ProjectMember.
 * Prevents URL/project ID bypass.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(req)
    const { id } = await params
    const { searchParams } = new URL(req.url)
    const clientId = searchParams.get('clientId')

    if (!clientId) {
      return NextResponse.json({ error: 'clientId is required' }, { status: 400 })
    }

    // Check Source 1: ClientProject junction table
    const link = await db.clientProject.findUnique({
      where: {
        clientId_projectId: { clientId, projectId: id }
      },
      select: { id: true }
    })

    // Check Source 2: ProjectMember table (fallback)
    let isMember = false
    if (!link) {
      const memberLink = await db.projectMember.findUnique({
        where: { projectId_userId: { projectId: id, userId: clientId } },
        select: { id: true }
      })
      isMember = !!memberLink

      // Back-fill ClientProject link if found via ProjectMember
      if (isMember) {
        try {
          await db.clientProject.upsert({
            where: { clientId_projectId: { clientId, projectId: id } },
            create: { clientId, projectId: id },
            update: {},
          })
        } catch {
          // Ignore backfill errors — the response is still correct
        }
      }
    }

    const hasAccess = !!link || isMember

    if (!hasAccess) {
      return NextResponse.json({ error: 'Project not found or access denied' }, { status: 404 })
    }

    // Fetch the project with full details
    const project = await db.project.findUnique({
      where: { id },
      include: {
        creator: { select: { id: true, name: true, role: true, avatar: true } },
        members: {
          include: { user: { select: { id: true, name: true, email: true, role: true, avatar: true } } }
        },
        tasks: {
          include: {
            assignments: {
              include: { user: { select: { id: true, name: true, email: true, role: true, avatar: true } } },
              orderBy: { assignedAt: 'asc' }
            },
            creator: { select: { id: true, name: true, role: true, avatar: true } },
            _count: { select: { comments: true } }
          },
          orderBy: { createdAt: 'desc' }
        },
        _count: { select: { tasks: true, members: true, onboardingForms: true } }
      }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const tasks = project.tasks.map(t => ({
      ...t,
      assignees: t.assignments
    }))

    return NextResponse.json({ project: { ...project, tasks } })
  } catch (error) {
    return handleApiError(error)
  }
}
