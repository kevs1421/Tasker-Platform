import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const clientId = searchParams.get('clientId')

    // If clientId is provided, only return forms assigned to that client
    const where = clientId ? { clientId } : {}

    const forms = await db.onboardingForm.findMany({
      where,
      include: {
        project: { select: { id: true, name: true, color: true } },
        client: { select: { id: true, name: true, email: true, company: true } },
        _count: { select: { submissions: true } }
      },
      orderBy: { createdAt: 'desc' }
    })
    return NextResponse.json({ forms })
  } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }) }
}

export async function POST(request: NextRequest) {
  try {
    const { title, description, stepsJson, projectId, status, clientId } = await request.json()
    if (!title || !projectId || !stepsJson) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const form = await db.onboardingForm.create({
      data: {
        title, description: description || null, stepsJson, projectId,
        status: status || 'published',
        clientId: clientId || null,
      },
      include: {
        project: { select: { id: true, name: true, color: true } },
        client: { select: { id: true, name: true, email: true, company: true } },
        _count: { select: { submissions: true } }
      }
    })
    return NextResponse.json({ form }, { status: 201 })
  } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }) }
}