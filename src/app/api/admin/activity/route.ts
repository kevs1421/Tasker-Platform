import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    let activities
    if (userId) {
      activities = await db.activityLog.findMany({
        where: {
          OR: [
            { userId },
            { project: { members: { some: { userId } } } }
          ]
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      })
    } else {
      activities = await db.activityLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
      })
    }

    // Manually fetch user info for each activity
    const enrichedActivities = await Promise.all(activities.map(async (act) => {
      let user = null
      if (act.userId) {
        user = await db.user.findUnique({ where: { id: act.userId }, select: { id: true, name: true, role: true, avatar: true } })
      }
      return { ...act, user }
    }))

    const pendingOnboarding = await db.onboarding.count({ where: { status: 'submitted' } })
    return NextResponse.json({ activities: enrichedActivities, pendingOnboarding })
  } catch (e) {
    console.error('Activity API error:', e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}