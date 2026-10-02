import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, handleApiError } from '@/lib/api-auth'

// Centralized role permission map to keep GET and POST aligned
const ALLOWED_RECIPIENTS: Record<string, string[]> = {
  admin: ['admin', 'team', 'client', 'training'],
  team: ['admin', 'team', 'client', 'training'],
  training: ['admin', 'team'],
  client: ['admin', 'team'],
}

function canMessageRole(senderRole: string, receiverRole: string): boolean {
  return ALLOWED_RECIPIENTS[senderRole]?.includes(receiverRole) ?? false
}

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request)
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const otherId = searchParams.get('otherId')
    const groupId = searchParams.get('groupId')

    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

    // ── Group message thread ───────────────────────────────
    if (groupId) {
      // Verify membership
      const membership = await db.groupMember.findUnique({
        where: { groupId_userId: { groupId, userId } },
      })
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
        // Get current user role for visibility filtering
        const currentUser = await db.user.findUnique({
          where: { id: userId },
          select: { role: true },
        })

        // Direct conversations
        const sent = await db.message.findMany({
          where: { senderId: userId, groupId: null },
          distinct: ['receiverId'],
          select: { receiverId: true },
        })
        const received = await db.message.findMany({
          where: { receiverId: userId, groupId: null },
          distinct: ['senderId'],
          select: { senderId: true },
        })

        const conversationIds = [
          ...new Set([...sent.map((m) => m.receiverId), ...received.map((m) => m.senderId)]),
        ].filter(Boolean) as string[]

        const conversations = await Promise.all(
          conversationIds.map(async (otherUserId) => {
            const otherUser = await db.user.findUnique({
              where: { id: otherUserId },
              select: { id: true, name: true, email: true, role: true, avatar: true, company: true },
            })

            // Filter out conversations with users this role cannot message
            if (otherUser && currentUser && !canMessageRole(currentUser.role, otherUser.role)) {
              return null
            }

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

        const visibleConversations = conversations.filter(
          (c): c is NonNullable<typeof c> => c !== null
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
          ...visibleConversations.map((c) => {
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
            lastMessage: c.lastMessage
              ? {
                  ...c.lastMessage,
                  createdAt:
                    c.lastMessage.createdAt instanceof Date
                      ? c.lastMessage.createdAt.toISOString()
                      : String(c.lastMessage.createdAt),
                }
              : null,
          })),
        })
      } catch {
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
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth(request)
    const { content, senderId, receiverId, groupId, projectId } = await request.json()
    if (!content || !senderId) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    // Must target either a user or a group, not both
    if (!receiverId && !groupId) {
      return NextResponse.json({ error: 'receiverId or groupId required' }, { status: 400 })
    }

    // ── Role-based messaging permission (server-side enforcement) ───────
    // admin & team → can message admin, team, client, training
    // training     → can message admin, team only
    // client       → can message admin, team only
    if (receiverId) {
      const [sender, receiver] = await Promise.all([
        db.user.findUnique({ where: { id: senderId }, select: { role: true } }),
        db.user.findUnique({ where: { id: receiverId }, select: { role: true } }),
      ])

      if (!sender || !receiver) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }

      if (!canMessageRole(sender.role, receiver.role)) {
        return NextResponse.json({ error: 'Not allowed to message this user' }, { status: 403 })
      }
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
    return handleApiError(error)
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireAuth(request)
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const messageId = searchParams.get('id')
    const deleteConversation = searchParams.get('deleteConversation')
    const otherId = searchParams.get('otherId')
    const groupId = searchParams.get('groupId')

    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

    // Delete a single message
    if (messageId && !deleteConversation) {
      const msg = await db.message.findUnique({ where: { id: messageId } })
      if (!msg) return NextResponse.json({ error: 'Message not found' }, { status: 404 })
      
      const userRecord = await db.user.findUnique({ where: { id: userId }, select: { role: true } })
      if (msg.senderId !== userId && userRecord?.role !== 'admin') {
        return NextResponse.json({ error: 'Cannot delete this message' }, { status: 403 })
      }
      await db.message.delete({ where: { id: messageId } })
      return NextResponse.json({ success: true })
    }

    // Delete a direct conversation (all messages between two users)
    if (deleteConversation && otherId) {
      await db.message.deleteMany({
        where: {
          OR: [
            { senderId: userId, receiverId: otherId, groupId: null },
            { senderId: otherId, receiverId: userId, groupId: null },
          ],
        },
      })
      return NextResponse.json({ success: true })
    }

    // Delete a group conversation (delete the group + all messages + members)
    if (deleteConversation && groupId) {
      const group = await db.messageGroup.findUnique({ where: { id: groupId } })
      if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 })

      const userRecord = await db.user.findUnique({ where: { id: userId }, select: { role: true } })
      if (group.createdBy !== userId && userRecord?.role !== 'admin') {
        return NextResponse.json({ error: 'Cannot delete this group' }, { status: 403 })
      }
      await db.messageGroup.delete({ where: { id: groupId } })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid delete request' }, { status: 400 })
  } catch (error) {
    return handleApiError(error)
  }
}