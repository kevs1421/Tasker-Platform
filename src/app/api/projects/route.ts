import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requireAdmin, handleApiError } from '@/lib/api-auth'

export async function GET(request: NextRequest) {
  try {
    const authed = await requireAuth(request)
    const { searchParams } = new URL(request.url)
    const filterByMember = searchParams.get('filterByMember') === 'true'

    // Build where clause: non-admin users only see projects they are members of
    const where: Record<string, unknown> = {}
    if (authed.role !== 'admin' || filterByMember) {
      where.members = { some: { userId: authed.id } }
    }

    const projects = await db.project.findMany({
      where,
      include: {
        creator: { select: { id: true, name: true, email: true, role: true } },
        members: { include: { user: { select: { id: true, name: true, email: true, role: true, avatar: true } } } },
        tasks: { select: { id: true, status: true } },
        _count: { select: { tasks: true, members: true, onboardingForms: true } }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Compute task status counts per project
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

export async function POST(request: NextRequest) {
  try {
    const authed = await requireAdmin(request)
    const { name, description, color, priority, dueDate, memberIds } = await request.json()
    // Use the authenticated admin's ID as creator — prevents impersonation
    const createdBy = authed.id
    if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 })

    // Filter out creator from memberIds to avoid unique constraint violation
    const filteredMemberIds = (memberIds || []).filter((id: string) => id !== createdBy)

    const project = await db.project.create({
      data: {
        name, description: description || null, color: color || '#f59e0b',
        priority: priority || 'medium', dueDate: dueDate ? new Date(dueDate) : null, createdBy,
        members: { create: [{ userId: createdBy, role: 'owner' }, ...filteredMemberIds.map((id: string) => ({ userId: id, role: 'member' }))] }
      },
      include: {
        creator: { select: { id: true, name: true, role: true } },
        members: { include: { user: { select: { id: true, name: true, role: true, avatar: true } } } },
        _count: { select: { tasks: true, members: true } }
      }
    })
    await db.activityLog.create({ data: { action: 'project_created', details: `Created project "${name}"`, userId: createdBy, projectId: project.id } })
    return NextResponse.json({ project }, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}