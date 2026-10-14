import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, handleApiError } from '@/lib/api-auth'

export async function GET(request: NextRequest) {
  try {
    const authed = await requireAuth(request)
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    // For client users, return client-scoped stats based on their assigned projects
    if (authed.role === 'client') {
      const clientId = userId || authed.id

      // Get all projects visible to this client (via ClientProject or ProjectMember)
      const clientProjectLinks = await db.clientProject.findMany({
        where: { clientId },
        select: { projectId: true },
      })
      const memberLinks = await db.projectMember.findMany({
        where: { userId: clientId },
        select: { projectId: true },
      })
      const allProjectIds = [...new Set([
        ...clientProjectLinks.map(l => l.projectId),
        ...memberLinks.map(m => m.projectId),
      ])]

      // Back-fill missing ClientProject links
      const linkedIds = new Set(clientProjectLinks.map(l => l.projectId))
      const missingIds = [...new Set(memberLinks.map(m => m.projectId))].filter(id => !linkedIds.has(id))
      if (missingIds.length > 0) {
        try {
          await Promise.all(
            missingIds.map(projectId =>
              db.clientProject.upsert({
                where: { clientId_projectId: { clientId, projectId } },
                create: { clientId, projectId },
                update: {},
              })
            )
          )
        } catch { /* ignore backfill errors */ }
      }

      // Get tasks only from client's projects
      const clientTasks = await db.task.findMany({
        where: { projectId: { in: allProjectIds } },
        select: { id: true, status: true, dueDate: true, updatedAt: true },
      })

      const now = new Date()
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

      const totalTasks = clientTasks.length
      const completedTasks = clientTasks.filter(t => t.status === 'done').length
      const inProgressTasks = clientTasks.filter(t => t.status === 'in_progress').length
      const inReviewTasks = clientTasks.filter(t => t.status === 'in_review').length
      const todoTasks = clientTasks.filter(t => t.status === 'todo').length
      const overdueTasks = clientTasks.filter(t =>
        t.dueDate && new Date(t.dueDate) < now && t.status !== 'done'
      ).length
      const thisWeekCompleted = clientTasks.filter(t =>
        t.status === 'done' && t.updatedAt >= weekAgo
      ).length

      // Projects count for client
      const activeProjects = await db.project.count({
        where: { id: { in: allProjectIds }, status: 'active' },
      })

      return NextResponse.json({
        stats: {
          totalTasks,
          completedTasks,
          inProgressTasks,
          inReviewTasks,
          todoTasks,
          overdueTasks,
          totalProjects: allProjectIds.length,
          activeProjects,
          totalMembers: 0,
          totalClients: 0,
          thisWeekCompleted,
        },
        userStats: null,
      })
    }

    // For non-client users (admin, team, training), return global stats
    const totalTasks = await db.task.count()
    const completedTasks = await db.task.count({ where: { status: 'done' } })
    const inProgressTasks = await db.task.count({ where: { status: 'in_progress' } })
    const inReviewTasks = await db.task.count({ where: { status: 'in_review' } })
    const totalProjects = await db.project.count()
    const activeProjects = await db.project.count({ where: { status: 'active' } })
    const totalMembers = await db.user.count({ where: { role: { in: ['admin', 'team', 'training'] } } })
    const totalClients = await db.user.count({ where: { role: 'client' } })

    const now = new Date()
    const overdueTasks = await db.task.count({
      where: {
        dueDate: { lt: now },
        status: { notIn: ['done'] }
      }
    })

    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const thisWeekCompleted = await db.task.count({
      where: {
        status: 'done',
        updatedAt: { gte: weekAgo }
      }
    })

    const todoTasks = await db.task.count({ where: { status: 'todo' } })

    let userStats: { assigned: number; completed: number; inProgress: number; overdue: number } | null = null
    if (userId) {
      const userTasks = await db.taskAssignment.findMany({
        where: { userId },
        include: { task: true }
      })

      userStats = {
        assigned: userTasks.length,
        completed: userTasks.filter(a => a.task.status === 'done').length,
        inProgress: userTasks.filter(a => a.task.status === 'in_progress').length,
        overdue: userTasks.filter(a =>
          a.task.dueDate && new Date(a.task.dueDate) < now && a.task.status !== 'done'
        ).length,
      }
    }

    return NextResponse.json({
      stats: {
        totalTasks,
        completedTasks,
        inProgressTasks,
        inReviewTasks,
        todoTasks,
        overdueTasks,
        totalProjects,
        activeProjects,
        totalMembers,
        totalClients,
        thisWeekCompleted,
      },
      userStats
    })
  } catch (error) {
    return handleApiError(error)
  }
}