import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, handleApiError } from '@/lib/api-auth'

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    const where: Record<string, unknown> = {}
    if (userId) {
      where.OR = [
        { userId },
      ]
    }

    const activities = await db.activityLog.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    // Batch-fetch all unique userIds in a single query
    const userIds = [...new Set(activities.map(a => a.userId).filter(Boolean))] as string[]
    const users = userIds.length > 0
      ? await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, role: true, avatar: true } })
      : []
    const userMap = new Map(users.map(u => [u.id, u]))

    const enrichedActivities = activities.map(act => ({
      ...act,
      user: act.userId ? (userMap.get(act.userId) ?? null) : null,
    }))

    const pendingOnboarding = await db.onboarding.count({ where: { status: 'submitted' } })
    return NextResponse.json({ activities: enrichedActivities, pendingOnboarding })
  } catch (error) {
    return handleApiError(error)
  }
}