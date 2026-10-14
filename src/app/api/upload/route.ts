import { NextRequest, NextResponse } from 'next/server'
import { writeFile, unlink } from 'fs/promises'
import path from 'path'
import { requireAuth, handleApiError } from '@/lib/api-auth'

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads')
const MAX_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
]

// Map MIME type to file extension
const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'text/plain': 'txt',
  'text/csv': 'csv',
}

// POST /api/upload — General file upload (documents, images, etc.)
export async function POST(req: NextRequest) {
  try {
    const authed = await requireAuth(req)
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `File type "${file.type}" is not allowed. Accepted types: images, PDF, Word, Excel, text files` },
        { status: 400 }
      )
    }

    // Validate file size
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File size exceeds 10MB limit' }, { status: 400 })
    }

    if (file.size === 0) {
      return NextResponse.json({ error: 'File is empty' }, { status: 400 })
    }

    // Generate safe filename: timestamp-random.ext
    const ext = MIME_TO_EXT[file.type] || file.name.split('.').pop() || 'bin'
    const randomSuffix = Math.random().toString(36).slice(2, 10)
    const safeName = `${Date.now()}-${randomSuffix}.${ext}`
    const filePath = path.join(UPLOAD_DIR, safeName)

    // Write file to disk
    const bytes = await file.arrayBuffer()
    await writeFile(filePath, Buffer.from(bytes))

    // Construct public URL
    const url = `/uploads/${safeName}`

    return NextResponse.json({
      url,
      originalName: file.name,
      filename: safeName,
      size: file.size,
      type: file.type,
    })
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/upload?filename=xxx — Delete an uploaded file
export async function DELETE(req: NextRequest) {
  try {
    const authed = await requireAuth(req)
    const { searchParams } = new URL(req.url)
    const filename = searchParams.get('filename')

    if (!filename) {
      return NextResponse.json({ error: 'filename query parameter is required' }, { status: 400 })
    }

    // Prevent path traversal
    const safeName = path.basename(filename)
    const filePath = path.join(UPLOAD_DIR, safeName)

    try {
      await unlink(filePath)
    } catch {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error)
  }
}