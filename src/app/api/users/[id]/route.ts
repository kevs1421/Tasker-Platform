import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/auth'
import { requireAuth, requireAdmin, handleApiError } from '@/lib/api-auth'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth(req)
    const { id } = await params
    const user = await db.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true, phone: true, company: true, avatar: true, role: true, status: true, createdAt: true, updatedAt: true, _count: { select: { assignedTasks: true, createdTasks: true, sentMessages: true } } }
    })
    if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ user })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Require admin session
    await requireAdmin(req)

    const { id } = await params
    const user = await db.user.findUnique({ where: { id }, select: { id: true, name: true } })
    if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await db.user.delete({ where: { id } })
    await db.activityLog.create({ data: { action: 'user_deleted', details: `Deleted user "${user.name}"` } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error)
  }
}

// Reset password for a user (admin-only action)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Verify the requester is an authenticated admin via session token
    const admin = await requireAdmin(req)

    const { id } = await params
    const body = await req.json()
    const { newPassword } = body

    if (!newPassword) {
      return NextResponse.json({ error: 'New password is required' }, { status: 400 })
    }
    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    }

    const user = await db.user.findUnique({ where: { id }, select: { id: true, name: true } })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    await db.user.update({
      where: { id },
      data: { password: await hashPassword(newPassword) }
    })

    await db.activityLog.create({
      data: {
        action: 'password_reset',
        userId: admin.id,
        details: `Admin reset password for user "${user.name}" (${id.slice(0, 6)}...)`
      }
    })

    return NextResponse.json({ success: true, message: `Password has been reset for "${user.name}"` })
  } catch (error) {
    return handleApiError(error)
  }
}
