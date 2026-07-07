import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const users = await db.user.findMany({
      select: { id: true, email: true, name: true, phone: true, company: true, avatar: true, role: true, status: true, createdAt: true, _count: { select: { assignedTasks: true, createdTasks: true, sentMessages: true } } },
      orderBy: { createdAt: 'desc' }
    })
    return NextResponse.json({ users })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const { id, role, status, name } = await request.json()
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
    const user = await db.user.update({ where: { id }, data: { ...(role && { role }), ...(status && { status }), ...(name && { name }) } })
    const { password: _, ...safeUser } = user
    return NextResponse.json({ user: safeUser })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}