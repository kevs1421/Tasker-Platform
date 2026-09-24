import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, handleApiError } from '@/lib/api-auth'

// GET /api/message-groups?userId=xxx — List groups for a user
export async function GET(request: NextRequest) {
  try {
    await requireAuth(request)
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

    const groups = await db.messageGroup.findMany({
      where: { members: { some: { userId } } },
      include: {
        creator: { select: { id: true, name: true, avatar: true } },
        members: { include: { user: { select: { id: true, name: true, avatar: true, role: true } } } },
        _count: { select: { messages: true, members: true } },
      },
      orderBy: { updatedAt: 'desc' },
    })

    // Add unread count for each group
    const groupsWithUnread = await Promise.all(groups.map(async (g) => {
      const unread = await db.message.count({
        where: { groupId: g.id, senderId: { not: userId }, read: false },
      })
      const lastMessage = await db.message.findFirst({
        where: { groupId: g.id },
        orderBy: { createdAt: 'desc' },
        include: { sender: { select: { id: true, name: true, avatar: true } } },
      })
      return { ...g, unread, lastMessage }
    }))

    return NextResponse.json({ groups: groupsWithUnread })
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/message-groups — Create a new group
export async function POST(request: NextRequest) {
  try {
    await requireAuth(request)
    const { name, createdBy, memberIds } = await request.json()
    if (!name || !createdBy || !Array.isArray(memberIds)) {
      return NextResponse.json({ error: 'name, createdBy, memberIds required' }, { status: 400 })
    }

    // Creator must be a member
    const allMemberIds = [...new Set([...memberIds, createdBy])]

    const group = await db.messageGroup.create({
      data: {
        name,
        createdBy,
        members: {
          create: allMemberIds.map((userId: string) => ({
            userId,
            role: userId === createdBy ? 'admin' : 'member',
          })),
        },
      },
      include: {
        creator: { select: { id: true, name: true, avatar: true } },
        members: { include: { user: { select: { id: true, name: true, avatar: true, role: true } } } },
        _count: { select: { messages: true, members: true } },
      },
    })

    return NextResponse.json({ group }, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}