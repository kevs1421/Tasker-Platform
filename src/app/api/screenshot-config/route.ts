import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/screenshot-config?userId=xxx
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 })
    }

    let config = await db.screenshotConfig.findUnique({
      where: { userId },
    })

    // Create default config if not exists
    if (!config) {
      config = await db.screenshotConfig.create({
        data: { userId, autoEnabled: false, intervalMinutes: 5 },
      })
    }

    return NextResponse.json({
      config: {
        userId: config.userId,
        autoEnabled: config.autoEnabled,
        intervalMinutes: config.intervalMinutes,
      },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to fetch config'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// PUT /api/screenshot-config
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, autoEnabled, intervalMinutes } = body

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 })
    }

    if (intervalMinutes !== undefined && (intervalMinutes < 1 || intervalMinutes > 60)) {
      return NextResponse.json({ error: 'Interval must be between 1 and 60 minutes' }, { status: 400 })
    }

    const updateData: { autoEnabled?: boolean; intervalMinutes?: number } = {}
    if (autoEnabled !== undefined) updateData.autoEnabled = autoEnabled
    if (intervalMinutes !== undefined) updateData.intervalMinutes = intervalMinutes

    const config = await db.screenshotConfig.upsert({
      where: { userId },
      update: updateData,
      create: {
        userId,
        autoEnabled: autoEnabled ?? false,
        intervalMinutes: intervalMinutes ?? 5,
      },
    })

    return NextResponse.json({
      config: {
        userId: config.userId,
        autoEnabled: config.autoEnabled,
        intervalMinutes: config.intervalMinutes,
      },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to update config'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}