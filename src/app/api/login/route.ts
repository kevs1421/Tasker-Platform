import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyPassword } from '@/lib/auth'
import { createSession } from '@/lib/session'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()
    if (!email || !password) return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })

    const user = await db.user.findUnique({ where: { email } })
    if (!user || !(await verifyPassword(password, user.password)))
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    if (user.status === 'inactive')
      return NextResponse.json({ error: 'Account is inactive' }, { status: 403 })

    // Create a server-side session and return the token
    const token = await createSession(user.id)

    const { password: _, ...safeUser } = user
    return NextResponse.json({ user: safeUser, token })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
