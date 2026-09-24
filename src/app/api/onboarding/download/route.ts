import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, handleApiError } from '@/lib/api-auth'

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request)
    const { searchParams } = new URL(request.url)
    const submissionId = searchParams.get('submissionId')

    if (!submissionId) {
      return NextResponse.json({ error: 'submissionId is required' }, { status: 400 })
    }

    const submission = await db.onboarding.findUnique({
      where: { id: submissionId },
      include: {
        client: { select: { id: true, name: true, email: true, company: true, phone: true } },
        form: { select: { id: true, title: true, project: { select: { name: true } } } },
        reviewer: { select: { name: true } },
      },
    })

    if (!submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
    }

    let parsedResponses: Record<string, string> = {}
    let parsedFiles: Record<string, { url: string; originalName: string; filename: string; size: number; type: string } | null> = {}
    try {
      const raw = JSON.parse(submission.responsesJson)
      parsedResponses = raw.responses || raw
      parsedFiles = raw.files || {}
    } catch {
      parsedResponses = { responsesJson: submission.responsesJson }
    }

    // Build a text-based report
    const lines: string[] = []
    const divider = '═'.repeat(60)

    lines.push(divider)
    lines.push('  ONBOARDING SUBMISSION REPORT')
    lines.push(divider)
    lines.push('')
    lines.push(`Form:          ${submission.form.title}`)
    lines.push(`Project:       ${submission.form.project?.name || '—'}`)
    lines.push(`Client:        ${submission.client.name}`)
    lines.push(`Company:       ${submission.client.company || '—'}`)
    lines.push(`Email:         ${submission.client.email}`)
    lines.push(`Phone:         ${submission.client.phone || '—'}`)
    lines.push(`Status:        ${submission.status}`)
    lines.push(`Submitted:     ${submission.submittedAt ? new Date(submission.submittedAt).toLocaleString() : '—'}`)
    if (submission.reviewedAt) {
      lines.push(`Reviewed:      ${new Date(submission.reviewedAt).toLocaleString()}`)
      lines.push(`Reviewed By:   ${submission.reviewer?.name || '—'}`)
    }
    if (submission.reviewNotes) {
      lines.push(`Review Notes:  ${submission.reviewNotes}`)
    }
    lines.push('')
    lines.push('─'.repeat(60))
    lines.push('  SUBMITTED DATA')
    lines.push('─'.repeat(60))
    lines.push('')

    // Format field names nicely
    for (const [key, value] of Object.entries(parsedResponses)) {
      if (!value?.trim()) continue
      const label = key
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, (s) => s.toUpperCase())
      lines.push(`${label}:`)
      lines.push(`  ${value}`)
      lines.push('')
    }

    // Add file references
    const fileEntries = Object.entries(parsedFiles).filter(([_, f]) => f)
    if (fileEntries.length > 0) {
      lines.push('─'.repeat(60))
      lines.push('  UPLOADED DOCUMENTS')
      lines.push('─'.repeat(60))
      lines.push('')
      for (const [key, f] of fileEntries) {
        const label = key
          .replace(/([A-Z])/g, ' $1')
          .replace(/^./, (s) => s.toUpperCase())
        lines.push(`${label}:`)
        lines.push(`  File:     ${f!.originalName}`)
        lines.push(`  Size:     ${(f!.size / 1024).toFixed(1)} KB`)
        lines.push(`  Type:     ${f!.type}`)
        lines.push(`  URL:      ${f!.url}`)
        lines.push('')
      }
    }

    lines.push(divider)
    lines.push(`  Generated: ${new Date().toLocaleString()}`)
    lines.push(divider)

    const textContent = lines.join('\n')
    const safeFilename = `${submission.form.title} - ${submission.client.name} - Onboarding.txt`
      .replace(/[/\\?%*:|"<>]/g, '-')

    return new NextResponse(textContent, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(safeFilename)}"`,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}