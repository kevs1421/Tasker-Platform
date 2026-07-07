import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const { email, password, name, role, phone, company } = await request.json()
    if (!email || !password || !name) return NextResponse.json({ error: 'Email, password, and name are required' }, { status: 400 })
    if (password.length < 6) return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })

    const existing = await db.user.findUnique({ where: { email } })
    if (existing) return NextResponse.json({ error: 'Email already exists' }, { status: 409 })

    const user = await db.user.create({
      data: { email, password: await hashPassword(password), name, role: role || 'client', phone: phone || null, company: company || null }
    })
    const { password: _, ...safeUser } = user
    return NextResponse.json({ user: safeUser }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}