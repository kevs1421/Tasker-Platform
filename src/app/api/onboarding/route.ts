import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requireAdmin, handleApiError } from '@/lib/api-auth'

export async function GET(req: NextRequest) {
  try {
    const authed = await requireAuth(req)
    const { searchParams } = new URL(req.url)
    const clientId = searchParams.get('clientId')

    // For client role, verify clientId matches authenticated user
    if (authed.role === 'client') {
      if (clientId && clientId !== authed.id) {
        return NextResponse.json({ error: 'You can only view your own onboarding forms' }, { status: 403 })
      }
    }

    // If clientId is provided, return forms assigned to this client OR
    // forms assigned to projects the client is a member of (where clientId is null)
    // Also filter to only published forms for clients
    let where: Record<string, unknown> = {}
    if (clientId) {
      // Find all projects this client is a member of via THREE sources:
      // 1. ClientProject junction table (explicit link)
      // 2. ProjectMember table (fallback for clients added as project members)
      // 3. Approved Onboarding submissions (Onboarding → OnboardingForm → Project)
      const clientProjectLinks = await db.clientProject.findMany({
        where: { clientId },
        select: { projectId: true },
      })
      const memberLinks = await db.projectMember.findMany({
        where: { userId: clientId },
        select: { projectId: true },
      })
      const approvedOnboardings = await db.onboarding.findMany({
        where: { clientId, status: 'approved' },
        select: { form: { select: { projectId: true } } },
      })
      const projectIds = [...new Set([
        ...clientProjectLinks.map((cp) => cp.projectId),
        ...memberLinks.map((m) => m.projectId),
        ...approvedOnboardings.map((o) => o.form.projectId).filter(Boolean),
      ])]

      // Back-fill missing ClientProject links so future queries are consistent
      const linkedIds = new Set(clientProjectLinks.map((cp) => cp.projectId))
      const missingIds = projectIds.filter((id) => !linkedIds.has(id))
      if (missingIds.length > 0) {
        try {
          await Promise.all(
            missingIds.map((projectId) =>
              db.clientProject.upsert({
                where: { clientId_projectId: { clientId, projectId } },
                create: { clientId, projectId },
                update: {},
              })
            )
          )
        } catch { /* ignore backfill errors */ }
      }

      where = {
        status: 'published', // Clients can only see published forms
        OR: [
          { clientId },          // forms explicitly assigned to this client
          { clientId: null, projectId: { in: projectIds } }, // forms on client's projects without specific client
        ]
      }
    }

    const forms = await db.onboardingForm.findMany({
      where,
      include: {
        project: { select: { id: true, name: true, color: true } },
        client: { select: { id: true, name: true, email: true, company: true } },
        submissions: clientId ? {
          where: { clientId },
          orderBy: { createdAt: 'desc' as const },
        } : false,
        _count: { select: { submissions: true } }
      },
      orderBy: { createdAt: 'desc' }
    })
    return NextResponse.json({ forms })
  } catch (error) { return handleApiError(error) }
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
    return handleApiError(error)
  }
}