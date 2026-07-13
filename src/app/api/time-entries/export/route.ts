import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId') // for team member's own entries
    const projectId = searchParams.get('projectId')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const role = searchParams.get('role') // 'admin' or 'team' to determine scope

    const where: Record<string, unknown> = { status: 'completed' }

    if (userId && role === 'team') {
      // Team member can only export their own entries
      where.userId = userId
    }
    if (projectId && projectId !== 'all') {
      where.projectId = projectId
    }
    if (dateFrom || dateTo) {
      where.date = {}
      if (dateFrom) (where.date as Record<string, unknown>).gte = dateFrom
      if (dateTo) (where.date as Record<string, unknown>).lte = dateTo
    }

    const entries = await db.timeEntry.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, name: true, color: true } },
        task: { select: { id: true, title: true } },
      },
      orderBy: [{ date: 'desc' }, { timeIn: 'desc' }],
    })

    // Build CSV - grouped by user
    const BOM = '\uFEFF' // UTF-8 BOM for Excel compatibility
    const header = 'Date,User,Email,Time In,Time Out,Duration (hrs),Status'

    const rows: string[] = []
    let grandTotalMinutes = 0

    // Group entries by user
    const userGroups = new Map<string, { userName: string; userEmail: string; entries: typeof entries }>()
    for (const e of entries) {
      const uid = e.userId
      if (!userGroups.has(uid)) {
        userGroups.set(uid, {
          userName: e.user?.name ?? 'Unknown',
          userEmail: e.user?.email ?? '',
          entries: [],
        })
      }
      userGroups.get(uid)!.entries.push(e)
    }

    for (const [, group] of userGroups) {
      // Section header for each user
      rows.push('')
      rows.push(`"${group.userName}" (${group.userEmail})`)
      rows.push(header)

      let userTotalMinutes = 0
      for (const e of group.entries) {
        const timeIn = e.timeIn ? new Date(e.timeIn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : ''
        const timeOut = e.timeOut ? new Date(e.timeOut).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : ''
        const durationHrs = (e.duration / 60).toFixed(2)
        const status = 'Completed'
        rows.push(`${e.date},"${group.userName}","${group.userEmail}",${timeIn},${timeOut},${durationHrs},${status}`)
        userTotalMinutes += e.duration
      }

      const userTotalHrs = (userTotalMinutes / 60).toFixed(2)
      rows.push(`,,,,,Total: ${userTotalHrs} hrs`)
      grandTotalMinutes += userTotalMinutes
    }

    // Grand total
    rows.push('')
    rows.push(`,,,,,Grand Total: ${(grandTotalMinutes / 60).toFixed(2)} hrs`)
    rows.push(`,,,,,Total Entries: ${entries.length}`)

    const csv = BOM + rows.join('\n')

    // Generate filename with date range
    const now = new Date()
    const dateStr = now.toISOString().split('T')[0]
    const fromLabel = dateFrom || 'all'
    const toLabel = dateTo || 'all'
    const fileName = `time-report_${fromLabel}_to_${toLabel}_${dateStr}.csv`

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    })
  } catch (error) {
    console.error('Export time-entries error:', error)
    return NextResponse.json({ error: 'Failed to export time entries' }, { status: 500 })
  }
}