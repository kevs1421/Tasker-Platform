import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/session'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ valid: false }, { status: 401 })
    }
    return NextResponse.json({ valid: true, user })
  } catch {
    return NextResponse.json({ valid: false }, { status: 401 })
  }
}
