import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/screenshot-config?userId=xxx
// Returns the admin-configured global settings, or per-user overrides
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 })
    }

    // Get user role
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { role: true },
    })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Only admin can read config
    if (user.role !== 'admin') {
      // Non-admin users just get a minimal response for client-side use
      return NextResponse.json({
        autoEnabled: true,
        intervalMinutes: 5,
        quality: 0.7,
        isAdmin: false,
      })
    }

    // Admin: look up the stored config (use a sentinel user or global config)
    const config = await db.screenshotConfig.findFirst({
      where: { userId: 'GLOBAL_CONFIG' },
    })

    return NextResponse.json({
      autoEnabled: config?.autoEnabled ?? true,
      intervalMinutes: config?.intervalMinutes ?? 5,
      quality: 0.7,
      isAdmin: true,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to fetch config'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// PUT /api/screenshot-config
// Admin-only: update global screenshot settings
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, autoEnabled, intervalMinutes } = body

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 })
    }

    // Verify admin
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { role: true },
    })
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Only admins can modify screenshot settings' }, { status: 403 })
    }

    // Upsert global config using sentinel ID
    const config = await db.screenshotConfig.upsert({
      where: { userId: 'GLOBAL_CONFIG' },
      update: {
        autoEnabled: autoEnabled ?? true,
        intervalMinutes: intervalMinutes ?? 5,
      },
      create: {
        userId: 'GLOBAL_CONFIG',
        autoEnabled: autoEnabled ?? true,
        intervalMinutes: intervalMinutes ?? 5,
      },
    })

    return NextResponse.json({ config })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to update config'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}