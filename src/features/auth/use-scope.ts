import { sessionScope, useSession } from '@/app/session-store'

/** Escopo das query keys privadas para a identidade atual. */
export function useScope(): { scope: string; isAuthenticated: boolean; userId: string | null } {
  const session = useSession()
  const isAuthenticated = session.status === 'authenticated' && !!session.token
  return { scope: sessionScope(session), isAuthenticated, userId: session.user?.id ?? null }
}
