import { getAuthToken } from '@/stores/auth'

/**
 * Client-side fetch wrapper that automatically includes the auth token.
 * Usage: await authFetch('/api/projects') — same API as fetch()
 */
export async function authFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const token = getAuthToken()
  const headers = new Headers(init?.headers)

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  return fetch(input, { ...init, headers })
}
