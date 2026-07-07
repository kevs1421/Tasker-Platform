import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  // Simple logout - client will clear state
  return NextResponse.json({ success: true })
}