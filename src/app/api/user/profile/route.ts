import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyPassword, hashPassword } from '@/lib/auth'
import { requireAuth, handleApiError } from '@/lib/api-auth'

export async function GET(request: NextRequest) {
  try {
    const authed = await requireAuth(request)
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

    // Authorization: non-admin users can only view their own profile
    if (authed.role !== 'admin' && authed.id !== userId) {
      return NextResponse.json({ error: 'You can only view your own profile' }, { status: 403 })
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, phone: true, company: true, avatar: true, role: true, status: true, createdAt: true, updatedAt: true }
    })
    if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ user })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const authed = await requireAuth(request)
    const { userId, name, phone, company, email, currentPassword, newPassword } = await request.json()
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

    // Authorization: non-admin users can only edit their own profile
    if (authed.role !== 'admin' && authed.id !== userId) {
      return NextResponse.json({ error: 'You can only edit your own profile' }, { status: 403 })
    }

    const data: Record<string, string | null> = {}
    if (name) data.name = name
    if (phone !== undefined) data.phone = phone
    if (company !== undefined) data.company = company
    if (email) data.email = email

    if (currentPassword && newPassword) {
      const user = await db.user.findUnique({ where: { id: userId } })
      if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })
      // Verify current password
      const valid = await verifyPassword(currentPassword, user.password)
      if (!valid) return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 })
      data.password = await hashPassword(newPassword)
    }

    const user = await db.user.update({ where: { id: userId }, data })
    const { password: _, ...safeUser } = user
    return NextResponse.json({ user: safeUser })
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'P2002') {
      return NextResponse.json({ error: 'Email already in use' }, { status: 409 })
    }
    return handleApiError(error)
  }
}