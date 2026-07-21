import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import crypto from 'crypto'

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'screenshots')

// POST /api/screenshots/auto — auto-capture screenshot (real screen capture from html2canvas)
// Expects multipart form-data with:
//   file: base64-encoded PNG data (from html2canvas)
//   userId: string
//   userRole: string
//   projectId?: string
//   taskId?: string
//   description?: string
//   sessionId?: string (time entry ID for session grouping)
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const userId = formData.get('userId') as string | null
    const userRole = formData.get('userRole') as string | null
    const projectId = formData.get('projectId') as string | null
    const taskId = formData.get('taskId') as string | null
    const description = formData.get('description') as string | null
    const sessionId = formData.get('sessionId') as string | null

    if (!file || !userId) {
      return NextResponse.json({ error: 'File and userId are required' }, { status: 400 })
    }

    // Block client role
    if (userRole === 'client') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type' }, { status: 400 })
    }

    // Max 5MB for auto screenshots
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Screenshot too large (max 5MB)' }, { status: 400 })
    }

    // Fetch user info
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true },
    })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Ensure upload directory exists
    await mkdir(UPLOAD_DIR, { recursive: true })

    // Generate unique filename with timestamp
    const now = new Date()
    const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/jpeg' ? 'jpg' : 'webp'
    const uniqueName = `auto_${userId.slice(0, 8)}_${timestamp}_${crypto.randomUUID().slice(0, 6)}.${ext}`
    const filePath = path.join(UPLOAD_DIR, uniqueName)

    const bytes = await file.arrayBuffer()
    await writeFile(filePath, Buffer.from(bytes))

    const timeStr = now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })

    // Fetch project/task names for context
    let projectName: string | null = null
    let taskTitle: string | null = null
    if (projectId) {
      const project = await db.project.findUnique({ where: { id: projectId }, select: { name: true } })
      if (project) projectName = project.name
    }
    if (taskId) {
      const task = await db.task.findUnique({ where: { id: taskId }, select: { title: true } })
      if (task) taskTitle = task.title
    }

    // Build title and description
    const title = `Auto Screenshot - ${timeStr}`
    const descParts = [`Auto-captured at ${timeStr}`]
    if (projectName) descParts.push(`Project: ${projectName}`)
    if (taskTitle) descParts.push(`Task: ${taskTitle}`)
    if (description) descParts.push(description)
    const screenshotDescription = descParts.join(' | ')

    const screenshot = await db.screenshot.create({
      data: {
        userId,
        projectId: projectId || null,
        taskId: taskId || null,
        title,
        description: screenshotDescription,
        filePath: `/uploads/screenshots/${uniqueName}`,
        fileSize: file.size,
        mimeType: file.type,
        isAuto: true,
      },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        project: { select: { id: true, name: true, color: true } },
        task: { select: { id: true, title: true, status: true } },
      },
    })

    return NextResponse.json({ screenshot }, { status: 201 })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to auto-capture screenshot'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}