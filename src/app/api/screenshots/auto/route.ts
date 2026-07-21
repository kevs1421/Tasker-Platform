import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import crypto from 'crypto'

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'screenshots')

// POST /api/screenshots/auto — auto-capture screenshot on time-in
// Expects JSON body: { userId, userRole, projectId?, taskId?, description?, delaySeconds? }
// Generates a visual "proof-of-work" screenshot with timestamp, user info, and project/task context
export async function POST(request: NextRequest) {
  try {
    const { userId, userRole, projectId, taskId, description, delaySeconds } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 })
    }

    // Block client role
    if (userRole === 'client') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Fetch user info
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true },
    })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Fetch project/task info for context
    let projectName: string | null = null
    let taskTitle: string | null = null

    if (projectId) {
      const project = await db.project.findUnique({
        where: { id: projectId },
        select: { name: true },
      })
      if (project) projectName = project.name
    }

    if (taskId) {
      const task = await db.task.findUnique({
        where: { id: taskId },
        select: { title: true },
      })
      if (task) taskTitle = task.title
    }

    // Generate an SVG screenshot card as proof-of-work
    const now = new Date()
    const dateStr = now.toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    })
    const timeStr = now.toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    })

    const roleColors: Record<string, string> = {
      admin: '#10b981',
      team: '#f59e0b',
      training: '#3b82f6',
    }
    const roleColor = roleColors[userRole] || '#6b7280'

    // Build context lines
    const contextLines: string[] = []
    if (projectName) contextLines.push(`<text x="40" y="${180 + contextLines.length * 30}" font-family="system-ui, sans-serif" font-size="15" fill="#64748b">Project: <tspan fill="#334155" font-weight="600">${escapeXml(projectName)}</tspan></text>`)
    if (taskTitle) contextLines.push(`<text x="40" y="${180 + contextLines.length * 30}" font-family="system-ui, sans-serif" font-size="15" fill="#64748b">Task: <tspan fill="#334155" font-weight="600">${escapeXml(taskTitle)}</tspan></text>`)
    if (description) {
      const descLines = wrapText(description, 50)
      descLines.forEach((line, i) => {
        contextLines.push(`<text x="40" y="${180 + contextLines.length * 30}" font-family="system-ui, sans-serif" font-size="14" fill="#64748b">${escapeXml(line)}</text>`)
      })
    }
    if (delaySeconds && delaySeconds > 0) {
      contextLines.push(`<text x="40" y="${180 + contextLines.length * 30}" font-family="system-ui, sans-serif" font-size="13" fill="#94a3b8">Auto-capture delay: ${delaySeconds}s</text>`)
    }

    const svgHeight = 280 + contextLines.length * 30

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="640" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0f172a;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#1e293b;stop-opacity:1" />
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="640" height="${svgHeight}" rx="16" fill="url(#bg)"/>

  <!-- Top accent bar -->
  <rect width="640" height="6" rx="3" fill="${roleColor}"/>

  <!-- Logo area -->
  <text x="40" y="52" font-family="system-ui, sans-serif" font-size="18" font-weight="700" fill="#f8fafc">⏱ Time-In Proof</text>
  <rect x="510" y="32" width="90" height="26" rx="13" fill="${roleColor}" opacity="0.15"/>
  <text x="555" y="50" font-family="system-ui, sans-serif" font-size="12" font-weight="600" fill="${roleColor}" text-anchor="middle">${userRole.toUpperCase()}</text>

  <!-- Divider -->
  <line x1="40" y1="70" x2="600" y2="70" stroke="#334155" stroke-width="1"/>

  <!-- User info -->
  <circle cx="60" cy="108" r="20" fill="${roleColor}" opacity="0.2"/>
  <text x="60" y="114" font-family="system-ui, sans-serif" font-size="14" font-weight="700" fill="${roleColor}" text-anchor="middle">${user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}</text>
  <text x="92" y="102" font-family="system-ui, sans-serif" font-size="17" font-weight="600" fill="#f1f5f9">${escapeXml(user.name)}</text>
  <text x="92" y="122" font-family="system-ui, sans-serif" font-size="13" fill="#94a3b8">${escapeXml(user.email)}</text>

  <!-- Timestamp card -->
  <rect x="40" y="145" width="240" height="48" rx="10" fill="#1e293b" stroke="#334155" stroke-width="1"/>
  <text x="58" y="166" font-family="system-ui, sans-serif" font-size="11" fill="#94a3b8" letter-spacing="0.5">DATE</text>
  <text x="58" y="183" font-family="system-ui, sans-serif" font-size="13" font-weight="500" fill="#e2e8f0">${dateStr}</text>

  <rect x="300" y="145" width="240" height="48" rx="10" fill="#1e293b" stroke="#334155" stroke-width="1"/>
  <text x="318" y="166" font-family="system-ui, sans-serif" font-size="11" fill="#94a3b8" letter-spacing="0.5">CLOCKED IN AT</text>
  <text x="318" y="183" font-family="system-ui, sans-serif" font-size="13" font-weight="500" fill="#e2e8f0">${timeStr}</text>

  <!-- Context section -->
  ${contextLines.length > 0 ? `
  <line x1="40" y1="${contextLines.length > 0 ? 165 : 0}" x2="600" y2="${contextLines.length > 0 ? 165 : 0}" stroke="#334155" stroke-width="0" />
  ${contextLines.join('\n  ')}
  ` : ''}

  <!-- Footer -->
  <line x1="40" y1="${svgHeight - 40}" x2="600" y2="${svgHeight - 40}" stroke="#334155" stroke-width="1"/>
  <text x="40" y="${svgHeight - 18}" font-family="system-ui, sans-serif" font-size="11" fill="#475569">Yber Digitals — TaskFlow Automated Screenshot</text>
  <text x="600" y="${svgHeight - 18}" font-family="system-ui, sans-serif" font-size="11" fill="#475569" text-anchor="end">ID: ${userId.slice(0, 8)}</text>
</svg>`

    // Convert SVG to PNG data URI using canvas
    const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(svgBlob)

    // We'll store as SVG and also generate a PNG fallback
    // For browser compatibility, we save as PNG via the screenshot API

    // Actually, save the SVG directly as the screenshot file (browsers render SVG natively)
    await mkdir(UPLOAD_DIR, { recursive: true })

    const uniqueName = `auto_${crypto.randomUUID()}.svg`
    const filePath = path.join(UPLOAD_DIR, uniqueName)

    // Save SVG file
    await writeFile(filePath, svg)

    // Create the screenshot record
    const title = `Time-In ${timeStr}`
    const screenshotDescription = `Auto-captured on clock-in${delaySeconds ? ` (${delaySeconds}s delay)` : ''}${projectName ? ` — ${projectName}` : ''}${taskTitle ? ` / ${taskTitle}` : ''}`

    const screenshot = await db.screenshot.create({
      data: {
        userId,
        projectId: projectId || null,
        taskId: taskId || null,
        title,
        description: screenshotDescription,
        filePath: `/uploads/screenshots/${uniqueName}`,
        fileSize: Buffer.byteLength(svg),
        mimeType: 'image/svg+xml',
      },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        project: { select: { id: true, name: true } },
        task: { select: { id: true, title: true } },
      },
    })

    URL.revokeObjectURL(url)

    return NextResponse.json({ screenshot }, { status: 201 })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to auto-capture screenshot'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function wrapText(text: string, maxLen: number): string[] {
  if (!text) return []
  const words = text.split(' ')
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    if ((current + ' ' + word).trim().length > maxLen) {
      if (current) lines.push(current.trim())
      current = word
    } else {
      current = current ? current + ' ' + word : word
    }
  }
  if (current.trim()) lines.push(current.trim())
  return lines.slice(0, 3) // Max 3 lines
}