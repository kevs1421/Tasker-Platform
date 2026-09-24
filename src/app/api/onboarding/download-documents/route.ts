import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { readFile } from 'fs/promises'
import { join } from 'path'
import JSZip from 'jszip'
import { requireAuth, handleApiError } from '@/lib/api-auth'

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request)
    const { searchParams } = new URL(request.url)
    const submissionId = searchParams.get('submissionId')
    const fileId = searchParams.get('fileId')

    if (!submissionId) {
      return NextResponse.json({ error: 'submissionId is required' }, { status: 400 })
    }

    const submission = await db.onboarding.findUnique({
      where: { id: submissionId },
      include: {
        client: { select: { id: true, name: true } },
        form: { select: { id: true, title: true } },
      },
    })

    if (!submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
    }

    // Parse files from responsesJson
    let parsedFiles: Record<string, { url: string; originalName: string; filename: string; size: number; type: string } | null> = {}
    try {
      const raw = JSON.parse(submission.responsesJson)
      parsedFiles = raw.files || {}
    } catch {
      // no files
    }

    const fileEntries = Object.entries(parsedFiles).filter(([_, f]) => f)

    if (fileEntries.length === 0) {
      return NextResponse.json({ error: 'No uploaded documents found for this submission' }, { status: 404 })
    }

    // Single file download
    if (fileId) {
      const entry = fileEntries.find(([key]) => key === fileId)
      if (!entry) {
        return NextResponse.json({ error: 'File not found in submission' }, { status: 404 })
      }
      return NextResponse.json({ url: entry[1]!.url, originalName: entry[1]!.originalName, type: entry[1]!.type })
    }

    // All files → ZIP download
    const zip = new JSZip()
    const publicDir = join(process.cwd(), 'public')
    const usedNames = new Set<string>()

    for (const [key, file] of fileEntries) {
      if (!file) continue

      const urlPath = file.url.startsWith('/') ? file.url : `/${file.url}`
      const filePath = join(publicDir, urlPath)

      const label = key
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, (s) => s.toUpperCase())
        .trim()

      // Build a unique zip entry name
      let zipName = fileEntries.length === 1
        ? file.originalName
        : `${label} - ${file.originalName}`

      // Avoid duplicate names
      if (usedNames.has(zipName)) {
        const ext = zipName.includes('.') ? '.' + zipName.split('.').pop() : ''
        const base = zipName.replace(/\.[^.]+$/, '')
        let counter = 2
        while (usedNames.has(`${base} (${counter})${ext}`)) counter++
        zipName = `${base} (${counter})${ext}`
      }
      usedNames.add(zipName)

      try {
        const fileBuffer = await readFile(filePath)
        zip.file(zipName, fileBuffer)
      } catch {
        zip.file(`${zipName} - MISSING.txt`,
          `This file was uploaded as "${file.originalName}" but is no longer available on the server.\nOriginal path: ${file.url}`)
      }
    }

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' })
    const safeName = `${submission.form.title} - ${submission.client.name} - Documents.zip`
      .replace(/[/\\?%*:|"<>]/g, '-')

    return new NextResponse(Buffer.from(zipBuffer), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(safeName)}"`,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}