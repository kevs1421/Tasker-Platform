import { NextRequest, NextResponse } from 'next/server'
import { extractToken, deleteSession } from '@/lib/session'

export async function POST(request: NextRequest) {
  try {
    const token = extractToken(request)
    if (token) {
      await deleteSession(token)
    }
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to logout' }, { status: 500 })
  }
}
