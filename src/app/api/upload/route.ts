import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import { requireAuth, handleApiError } from '@/lib/api-auth'

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'onboarding')
const MAX_SIZE = 10 * 1024 * 1024 // 10MB

// Allowed MIME types for onboarding document uploads
const ALLOWED_TYPES = [
  // Images
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  // Documents
  'application/pdf',
  'application/msword',                                                          // .doc
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',     // .docx
  'application/vnd.ms-excel',                                                    // .xls
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',           // .xlsx
  // Archives
  'application/zip', 'application/x-zip-compressed',
  // Text
  'text/plain', 'text/csv',
]

// Fallback: allow any type whose extension is recognized
const ALLOWED_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg',
  'pdf', 'doc', 'docx', 'xls', 'xlsx',
  'zip', 'txt', 'csv',
])

function isAllowed(file: File): boolean {
  if (ALLOWED_TYPES.includes(file.type)) return true
  // Some browsers report empty or application/octet-stream for .doc/.docx
  const ext = file.name.split('.').pop()?.toLowerCase() || ''
  if (ALLOWED_EXTENSIONS.has(ext)) return true
  return false
}

// POST /api/upload — Upload a file for onboarding or client dashboard
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req)

    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 })
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

    if (!isAllowed(file)) {
      return NextResponse.json(
        { error: 'File type not allowed. Accepted: images, PDF, Word, Excel, ZIP, TXT, CSV' },
        { status: 400 },
      )
    }

    // Ensure upload directory exists
    await mkdir(UPLOAD_DIR, { recursive: true })

    // Generate unique filename to prevent collisions and path traversal
    const ext = file.name.split('.').pop() || 'bin'
    const uniqueName = `${crypto.randomUUID()}.${ext}`
    const filePath = path.join(UPLOAD_DIR, uniqueName)

    const bytes = await file.arrayBuffer()
    await writeFile(filePath, Buffer.from(bytes))

    const url = `/uploads/onboarding/${uniqueName}`

    return NextResponse.json({
      url,
      originalName: file.name,
      filename: uniqueName,
      size: file.size,
      type: file.type || 'application/octet-stream',
    }, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
