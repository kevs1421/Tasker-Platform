import { db } from '@/lib/db'
import { AuthError } from '@/lib/session'

/**
 * Extract session token from a Request.
 * Checks: Authorization Bearer header, then x-session-token header, then cookie, then URL query param.
 */
function extractToken(request: Request): string | null {
  // 1. Authorization: Bearer <token>
  const auth = request.headers.get('authorization')
  if (auth?.startsWith('Bearer ')) return auth.slice(7)

  // 2. Custom header: x-session-token
  const custom = request.headers.get('x-session-token')
  if (custom) return custom

  // 3. Cookie header (fallback)
  const cookie = request.headers.get('cookie')
  if (cookie) {
    const match = cookie.match(/(?:^|;\s*)session-token=([^;]*)/)
    if (match?.[1]) return match[1]
  }

  // 4. URL query parameter (for file downloads opened via window.open)
  try {
    const url = new URL(request.url)
    const queryToken = url.searchParams.get('token')
    if (queryToken) return queryToken
  } catch {
    // Invalid URL — ignore
  }

  return null
}

/**
 * Validate the session token from a Request and return the authenticated user.
 * Throws AuthError if not authenticated or session is invalid/expired.
 */
async function getApiAuthUser(request: Request): Promise<{ id: string; role: string }> {
  const token = extractToken(request)
  if (!token) throw new AuthError('Unauthorized', 401)

  const session = await db.session.findUnique({
    where: { token },
    include: { user: { select: { id: true, role: true, status: true } } },
  })

  if (!session || session.expiresAt < new Date()) {
    throw new AuthError('Session expired or invalid', 401)
  }

  if (session.user.status !== 'active') {
    throw new AuthError('Account inactive', 403)
  }

  return { id: session.user.id, role: session.user.role }
}

/**
 * Require authentication — returns the user or throws AuthError(401).
 */
export async function requireAuth(request: Request) {
  return getApiAuthUser(request)
}

/**
 * Require admin role — returns the user or throws AuthError(401/403).
 */
export async function requireAdmin(request: Request) {
  const user = await requireAuth(request)
  if (user.role !== 'admin') {
    throw new AuthError('Admin access required', 403)
  }
  return user
}

/**
 * Standard error handler for API routes. Returns proper JSON error responses.
 */
export function handleApiError(error: unknown): Response {
  if (error instanceof AuthError) {
    return Response.json({ error: error.message }, { status: error.status })
  }
  // Log sanitized error for server-side debugging (no stack traces in production response)
  if (error instanceof Error) {
    console.error(`[API Error] ${error.message}`)
  } else {
    console.error('[API Error] Unknown error')
  }
  return Response.json({ error: 'Internal server error' }, { status: 500 })
}
