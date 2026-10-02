import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, handleApiError } from '@/lib/api-auth'

function sanitizeCsv(value: string): string {
  // Prevent CSV injection by escaping dangerous characters
  if (value.startsWith('=') || value.startsWith('+') || value.startsWith('-') || value.startsWith('@')) {
    return `'${value}`
  }
  return value
}

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request)
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const projectId = searchParams.get('projectId')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const role = searchParams.get('role')

    const where: Record<string, unknown> = { status: 'completed' }

    // Always scope to the specific user if provided (regardless of role param)
    if (userId) {
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
    const header = 'Date,User,Email,Project,Task,Time In,Time Out,Duration (hrs),Status'

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
      rows.push('')
      rows.push(`"${sanitizeCsv(group.userName)}" (${sanitizeCsv(group.userEmail)})`)
      rows.push(header)

      let userTotalMinutes = 0
      for (const e of group.entries) {
        const timeIn = e.timeIn ? new Date(e.timeIn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : ''
        const timeOut = e.timeOut ? new Date(e.timeOut).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : ''
        const durationHrs = (e.duration / 60).toFixed(2)
        const projectName = sanitizeCsv(e.project?.name || 'No Project')
        const taskTitle = sanitizeCsv(e.task?.title || '')
        rows.push(`${e.date},"${sanitizeCsv(group.userName)}","${sanitizeCsv(group.userEmail)}","${projectName}","${taskTitle}",${timeIn},${timeOut},${durationHrs},Completed`)
        userTotalMinutes += e.duration
      }

      const userTotalHrs = (userTotalMinutes / 60).toFixed(2)
      rows.push(`,,,,,,Total: ${userTotalHrs} hrs`)
      grandTotalMinutes += userTotalMinutes
    }

    rows.push('')
    rows.push(`,,,,,,Grand Total: ${(grandTotalMinutes / 60).toFixed(2)} hrs`)
    rows.push(`,,,,,,Total Entries: ${entries.length}`)

    const csv = BOM + rows.join('\n')

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
    return handleApiError(error)
  }
}