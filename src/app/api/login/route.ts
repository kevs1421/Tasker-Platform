import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyPassword } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()
    if (!email || !password) return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })

    const user = await db.user.findUnique({ where: { email } })
    if (!user || !(await verifyPassword(password, user.password)))
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    if (user.status === 'inactive')
      return NextResponse.json({ error: 'Account is inactive' }, { status: 403 })

    const { password: _, ...safeUser } = user
    return NextResponse.json({ user: safeUser })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}