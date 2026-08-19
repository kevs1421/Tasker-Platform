import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const role = searchParams.get('role')

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
    console.error('Dashboard stats error:', error)
    return NextResponse.json({ error: 'Failed to fetch dashboard stats' }, { status: 500 })
  }
}