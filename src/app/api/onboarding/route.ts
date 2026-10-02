import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requireAdmin, handleApiError } from '@/lib/api-auth'

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req)
    const { searchParams } = new URL(req.url)
    const clientId = searchParams.get('clientId')

    // If clientId is provided, return forms assigned to this client OR
    // forms assigned to projects the client is a member of (where clientId is null)
    // Also filter to only published forms for clients
    let where: Record<string, unknown> = {}
    if (clientId) {
      // Find all projects this client is a member of
      const clientProjects = await db.clientProject.findMany({
        where: { clientId },
        select: { projectId: true },
      })
      const projectIds = clientProjects.map((cp) => cp.projectId)
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