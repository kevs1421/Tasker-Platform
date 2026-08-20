import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, AuthError } from '@/lib/session'

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
  } catch { return NextResponse.json({ error: 'Failed to fetch onboarding forms' }, { status: 500 }) }
}

export async function POST(request: NextRequest) {
  try {
    // Only admins can create onboarding forms
    await requireAdmin(request)

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
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return NextResponse.json({ error: 'Failed to process onboarding request' }, { status: 500 })
  }
}