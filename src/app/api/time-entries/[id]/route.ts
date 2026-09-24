import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, handleApiError } from '@/lib/api-auth'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(request)
    const { id } = await params
    const body = await request.json()
    const { action, description, projectId, taskId, timeIn, timeOut } = body

    const existing = await db.timeEntry.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Time entry not found' }, { status: 404 })
    }

    if (action === 'time_out') {
      if (existing.status !== 'timed_in') {
        return NextResponse.json({ error: 'This entry is not currently timed in' }, { status: 400 })
      }
      const now = new Date()
      const durationMin = Math.max(1, Math.round((now.getTime() - new Date(existing.timeIn!).getTime()) / 60000))

      const updated = await db.timeEntry.update({
        where: { id },
        data: {
          timeOut: now.toISOString(),
          duration: durationMin,
          status: 'completed',
        },
        include: {
          user: { select: { id: true, name: true, avatar: true, role: true } },
          project: { select: { id: true, name: true, color: true } },
          task: { select: { id: true, title: true } },
        },
      })
      return NextResponse.json({ timeEntry: updated })
    }

    if (action === 'cancel') {
      if (existing.status !== 'timed_in') {
        return NextResponse.json({ error: 'Only active timers can be cancelled' }, { status: 400 })
      }
      const updated = await db.timeEntry.update({
        where: { id },
        data: { status: 'idle', timeIn: null },
        include: {
          user: { select: { id: true, name: true, avatar: true, role: true } },
          project: { select: { id: true, name: true, color: true } },
          task: { select: { id: true, title: true } },
        },
      })
      return NextResponse.json({ timeEntry: updated })
    }

    // Generic update for description, project, task, timeIn, timeOut
    const updateData: Record<string, unknown> = {}
    if (description !== undefined) updateData.description = description
    if (projectId !== undefined) updateData.projectId = projectId || null
    if (taskId !== undefined) updateData.taskId = taskId || null

    // If manually adjusting times
    if (timeIn && timeOut) {
      const start = new Date(timeIn)
      const end = new Date(timeOut)
      const durationMin = Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000))
      updateData.timeIn = start.toISOString()
      updateData.timeOut = end.toISOString()
      updateData.duration = durationMin
      updateData.status = 'completed'
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    const updated = await db.timeEntry.update({
      where: { id },
      data: updateData,
      include: {
        user: { select: { id: true, name: true, avatar: true, role: true } },
        project: { select: { id: true, name: true, color: true } },
        task: { select: { id: true, title: true } },
      },
    })
    return NextResponse.json({ timeEntry: updated })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(request)
    const { id } = await params
    await db.timeEntry.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error)
  }
}