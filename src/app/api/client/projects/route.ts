import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, handleApiError } from '@/lib/api-auth'

/**
 * Ensure ClientProject links exist for all projects where this client
 * is a ProjectMember. Uses upsert to handle existing records gracefully.
 */
async function ensureClientProjectLinks(clientId: string, projectIds: string[]) {
  await Promise.all(
    projectIds.map(projectId =>
      db.clientProject.upsert({
        where: { clientId_projectId: { clientId, projectId } },
        create: { clientId, projectId },
        update: {},
      })
    )
  )
}

/**
 * GET /api/client/projects?clientId=xxx
 *
 * Returns the projects a client can see in their portal.
 *
 * We use TWO sources to find projects:
 *   1. ClientProject junction table (explicit link)
 *   2. ProjectMember table (if the client is a project member)
 *
 * This ensures clients always see their assigned projects even if the
 * ClientProject link wasn't created (e.g., added via member management
 * before auto-linking was added). Any missing ClientProject links are
 * back-filled automatically so future queries are consistent.
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

    // ── Source 1: ClientProject junction table ──
    const clientProjectLinks = await db.clientProject.findMany({
      where: { clientId },
      select: { projectId: true },
    })
    const linkedProjectIds = new Set(clientProjectLinks.map(l => l.projectId))

    // ── Source 2: ProjectMember table (fallback for clients) ──
    const memberLinks = await db.projectMember.findMany({
      where: { userId: clientId },
      select: { projectId: true },
    })
    const memberProjectIds = new Set(memberLinks.map(m => m.projectId))

    // Merge: all project IDs the client should see
    const allProjectIds = new Set([...linkedProjectIds, ...memberProjectIds])

    // Back-fill missing ClientProject links so future queries are consistent
    const missingIds = [...memberProjectIds].filter(id => !linkedProjectIds.has(id))
    if (missingIds.length > 0) {
      try {
        await ensureClientProjectLinks(clientId, missingIds)
      } catch {
        // Ignore backfill errors — the response is still correct
      }
    }

    // Fetch all visible projects in one query
    const projects = await db.project.findMany({
      where: {
        id: { in: [...allProjectIds] },
        status: 'active',
      },
      include: {
        members: {
          include: { user: { select: { id: true, name: true, email: true, role: true, avatar: true } } }
        },
        tasks: { select: { id: true, status: true } },
        _count: { select: { tasks: true, members: true, onboardingForms: true } }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Build response with task stats per project
    const projectsWithStats = projects.map(p => {
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

    return NextResponse.json({ projects: projectsWithStats })
  } catch (error) {
    return handleApiError(error)
  }
}
