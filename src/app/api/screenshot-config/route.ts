import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, getAuthUser, AuthError } from '@/lib/session'

// GET /api/screenshot-config
// Returns the admin-configured global settings, or per-user defaults
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)

    // Non-admin users get minimal defaults for client-side use
    if (!user || user.role !== 'admin') {
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
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    const msg = error instanceof Error ? error.message : 'Failed to fetch config'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// PUT /api/screenshot-config
// Admin-only: update global screenshot settings
export async function PUT(request: NextRequest) {
  try {
    // Verify admin via session
    await requireAdmin(request)

    const body = await request.json()
    const { autoEnabled, intervalMinutes } = body

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
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    const msg = error instanceof Error ? error.message : 'Failed to update config'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}