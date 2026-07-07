import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, phone: true, company: true, avatar: true, role: true, status: true, createdAt: true, updatedAt: true }
    })
    if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ user })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { userId, name, phone, company, email, currentPassword, newPassword } = await request.json()
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

    const data: Record<string, string | null> = {}
    if (name) data.name = name
    if (phone !== undefined) data.phone = phone
    if (company !== undefined) data.company = company
    if (email) data.email = email

    if (currentPassword && newPassword) {
      const user = await db.user.findUnique({ where: { id: userId } })
      if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })
      // Verify current password
      const encoder = new TextEncoder()
      const hashBuf = await crypto.subtle.digest('SHA-256', encoder.encode(currentPassword))
      const hash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('')
      if (hash !== user.password) return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 })
      const newHashBuf = await crypto.subtle.digest('SHA-256', encoder.encode(newPassword))
      data.password = Array.from(new Uint8Array(newHashBuf)).map(b => b.toString(16).padStart(2, '0')).join('')
    }

    const user = await db.user.update({ where: { id: userId }, data })
    const { password: _, ...safeUser } = user
    return NextResponse.json({ user: safeUser })
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'code' in e && (e as { code: string }).code === 'P2002') {
      return NextResponse.json({ error: 'Email already in use' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }
}