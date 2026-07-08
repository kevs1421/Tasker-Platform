import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const forms = await db.onboardingForm.findMany({
      include: {
        project: { select: { id: true, name: true, color: true } },
        _count: { select: { submissions: true } }
      },
      orderBy: { createdAt: 'desc' }
    })
    return NextResponse.json({ forms })
  } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }) }
}

export async function POST(request: NextRequest) {
  try {
    const { title, description, stepsJson, projectId, status } = await request.json()
    if (!title || !projectId || !stepsJson) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const form = await db.onboardingForm.create({
      data: { title, description: description || null, stepsJson, projectId, status: status || 'published' },
      include: { project: { select: { id: true, name: true, color: true } }, _count: { select: { submissions: true } } }
    })
    return NextResponse.json({ form }, { status: 201 })
  } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }) }
}