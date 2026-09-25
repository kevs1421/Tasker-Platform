import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, handleApiError } from '@/lib/api-auth'

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)
    const users = await db.user.findMany({
      select: { id: true, email: true, name: true, phone: true, company: true, avatar: true, role: true, status: true, createdAt: true, _count: { select: { assignedTasks: true, createdTasks: true, sentMessages: true } } },
      orderBy: { createdAt: 'desc' }
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