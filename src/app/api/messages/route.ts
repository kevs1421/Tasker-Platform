import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const otherId = searchParams.get('otherId')
    const groupId = searchParams.get('groupId')

    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

    // ── Group message thread ───────────────────────────────
    if (groupId) {
      // Verify membership
      const membership = await db.groupMember.findUnique({ where: { groupId_userId: { groupId, userId } } })
      if (!membership) return NextResponse.json({ error: 'Not a member' }, { status: 403 })

      const messages = await db.message.findMany({
        where: { groupId },
        include: { sender: { select: { id: true, name: true, avatar: true, role: true } } },
        orderBy: { createdAt: 'asc' },
      })

      // Mark all unread messages in this group as read for this user
      await db.message.updateMany({
        where: { groupId, senderId: { not: userId }, read: false },
        data: { read: true },
      })

      return NextResponse.json({ messages })
    }

    // ── Conversation list (no otherId, no groupId) ─────────
    if (!otherId) {
      try {
      // Direct conversations
      const sent = await db.message.findMany({ where: { senderId: userId, groupId: null }, distinct: ['receiverId'], select: { receiverId: true } })
      const received = await db.message.findMany({ where: { receiverId: userId, groupId: null }, distinct: ['senderId'], select: { senderId: true } })
      const conversationIds = [...new Set([...sent.map((m) => m.receiverId!).filter(Boolean), ...received.map((m) => m.senderId)])]

      const conversations = await Promise.all(
        conversationIds.map(async (otherUserId) => {
          const otherUser = await db.user.findUnique({
            where: { id: otherUserId },
            select: { id: true, name: true, email: true, role: true, avatar: true, company: true },
          })
          const lastMessage = await db.message.findFirst({
            where: {
              OR: [
                { senderId: userId, receiverId: otherUserId, groupId: null },
                { senderId: otherUserId, receiverId: userId, groupId: null },
              ],
            },
            orderBy: { createdAt: 'desc' },
            include: { sender: { select: { id: true, name: true } } },
          })
          const unread = await db.message.count({
            where: { senderId: otherUserId, receiverId: userId, read: false, groupId: null },
          })
          return { type: 'direct' as const, user: otherUser, lastMessage, unread }
        })
      )

      // Group conversations
      const groups = await db.messageGroup.findMany({
        where: { members: { some: { userId } } },
        include: {
          members: { include: { user: { select: { id: true, name: true, avatar: true } } } },
          _count: { select: { members: true } },
        },
      })

      const groupConversations = await Promise.all(
        groups.map(async (g) => {
          const lastMessage = await db.message.findFirst({
            where: { groupId: g.id },
            orderBy: { createdAt: 'desc' },
            include: { sender: { select: { id: true, name: true } } },
          })
          const unread = await db.message.count({
            where: { groupId: g.id, senderId: { not: userId }, read: false },
          })
          return {
            type: 'group' as const,
            group: {
              id: g.id,
              name: g.name,
              avatar: g.avatar,
              members: g.members,
              _count: g._count,
              createdAt: g.createdAt.toISOString(),
              updatedAt: g.updatedAt.toISOString(),
            },
            lastMessage,
            unread,
          }
        })
      )

      // Merge and sort all by most recent message
      const allConversations = [
        ...conversations.map((c) => {
          const t = c.lastMessage?.createdAt
          return { ...c, lastTime: t instanceof Date ? t.toISOString() : (t ?? '') }
        }),
        ...groupConversations.map((c) => {
          const t = c.lastMessage?.createdAt
          return { ...c, lastTime: t instanceof Date ? t.toISOString() : (t ?? '') }
        }),
      ].sort((a, b) => b.lastTime.localeCompare(a.lastTime))

      return NextResponse.json({ 
        conversations: allConversations.map(({ lastTime: _, ...c }) => ({
          ...c,
          lastMessage: c.lastMessage ? {
            ...c.lastMessage,
            createdAt: c.lastMessage.createdAt instanceof Date ? c.lastMessage.createdAt.toISOString() : String(c.lastMessage.createdAt),
          } : null,
        }))
      })
      } catch (innerErr) {
        console.error('Conversation list error:', innerErr)
        return NextResponse.json({ error: 'Failed to load conversations' }, { status: 500 })
      }
    }

    // ── Direct message thread (otherId provided) ───────────
    const messages = await db.message.findMany({
      where: {
        OR: [
          { senderId: userId, receiverId: otherId, groupId: null },
          { senderId: otherId, receiverId: userId, groupId: null },
        ],
      },
      include: {
        sender: { select: { id: true, name: true, avatar: true, role: true } },
        receiver: { select: { id: true, name: true, avatar: true, role: true } },
      },
      orderBy: { createdAt: 'asc' },
    })

    // Mark as read
    await db.message.updateMany({
      where: { senderId: otherId, receiverId: userId, read: false, groupId: null },
      data: { read: true },
    })

    return NextResponse.json({ messages })
  } catch (error) {
    console.error('Messages GET error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { content, senderId, receiverId, groupId, projectId } = await request.json()
    if (!content || !senderId) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    // Must target either a user or a group, not both
    if (!receiverId && !groupId) {
      return NextResponse.json({ error: 'receiverId or groupId required' }, { status: 400 })
    }

    const message = await db.message.create({
      data: {
        content,
        senderId,
        receiverId: receiverId || null,
        groupId: groupId || null,
        projectId: projectId || null,
      },
      include: {
        sender: { select: { id: true, name: true, avatar: true, role: true } },
        receiver: { select: { id: true, name: true, avatar: true, role: true } },
      },
    })

    // Update group timestamp
    if (groupId) {
      await db.messageGroup.update({ where: { id: groupId }, data: { updatedAt: new Date() } })
    }

    return NextResponse.json({ message }, { status: 201 })
  } catch (error) {
    console.error('Messages POST error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}