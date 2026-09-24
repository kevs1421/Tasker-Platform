import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { writeFile, unlink } from 'fs/promises'
import path from 'path'
import { requireAuth, handleApiError } from '@/lib/api-auth'

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'avatars')
const MAX_SIZE = 2 * 1024 * 1024 // 2MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

// POST /api/avatar — Upload profile image
export async function POST(req: NextRequest) {
  try {
    await requireAuth(req)
    const formData = await req.formData()
    const file = formData.get('avatar') as File | null
    const userId = formData.get('userId') as string | null

    if (!file || !userId) {
      return NextResponse.json({ error: 'avatar file and userId are required' }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Only JPEG, PNG, GIF, and WebP images are allowed' }, { status: 400 })
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Image must be under 2MB' }, { status: 400 })
    }

    const user = await db.user.findUnique({ where: { id: userId }, select: { avatar: true } })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Delete old avatar file if exists
    if (user.avatar) {
      const oldPath = path.join(process.cwd(), 'public', user.avatar)
      try { await unlink(oldPath) } catch { /* ignore */ }
    }

    const ext = file.name.split('.').pop() || 'jpg'
    const safeName = `${userId}_${Date.now()}.${ext}`
    const filePath = path.join(UPLOAD_DIR, safeName)

    const bytes = await file.arrayBuffer()
    await writeFile(filePath, Buffer.from(bytes))

    const avatarUrl = `/uploads/avatars/${safeName}`
    await db.user.update({ where: { id: userId }, data: { avatar: avatarUrl } })

    return NextResponse.json({ avatar: avatarUrl })
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/avatar?userId=xxx
export async function DELETE(req: NextRequest) {
  try {
    await requireAuth(req)
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')
    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 })
    }

    const user = await db.user.findUnique({ where: { id: userId }, select: { avatar: true } })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (user.avatar) {
      const oldPath = path.join(process.cwd(), 'public', user.avatar)
      try { await unlink(oldPath) } catch { /* ignore */ }
      await db.user.update({ where: { id: userId }, data: { avatar: null } })
    }

    return NextResponse.json({ success: true, avatar: null })
  } catch (error) {
    return handleApiError(error)
  }
}
