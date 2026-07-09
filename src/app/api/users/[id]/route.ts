import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

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