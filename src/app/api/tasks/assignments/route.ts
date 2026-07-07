import { Request, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: Request) {
  try {
    const { userId, taskId } = await request.json()
    if (!userId || !taskId) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    const assignment = await db.taskAssignment.create({ data: { userId, taskId } })
    return NextResponse.json({ assignment }, { status: 201 })
  } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }) }
}

export async function DELETE(request: Request) {
  try {
    const { userId, taskId } = await request.json()
    if (!userId || !taskId) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    await db.taskAssignment.deleteMany({ where: { userId, taskId } })
    return NextResponse.json({ success: true })
  } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }) }
}