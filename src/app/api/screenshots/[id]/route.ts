import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { unlink } from 'fs/promises'
import path from 'path'
import { requireAuth, handleApiError } from '@/lib/api-auth'

// DELETE /api/screenshots/[id] — delete a screenshot (owner or admin)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request)
    const { id } = await params

    const screenshot = await db.screenshot.findUnique({ where: { id } })

    if (!screenshot) {
      return NextResponse.json({ error: 'Screenshot not found' }, { status: 404 })
    }

    // Only owner or admin can delete
    if (screenshot.userId !== auth.id && auth.role !== 'admin') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Delete file from disk
    try {
      const fullPath = path.join(process.cwd(), 'public', screenshot.filePath)
      await unlink(fullPath)
    } catch {
      // File may already be deleted
    }

    await db.screenshot.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error)
  }
}
