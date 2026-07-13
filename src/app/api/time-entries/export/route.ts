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

    // Build CSV
    const BOM = '\uFEFF' // UTF-8 BOM for Excel compatibility
    const header = 'Date,User,Email,Project,Task,Description,Time In,Time Out,Duration (hrs),Status'
    const rows = entries.map((e) => {
      const date = e.date
      const userName = e.user?.name ?? 'Unknown'
      const userEmail = e.user?.email ?? ''
      const projectName = e.project?.name ?? ''
      const taskTitle = e.task?.title ?? ''
      const description = (e.description ?? '').replace(/"/g, '""')
      const timeIn = e.timeIn ? new Date(e.timeIn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : ''
      const timeOut = e.timeOut ? new Date(e.timeOut).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : ''
      const durationHrs = (e.duration / 60).toFixed(2)
      const status = e.status === 'completed' ? 'Completed' : e.status === 'timed_in' ? 'Active' : 'Idle'
      return `${date},"${userName}","${userEmail}","${projectName}","${taskTitle}","${description}",${timeIn},${timeOut},${durationHrs},${status}`
    })

    // Add summary row
    const totalMinutes = entries.reduce((sum, e) => sum + e.duration, 0)
    const totalHrs = (totalMinutes / 60).toFixed(2)
    rows.push('')
    rows.push(`,,,,,Total Hours,,,,${totalHrs}`)
    rows.push(`,,,,,Total Entries,,,,${entries.length}`)

    const csv = BOM + header + '\n' + rows.join('\n')

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