import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requireAdmin, handleApiError } from '@/lib/api-auth'

// GET /api/onboarding/:id - get form with submissions
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(req)
    const { id } = await params
    const { searchParams } = new URL(req.url)
    const clientId = searchParams.get('clientId')

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

    // If clientId is provided, verify the client has access to this form
    // (either directly assigned or via project membership)
    if (clientId) {
      const directAccess = form.clientId === clientId
      if (!directAccess) {
        const projectAccess = await db.clientProject.findUnique({
          where: { clientId_projectId: { clientId, projectId: form.projectId } }
        })
        if (!projectAccess) {
          return NextResponse.json({ error: 'Not found' }, { status: 404 })
        }
      }

      // Auto-create an in_progress submission for this client if none exists
      const existingSub = form.submissions.find((s: { clientId: string }) => s.clientId === clientId)
      if (!existingSub) {
        const newSub = await db.onboarding.create({
          data: {
            formId: id,
            clientId,
            status: 'in_progress',
            responsesJson: '{}',
          },
          include: { client: { select: { id: true, name: true, email: true, company: true, avatar: true } }, reviewer: { select: { id: true, name: true } } }
        })
        form.submissions = [newSub, ...form.submissions]
      }
    }

    return NextResponse.json({ form })
  } catch { return NextResponse.json({ error: 'Failed to fetch onboarding form' }, { status: 500 }) }
}

// PATCH /api/onboarding/:id - submit response, review, or update form
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const { action, ...data } = body

    if (action === 'saveDraft' || action === 'submit') {
      // Client saves draft or submits onboarding — no admin required
      const { formId, clientId, responsesJson } = data as { formId?: string; clientId?: string; responsesJson?: string }

      const existingSubmission = await db.onboarding.findUnique({ where: { id } })

      if (existingSubmission) {
        const updateData: Record<string, unknown> = {
          responsesJson: responsesJson || existingSubmission.responsesJson,
          updatedAt: new Date(),
        }
        if (action === 'submit') {
          updateData.status = 'submitted'
          updateData.submittedAt = new Date()
        }
        const result = await db.onboarding.update({
          where: { id },
          data: updateData,
          include: { form: true, client: { select: { id: true, name: true } } }
        })
        if (action === 'submit') {
          await db.activityLog.create({ data: { action: 'onboarding_submitted', details: `Submitted onboarding for "${result.form.title}"`, userId: result.clientId } })
        }
        return NextResponse.json({ onboarding: result })
      } else if (formId && clientId) {
        const result = await db.onboarding.upsert({
          where: { formId_clientId: { formId, clientId } },
          create: { formId, clientId, status: action === 'submit' ? 'submitted' : 'in_progress', submittedAt: action === 'submit' ? new Date() : null, responsesJson: responsesJson || '{}' },
          update: { status: action === 'submit' ? 'submitted' : 'in_progress', submittedAt: action === 'submit' ? new Date() : null, responsesJson: responsesJson || '{}', updatedAt: new Date() },
          include: { form: true, client: { select: { id: true, name: true } } }
        })
        if (action === 'submit') {
          await db.activityLog.create({ data: { action: 'onboarding_submitted', details: `Submitted onboarding for "${result.form.title}"`, userId: result.clientId } })
        }
        return NextResponse.json({ onboarding: result })
      } else {
        return NextResponse.json({ error: 'Missing formId and clientId for new submission' }, { status: 400 })
      }

    }

    // All other actions (review, update form) require admin
    await requireAdmin(req)

    if (action === 'review') {
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
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/onboarding/:id - delete onboarding form (admin only)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(req)

    const { id } = await params
    const form = await db.onboardingForm.findUnique({
      where: { id },
      select: { title: true }
    })
    if (!form) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await db.onboardingForm.delete({ where: { id } })
    await db.activityLog.create({ data: { action: 'onboarding_deleted', details: `Deleted onboarding form "${form.title}"` } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error)
  }
}
