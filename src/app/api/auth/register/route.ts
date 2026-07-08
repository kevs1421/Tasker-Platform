import { NextRequest, NextResponse } from 'next/server'

// Public registration is disabled.
// Only admins can create new users through the admin dashboard.
export async function POST() {
  return NextResponse.json(
    { error: 'Registration is disabled. Please contact an administrator to create an account.' },
    { status: 403 }
  )
}