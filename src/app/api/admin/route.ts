import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, handleApiError } from '@/lib/api-auth'

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)
    const totalTasks = await db.task.count()
    const completedTasks = await db.task.count({ where: { status: 'done' } })
    const inProgressTasks = await db.task.count({ where: { status: 'in_progress' } })
    const inReviewTasks = await db.task.count({ where: { status: 'in_review' } })
    const todoTasks = await db.task.count({ where: { status: 'todo' } })
    const overdueTasks = await db.task.count({ where: { dueDate: { lt: new Date() }, status: { notIn: ['done'] } } })
    const totalProjects = await db.project.count()
    const activeProjects = await db.project.count({ where: { status: 'active' } })
    const totalMembers = await db.user.count({ where: { role: { in: ['admin', 'team', 'training'] } } })
    const totalClients = await db.user.count({ where: { role: 'client' } })
    const weekAgo = new Date(Date.now() - 7 * 86400000)
    const thisWeekCompleted = await db.task.count({ where: { status: 'done', updatedAt: { gte: weekAgo } } })

    return NextResponse.json({ stats: { totalTasks, completedTasks, inProgressTasks, inReviewTasks, todoTasks, overdueTasks, totalProjects, activeProjects, totalMembers, totalClients, thisWeekCompleted } })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireAdmin(request)
    const body = await request.json()
    const { userId } = body
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

    const userTasks = await db.taskAssignment.findMany({ where: { userId }, include: { task: true } })
    const now = new Date()
    const userStats = {
      assigned: userTasks.length,
      completed: userTasks.filter(a => a.task.status === 'done').length,
      inProgress: userTasks.filter(a => a.task.status === 'in_progress').length,
      overdue: userTasks.filter(a => a.task.dueDate && new Date(a.task.dueDate) < now && a.task.status !== 'done').length,
    }
    return NextResponse.json({ userStats })
  } catch (error) {
    return handleApiError(error)
  }
}