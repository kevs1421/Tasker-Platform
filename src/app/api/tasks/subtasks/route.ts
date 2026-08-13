import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const { title, completed, taskId } = await request.json()
    if (!title || !taskId) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    const subtask = await db.subtask.create({ data: { title, completed: completed || false, taskId } })
    return NextResponse.json({ subtask }, { status: 201 })
  } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }) }
}

export async function GET(request: NextRequest) {
  try {
    const taskId = request.nextUrl.searchParams.get('taskId')
    if (!taskId) return NextResponse.json({ error: 'taskId required' }, { status: 400 })
    const subtasks = await db.subtask.findMany({
      where: { taskId },
      orderBy: { createdAt: 'asc' },
    })
    return NextResponse.json({
      subtasks: subtasks.map((s) => ({
        ...s,
        createdAt: s.createdAt.toISOString(),
      })),
    })
  } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }) }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const id = body.id || body.subtaskId
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

    let completed = body.completed

    // Toggle case: team dashboard only sends the id without a completed value
    if (completed === undefined) {
      const existing = await db.subtask.findUnique({ where: { id } })
      if (!existing) return NextResponse.json({ error: 'Subtask not found' }, { status: 404 })
      completed = !existing.completed
    }

    const subtask = await db.subtask.update({
      where: { id },
      data: {
        ...(body.title !== undefined && { title: body.title }),
        completed,
      },
    })
    return NextResponse.json({ subtask })
  } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }) }
}

export async function DELETE(request: NextRequest) {
  try {
    const id =
      request.nextUrl.searchParams.get('subtaskId') ||
      (await request.json().then((body: { id?: string }) => body.id).catch(() => null))
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
    await db.subtask.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }) }
}