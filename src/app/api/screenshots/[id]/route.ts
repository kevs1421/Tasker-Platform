import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { unlink } from 'fs/promises'
import path from 'path'

// DELETE /api/screenshots/[id]?userId=xxx — delete a screenshot
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const isAdmin = searchParams.get('admin') === 'true'

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 })
    }

    const screenshot = await db.screenshot.findUnique({ where: { id } })

    if (!screenshot) {
      return NextResponse.json({ error: 'Screenshot not found' }, { status: 404 })
    }

    // Only owner or admin can delete
    if (screenshot.userId !== userId && !isAdmin) {
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
    const msg = error instanceof Error ? error.message : 'Failed to delete screenshot'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
