import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, requireAuth, handleApiError } from '@/lib/api-auth'

export async function GET(request: NextRequest) {
  try {
    // Allow all authenticated users to fetch the user list (needed for messaging).
    // If the user is an admin, return the full user list with counts and all statuses.
    // Non-admin users get a simplified list of active users only.
    const authed = await requireAuth(request)

    if (authed.role === 'admin') {
      const users = await db.user.findMany({
        select: { id: true, email: true, name: true, phone: true, company: true, avatar: true, role: true, status: true, createdAt: true, _count: { select: { assignedTasks: true, createdTasks: true, sentMessages: true } } },
        orderBy: { createdAt: 'desc' }
      })
      return NextResponse.json({ users })
    }

    // Non-admin: return active users only, with minimal fields for messaging
    const users = await db.user.findMany({
      where: { status: 'active' },
      select: { id: true, email: true, name: true, phone: true, company: true, avatar: true, role: true, status: true, createdAt: true },
      orderBy: { name: 'asc' }
    })
    return NextResponse.json({ users })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireAdmin(request)
    const { id, role, status, name, email, phone, company } = await request.json()
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

    // Validate role and status values
    const VALID_ROLES = ['admin', 'team', 'training', 'client']
    const VALID_STATUSES = ['active', 'inactive', 'pending']
    if (role !== undefined && !VALID_ROLES.includes(role)) {
      return NextResponse.json({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` }, { status: 400 })
    }
    if (status !== undefined && !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 400 })
    }

    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (role !== undefined) updateData.role = role
    if (status !== undefined) updateData.status = status
    if (email !== undefined) updateData.email = email
    if (phone !== undefined) updateData.phone = phone
    if (company !== undefined) updateData.company = company

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    // Check email uniqueness if changing email
    if (updateData.email) {
      const existing = await db.user.findFirst({ where: { email: updateData.email as string, id: { not: id } } })
      if (existing) {
        return NextResponse.json({ error: 'Email already in use by another user' }, { status: 409 })
      }
    }

    const user = await db.user.update({ where: { id }, data: updateData })
    const { password: _, ...safeUser } = user
    return NextResponse.json({ user: safeUser })
  } catch (error) {
    return handleApiError(error)
  }
}
