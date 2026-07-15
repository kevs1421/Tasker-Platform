import { NextResponse } from 'next/server'

export async function POST() {
  // Simple logout - client will clear state
  return NextResponse.json({ success: true })
}