import { db } from '@/lib/db'
import type { NextRequest } from 'next/server'

const SESSION_DURATION_DAYS = 7

/**
 * Generate a cryptographically random session token.
 */
export function generateSessionToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Create a session in the database for the given user, return the token.
 */
export async function createSession(userId: string): Promise<string> {
  const token = generateSessionToken()
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS)

  await db.session.create({
    data: { token, userId, expiresAt },
  })

  return token
}

/**
 * Validate a session token and return the user (with role).
 * Returns null if the token is invalid, expired, or not found.
 */
export async function validateSession(token: string) {
  const session = await db.session.findUnique({
    where: { token },
    include: { user: { select: { id: true, email: true, name: true, role: true, status: true } } },
  })

  if (!session) return null

  // Check expiry
  if (new Date() > session.expiresAt) {
    await db.session.delete({ where: { id: session.id } })
    return null
  }

  // Check user status
  if (session.user.status === 'inactive') return null

  return session.user
}

/**
 * Delete a session (used on logout).
 */
export async function deleteSession(token: string): Promise<void> {
  await db.session.deleteMany({ where: { token } })
}

/**
 * Extract the Authorization bearer token from a request.
 * Returns null if no valid token is found.
 */
export function extractToken(request: NextRequest): string | null {
  const auth = request.headers.get('authorization')
  if (auth?.startsWith('Bearer ')) return auth.slice(7)
  return null
}

/**
 * Get the authenticated user from a request's Authorization header.
 * Returns null if not authenticated.
 */
export async function getAuthUser(request: NextRequest) {
  const token = extractToken(request)
  if (!token) return null
  return validateSession(token)
}

/**
 * Require authentication — returns the user or throws a 401 response.
 */
export async function requireAuth(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) {
    throw new AuthError('Unauthorized', 401)
  }
  return user
}

/**
 * Require admin role — returns the user or throws a 403 response.
 */
export async function requireAdmin(request: NextRequest) {
  const user = await requireAuth(request)
  if (user.role !== 'admin') {
    throw new AuthError('Forbidden: Admin access required', 403)
  }
  return user
}

/**
 * Custom error class that carries HTTP status codes.
 */
export class AuthError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
    this.name = 'AuthError'
  }
}
