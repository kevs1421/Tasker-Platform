import { Request, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: Request) {
  try {
    const { title, completed, taskId } = await request.json()
    if (!title || !taskId) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    const subtask = await db.subtask.create({ data: { title, completed: completed || false, taskId } })
    return NextResponse.json({ subtask }, { status: 201 })
  } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }) }
}

export async function PATCH(request: Request) {
  try {
    const { id, title, completed } = await request.json()
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
    const subtask = await db.subtask.update({ where: { id }, data: { ...(title !== undefined && { title }), ...(completed !== undefined && { completed }) } })
    return NextResponse.json({ subtask })
  } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }) }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json()
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
    await db.subtask.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }) }
}