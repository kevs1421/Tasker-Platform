import { NextRequest, NextResponse } from 'next/server'
import { writeFile } from 'fs/promises'
import path from 'path'
import { requireAuth, handleApiError } from '@/lib/api-auth'

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads')
const MAX_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'application/pdf',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'application/zip',
]

// POST /api/upload — Upload a file
export async function POST(req: NextRequest) {
  try {
    await requireAuth(req)
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 })
    }

    if (file.size === 0) {
      return NextResponse.json({ error: 'File is empty' }, { status: 400 })
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: `File size exceeds 10MB limit` }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'File type not allowed' }, { status: 400 })
    }

    const ext = file.name.split('.').pop() || 'bin'
    const safeName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`
    const filePath = path.join(UPLOAD_DIR, safeName)

    const bytes = await file.arrayBuffer()
    await writeFile(filePath, Buffer.from(bytes))

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
