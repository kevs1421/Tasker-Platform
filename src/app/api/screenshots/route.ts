import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import crypto from 'crypto'

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'screenshots')
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml']
const MAX_SIZE = 20 * 1024 * 1024 // 20MB

// GET /api/screenshots?userId=xxx&admin=true — list screenshots
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const adminView = searchParams.get('admin') === 'true'

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 })
    }

    // Non-admin users can only see their own screenshots
    const where: Record<string, unknown> = {}
    if (!adminView) {
      where.userId = userId
    }

    const screenshots = await db.screenshot.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, role: true, avatar: true } },
        project: { select: { id: true, name: true, color: true } },
        task: { select: { id: true, title: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })

    return NextResponse.json({ screenshots })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to fetch screenshots'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// POST /api/screenshots — upload a screenshot
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const userId = formData.get('userId') as string | null
    const userRole = formData.get('userRole') as string | null
    const title = formData.get('title') as string | null
    const description = formData.get('description') as string | null
    const projectId = formData.get('projectId') as string | null
    const taskId = formData.get('taskId') as string | null
    const isAuto = formData.get('isAuto') === 'true'

    if (!file || !userId) {
      return NextResponse.json({ error: 'File and userId are required' }, { status: 400 })
    }

    // Block client role from uploading
    if (userRole === 'client') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Only images are allowed.' }, { status: 400 })
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File too large. Max 20MB.' }, { status: 400 })
    }

    // Ensure upload directory exists
    await mkdir(UPLOAD_DIR, { recursive: true })

    // Generate unique filename
    const ext = file.name.split('.').pop() || 'png'
    const uniqueName = `${crypto.randomUUID()}.${ext}`
    const filePath = path.join(UPLOAD_DIR, uniqueName)

    const bytes = await file.arrayBuffer()
    await writeFile(filePath, Buffer.from(bytes))

    const screenshot = await db.screenshot.create({
      data: {
        userId,
        projectId: projectId || null,
        taskId: taskId || null,
        title: title || file.name,
        description: description || null,
        filePath: `/uploads/screenshots/${uniqueName}`,
        fileSize: file.size,
        mimeType: file.type,
        isAuto,
      },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        project: { select: { id: true, name: true } },
        task: { select: { id: true, title: true } },
      },
    })

    return NextResponse.json({ screenshot }, { status: 201 })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to upload screenshot'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
