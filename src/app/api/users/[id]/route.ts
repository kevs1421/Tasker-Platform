import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/auth'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await db.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true, phone: true, company: true, avatar: true, role: true, status: true, createdAt: true, updatedAt: true, _count: { select: { assignedTasks: true, createdTasks: true, sentMessages: true } } }
    })
    if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ user })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await db.user.findUnique({ where: { id }, select: { id: true, name: true } })
    if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await db.user.delete({ where: { id } })
    await db.activityLog.create({ data: { action: 'user_deleted', details: `Deleted user "${user.name}"` } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete user. They may have related records that need to be removed first.' }, { status: 500 })
  }
}

// Reset password for a user (admin-only action)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const { newPassword, adminUserId } = body

    if (!adminUserId) {
      return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 401 })
    }

    const admin = await db.user.findUnique({ where: { id: adminUserId } })
    if (!admin || admin.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Only admins can reset passwords' }, { status: 403 })
    }

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
        userId: adminUserId,
        details: `Admin reset password for user "${user.name}" (${id.slice(0, 6)}...)`
      }
    })

    return NextResponse.json({ success: true, message: `Password has been reset for "${user.name}"` })
  } catch (err) {
    console.error('Password reset error:', err)
    return NextResponse.json({ error: 'Failed to reset password' }, { status: 500 })
  }
}