import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const role = searchParams.get('role')

    let where: Record<string, unknown> = {}
    if (userId) {
      where = {
        OR: [
          { userId },
          { project: { members: { some: { userId } } } }
        ]
      }
    }

    const activities = await db.activityLog.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      include: {
        user: { select: { id: true, name: true, email: true, role: true, avatar: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    })

    return NextResponse.json({ activities })
  } catch (error) {
    console.error('Activity fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch activities' }, { status: 500 })
  }
}