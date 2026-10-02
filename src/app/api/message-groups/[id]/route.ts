import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, handleApiError } from '@/lib/api-auth'

// GET /api/message-groups/[id]?userId=xxx — Get group detail
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(request)
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    const group = await db.messageGroup.findUnique({
      where: { id },
      include: {
        creator: { select: { id: true, name: true, avatar: true } },
        members: { include: { user: { select: { id: true, name: true, avatar: true, role: true, company: true } } } },
        _count: { select: { messages: true, members: true } },
      },
    })

    if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 })

    // Check membership
    if (userId && !group.members.some((m) => m.userId === userId)) {
      return NextResponse.json({ error: 'Not a member' }, { status: 403 })
    }

    return NextResponse.json({ group })
  } catch (error) {
    return handleApiError(error)
  }
}

// PATCH /api/message-groups/[id] — Update group name or add/remove members
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request)
    const { id } = await params
    const body = await request.json()
    const { name, addMemberIds, removeMemberIds } = body as {
      name?: string
      addMemberIds?: string[]
      removeMemberIds?: string[]
    }

    if (name !== undefined) {
      await db.messageGroup.update({ where: { id }, data: { name } })
    }

    if (addMemberIds && addMemberIds.length > 0) {
      // Role-based check — same rules as creating groups
      const canMessageRole = (senderRole: string, receiverRole: string): boolean => {
        if (senderRole === 'admin' || senderRole === 'team') return receiverRole !== 'training'
        if (senderRole === 'training') return receiverRole === 'admin' || receiverRole === 'team'
        if (senderRole === 'client') return receiverRole === 'admin' || receiverRole === 'team'
        return false
      }
      const members = await db.user.findMany({ where: { id: { in: addMemberIds } }, select: { id: true, role: true } })
      for (const member of members) {
        if (!canMessageRole(user.role, member.role)) {
          return NextResponse.json({ error: `Cannot add user with role '${member.role}' to group` }, { status: 403 })
        }
      }

      await db.groupMember.createMany({
        data: addMemberIds.map((userId) => ({ groupId: id, userId, role: 'member' })),
      })
    }

    if (removeMemberIds && removeMemberIds.length > 0) {
      await db.groupMember.deleteMany({
        where: { groupId: id, userId: { in: removeMemberIds } },
      })
    }

    // Re-fetch updated group
    const group = await db.messageGroup.findUnique({
      where: { id },
      include: {
        creator: { select: { id: true, name: true, avatar: true } },
        members: { include: { user: { select: { id: true, name: true, avatar: true, role: true } } } },
        _count: { select: { messages: true, members: true } },
      },
    })

    return NextResponse.json({ group })
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/message-groups/[id] — Delete a group
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(request)
    const { id } = await params
    await db.messageGroup.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error)
  }
}