import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/client/projects/:id?clientId=xxx
 *
 * Returns a single project ONLY if it belongs to the requesting client
 * via the ClientProject join table. Prevents URL/project ID bypass.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(req.url)
    const clientId = searchParams.get('clientId')

    if (!clientId) {
      return NextResponse.json({ error: 'clientId is required' }, { status: 400 })
    }

    // Verify this client owns the project via ClientProject table
    const link = await db.clientProject.findUnique({
      where: {
        clientId_projectId: { clientId, projectId: id }
      },
      include: {
        project: {
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
        }
      }
    })

    if (!link || !link.project) {
      return NextResponse.json({ error: 'Project not found or access denied' }, { status: 404 })
    }

    const project = link.project
    const tasks = project.tasks.map(t => ({
      ...t,
      assignees: t.assignments
    }))

    return NextResponse.json({ project: { ...project, tasks } })
  } catch (error) {
    console.error('Client project detail error:', error)
    return NextResponse.json({ error: 'Failed to fetch project' }, { status: 500 })
  }
}