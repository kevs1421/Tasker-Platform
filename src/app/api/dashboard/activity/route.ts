import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    let whereClause: { userId?: string; projectId?: { in: string[] } } = {}
    if (userId) {
      const memberProjectIds = await db.projectMember.findMany({
        where: { userId },
        select: { projectId: true },
      }).then((m) => m.map((x) => x.projectId))
      whereClause = {
        OR: [
          { userId },
          ...(memberProjectIds.length > 0 ? [{ projectId: { in: memberProjectIds } }] : []),
        ],
      } as unknown as { userId?: string; projectId?: { in: string[] } }
    }

    const activities = await db.activityLog.findMany({
      where: Object.keys(whereClause).length > 0 ? whereClause : undefined,
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    // Fetch user info for activities that have userId
    const userIds = [...new Set(activities.map((a) => a.userId).filter(Boolean))] as string[]
    const users = userIds.length > 0
      ? await db.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, email: true, role: true, avatar: true },
        })
      : []
    const userMap = new Map(users.map((u) => [u.id, u]))

    const enriched = activities.map((a) => ({
      ...a,
      user: a.userId ? userMap.get(a.userId) ?? null : null,
    }))

    return NextResponse.json({ activities: enriched })
  } catch (error) {
    console.error('Activity fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch activities' }, { status: 500 })
  }
}
