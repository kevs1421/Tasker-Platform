import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const otherId = searchParams.get('otherId')
    const projectId = searchParams.get('projectId')

    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

    // Get conversation list
    if (!otherId) {
      // Get all conversations for this user
      const sent = await db.message.findMany({ where: { senderId: userId }, distinct: ['receiverId'], select: { receiverId: true } })
      const received = await db.message.findMany({ where: { receiverId: userId }, distinct: ['senderId'], select: { senderId: true } })
      const conversationIds = [...new Set([...sent.map(m => m.receiverId), ...received.map(m => m.senderId)])]

      const conversations = await Promise.all(conversationIds.map(async (otherUserId) => {
        const otherUser = await db.user.findUnique({ where: { id: otherUserId }, select: { id: true, name: true, email: true, role: true, avatar: true, company: true } })
        const lastMessage = await db.message.findFirst({
          where: { OR: [{ senderId: userId, receiverId: otherUserId }, { senderId: otherUserId, receiverId: userId }] },
          orderBy: { createdAt: 'desc' }, include: { sender: { select: { id: true, name: true } } }
        })
        const unread = await db.message.count({ where: { senderId: otherUserId, receiverId: userId, read: false } })
        return { user: otherUser, lastMessage, unread }
      }))

      conversations.sort((a, b) => (b.lastMessage?.createdAt || '').localeCompare(a.lastMessage?.createdAt || ''))
      return NextResponse.json({ conversations })
    }

    // Get messages between two users
    const messages = await db.message.findMany({
      where: { OR: [{ senderId: userId, receiverId: otherId }, { senderId: otherId, receiverId: userId }] },
      include: { sender: { select: { id: true, name: true, avatar: true } }, receiver: { select: { id: true, name: true, avatar: true } } },
      orderBy: { createdAt: 'asc' }
    })

    // Mark as read
    await db.message.updateMany({ where: { senderId: otherId, receiverId: userId, read: false }, data: { read: true } })

    return NextResponse.json({ messages })
  } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }) }
}

export async function POST(request: NextRequest) {
  try {
    const { content, senderId, receiverId, projectId } = await request.json()
    if (!content || !senderId || !receiverId) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const message = await db.message.create({
      data: { content, senderId, receiverId, projectId: projectId || null },
      include: { sender: { select: { id: true, name: true, avatar: true } }, receiver: { select: { id: true, name: true, avatar: true } } }
    })
    return NextResponse.json({ message }, { status: 201 })
  } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }) }
}