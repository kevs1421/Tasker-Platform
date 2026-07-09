import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/onboarding/:id - get form with submissions
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const form = await db.onboardingForm.findUnique({
      where: { id },
      include: {
        project: { select: { id: true, name: true, color: true } },
        client: { select: { id: true, name: true, email: true, company: true } },
        submissions: {
          include: { client: { select: { id: true, name: true, email: true, company: true, avatar: true } }, reviewer: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'desc' }
        },
        _count: { select: { submissions: true } }
      }
    })
    if (!form) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ form })
  } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }) }
}

// PATCH /api/onboarding/:id - update form or review submission
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const { action, ...data } = body

    if (action === 'submit') {
      // Client submits their onboarding
      const updated = await db.onboarding.update({
        where: { id },
        data: { status: 'submitted', submittedAt: new Date(), responsesJson: data.responsesJson, updatedAt: new Date() },
        include: { form: true, client: { select: { id: true, name: true } } }
      })
      await db.activityLog.create({ data: { action: 'onboarding_submitted', details: `Submitted onboarding for "${updated.form.title}"`, userId: updated.clientId } })
      return NextResponse.json({ onboarding: updated })
    }

    if (action === 'review') {
      // Admin reviews a submission
      const { reviewStatus, reviewNotes, reviewedBy } = data
      const updated = await db.onboarding.update({
        where: { id },
        data: { status: reviewStatus, reviewNotes: reviewNotes || null, reviewedBy, reviewedAt: new Date(), updatedAt: new Date() },
        include: { form: true, client: { select: { id: true, name: true } }, reviewer: { select: { id: true, name: true } } }
      })
      await db.activityLog.create({ data: { action: 'onboarding_reviewed', details: `${reviewStatus === 'approved' ? 'Approved' : 'Rejected'} onboarding from ${updated.client.name}`, userId: reviewedBy } })
      return NextResponse.json({ onboarding: updated })
    }

    // Update form itself
    const updateData: Record<string, unknown> = {}
    if (data.title !== undefined) updateData.title = data.title
    if (data.description !== undefined) updateData.description = data.description
    if (data.stepsJson !== undefined) updateData.stepsJson = data.stepsJson
    if (data.status !== undefined) updateData.status = data.status
    if (data.projectId !== undefined) updateData.projectId = data.projectId
    if (data.clientId !== undefined) updateData.clientId = data.clientId

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    const form = await db.onboardingForm.update({
      where: { id },
      data: updateData,
      include: {
        project: { select: { id: true, name: true, color: true } },
        client: { select: { id: true, name: true, email: true, company: true } },
        _count: { select: { submissions: true } }
      }
    })

    await db.activityLog.create({
      data: { action: 'onboarding_updated', details: `Updated onboarding form "${form.title}"` }
    })

    return NextResponse.json({ form })
  } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }) }
}

// DELETE /api/onboarding/:id - delete onboarding form and its submissions
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const form = await db.onboardingForm.findUnique({
      where: { id },
      select: { title: true }
    })
    if (!form) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await db.onboardingForm.delete({ where: { id } })
    await db.activityLog.create({ data: { action: 'onboarding_deleted', details: `Deleted onboarding form "${form.title}"` } })
    return NextResponse.json({ success: true })
  } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }) }
}