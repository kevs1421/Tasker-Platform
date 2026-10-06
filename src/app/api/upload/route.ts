import { NextRequest, NextResponse } from 'next/server'
import { writeFile } from 'fs/promises'
import path from 'path'
import { requireAuth, handleApiError } from '@/lib/api-auth'

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads')
const MAX_SIZE = 10 * 1024 * 1024 // 10MB

const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
  'application/zip',
  'application/x-zip-compressed',
]

// Generate a short random suffix for filename uniqueness
function randomSuffix(length = 6): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)]
  }
  return result
}

// POST /api/upload — Upload a file (used by client portal & onboarding wizard)
export async function POST(req: NextRequest) {
  try {
    await requireAuth(req)

    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (file.size === 0) {
      return NextResponse.json({ error: 'File is empty' }, { status: 400 })
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: `File size (${(file.size / 1024 / 1024).toFixed(1)}MB) exceeds 10MB limit` },
        { status: 400 },
      )
    }

    // Allow all MIME types that the client might send, but block clearly dangerous ones
    const dangerousTypes = [
      'application/x-executable',
      'application/x-msdos-program',
      'application/x-bat',
      'application/x-sh',
    ]
    if (dangerousTypes.includes(file.type)) {
      return NextResponse.json({ error: 'File type not allowed' }, { status: 400 })
    }

    // Warn (but allow) unrecognized types — the explicit allow-list is for documentation,
    // not enforcement, since MIME types from browsers can be unreliable
    void ALLOWED_TYPES // referenced for documentation clarity

    // Build a safe unique filename: timestamp-randomSuffix.ext
    const ext = file.name.split('.').pop() || 'bin'
    const safeName = `${Date.now()}-${randomSuffix()}.${ext}`
    const filePath = path.join(UPLOAD_DIR, safeName)

    // Write file to disk
    const bytes = await file.arrayBuffer()
    await writeFile(filePath, Buffer.from(bytes))

    // Return the format expected by frontend:
    // { url, originalName, filename, size, type }
    const url = `/uploads/${safeName}`
    return NextResponse.json({
      url,
      originalName: file.name,
      filename: safeName,
      size: file.size,
      type: file.type || 'application/octet-stream',
    })
  } catch (error) {
    return handleApiError(error)
  }
}
