import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import crypto from 'crypto'

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads')

// Allowed file types for general upload
const ALLOWED_TYPES = [
  // Images
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp', 'image/tiff',
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  // Text
  'text/plain', 'text/csv', 'text/markdown',
  // Archives
  'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed',
]

const ALLOWED_EXTENSIONS = [
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'tiff', 'tif',
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'txt', 'csv', 'md',
  'zip', 'rar', '7z',
]

const MAX_SIZE = 10 * 1024 * 1024 // 10MB per file

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File too large. Max 10MB.' }, { status: 400 })
    }

    // Validate file type
    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { error: `File type .${ext} is not allowed. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}` },
        { status: 400 }
      )
    }

    if (!ALLOWED_TYPES.includes(file.type) && !file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Invalid file type' }, { status: 400 })
    }

    // Ensure upload directory exists
    await mkdir(UPLOAD_DIR, { recursive: true })

    // Generate unique filename
    const uniqueName = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`
    const filePath = path.join(UPLOAD_DIR, uniqueName)

    const bytes = await file.arrayBuffer()
    await writeFile(filePath, Buffer.from(bytes))

    return NextResponse.json({
      url: `/uploads/${uniqueName}`,
      originalName: file.name,
      filename: uniqueName,
      size: file.size,
      type: file.type,
    }, { status: 201 })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Upload failed'
    console.error('Upload error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
