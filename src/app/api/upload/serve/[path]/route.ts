import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join, resolve } from 'path'
import { existsSync } from 'fs'
import { stat } from 'fs/promises'

const UPLOAD_DIR = resolve(process.cwd(), 'upload')

export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string }> }) {
  try {
    const { path: filePath } = await params
    const fullPath = resolve(UPLOAD_DIR, filePath)
    if (!fullPath.startsWith(UPLOAD_DIR)) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 403 })
    }
    if (!existsSync(fullPath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }
    const fileBuffer = await readFile(fullPath)
    const originalName = fullPath.includes('-') ? fullPath.split('-').slice(1).join('-') : fullPath.split('/').pop() || 'file'

    const ext = fullPath.split('.').pop()?.toLowerCase() || ''
    const mimeMap: Record<string, string> = {
      jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
      webp: 'image/webp', svg: 'image/svg+xml', pdf: 'application/pdf',
      doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      zip: 'application/zip', txt: 'text/plain', csv: 'text/csv',
    }
    const contentType = mimeMap[ext] || 'application/octet-stream'

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${originalName}"`,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Failed to serve file' }, { status: 500 })
  }
}