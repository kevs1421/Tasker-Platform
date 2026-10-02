import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, handleApiError } from '@/lib/api-auth'

/**
 * GET /api/client/projects?clientId=xxx
 *
 * Returns ONLY the projects that are explicitly linked to this client
 * via the ClientProject join table. This is the single source of truth
 * for which projects a client user is allowed to see.
 */
export async function GET(request: NextRequest) {
  try {
    const authed = await requireAuth(request)
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('clientId')

    if (!clientId) {
      return NextResponse.json({ error: 'clientId is required' }, { status: 400 })
    }

    // Authorization: client users can only view their own projects
    // Admin/team/training can view any client's projects
    if (authed.role === 'client' && authed.id !== clientId) {
      return NextResponse.json({ error: 'You can only view your own projects' }, { status: 403 })
    }

    // Query through ClientProject — only projects assigned to THIS client
    const clientProjectLinks = await db.clientProject.findMany({
      where: { clientId },
      include: {
        project: {
          include: {
            members: {
              include: { user: { select: { id: true, name: true, email: true, role: true, avatar: true } } }
            },
            tasks: { select: { id: true, status: true } },
            _count: { select: { tasks: true, members: true, onboardingForms: true } }
          }
        }
      },
      orderBy: { addedAt: 'desc' }
    })

    // Build response with task stats per project
    const projects = clientProjectLinks
      .filter(link => link.project.status === 'active')
      .map(link => {
        const p = link.project
        const tasksByStatus = {
          todo: p.tasks.filter(t => t.status === 'todo').length,
          in_progress: p.tasks.filter(t => t.status === 'in_progress').length,
          in_review: p.tasks.filter(t => t.status === 'in_review').length,
          done: p.tasks.filter(t => t.status === 'done').length,
        }
        const totalTasks = p._count.tasks
        const doneTasks = tasksByStatus.done
        const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0
        const { tasks: _tasks, ...rest } = p
        return { ...rest, taskStats: tasksByStatus, progress }
      })

    return NextResponse.json({ projects })
  } catch (error) {
    return handleApiError(error)
  }
}