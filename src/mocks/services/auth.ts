import type { Session, User } from '@/api/contracts'
import { SESSION_TTL_MS } from '../config'
import { db, nowIso, persist } from '../db/store'
import type { DbSession, DbUser } from '../db/types'
import { randomId } from '../lib/hash'
import { MockHttpError } from '../lib/respond'

export type AuthResult = { kind: 'user'; user: DbUser; session: DbSession } | { kind: 'none' } | { kind: 'invalid' }

export function readBearer(request: Request): string | null {
  const header = request.headers.get('Authorization')
  if (!header) return null
  const match = /^Bearer\s+(.+)$/i.exec(header.trim())
  return match ? match[1].trim() : ''
}

export function isSessionActive(session: DbSession): boolean {
  return !session.revokedAt && Date.parse(session.expiresAt) > Date.now()
}

/** Sem header → none; token desconhecido/expirado/revogado → invalid. */
export function resolveAuth(request: Request): AuthResult {
  const token = readBearer(request)
  if (token === null) return { kind: 'none' }
  const session = db().sessions.find((s) => s.token === token)
  if (!session || !isSessionActive(session)) return { kind: 'invalid' }
  const user = db().users.find((u) => u.id === session.userId)
  if (!user) return { kind: 'invalid' }
  return { kind: 'user', user, session }
}

/** Exige sessão válida; lança 401 UNAUTHENTICATED (sem token) ou SESSION_EXPIRED. */
export function requireUser(request: Request): { user: DbUser; session: DbSession } {
  const auth = resolveAuth(request)
  if (auth.kind === 'user') return auth
  if (auth.kind === 'none') throw new MockHttpError('UNAUTHENTICATED', 'Entre na sua conta para continuar.')
  throw new MockHttpError('SESSION_EXPIRED', 'Sua sessão expirou. Entre novamente.')
}

export function toUser(user: DbUser): User {
  return {
    id: user.id,
    displayName: user.displayName,
    username: user.username,
    email: user.email,
    ensName: user.ensName,
    walletNickname: user.walletNickname,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
  }
}

export function toSession(session: DbSession, user: DbUser): Session {
  return { token: session.token, expiresAt: session.expiresAt, user: toUser(user) }
}

function pruneSessions(): void {
  const cutoff = Date.now() - 24 * 3600 * 1000
  db().sessions = db().sessions.filter((s) => Date.parse(s.expiresAt) > cutoff && (!s.revokedAt || Date.parse(s.revokedAt) > cutoff))
}

export function createSession(userId: string): DbSession {
  pruneSessions()
  const now = Date.now()
  const session: DbSession = {
    token: randomId(),
    userId,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + SESSION_TTL_MS).toISOString(),
    revokedAt: null,
  }
  db().sessions.push(session)
  persist()
  return session
}

export function revokeSession(token: string): void {
  const session = db().sessions.find((s) => s.token === token)
  if (session && !session.revokedAt) {
    session.revokedAt = nowIso()
    persist()
  }
}

/** Revoga todas as sessões (ou todas de um usuário, exceto `keepToken`). Retorna quantas. */
export function revokeSessions(filter: { userId?: string; keepToken?: string } = {}): number {
  const at = nowIso()
  let count = 0
  for (const s of db().sessions) {
    if (s.revokedAt) continue
    if (filter.userId && s.userId !== filter.userId) continue
    if (filter.keepToken && s.token === filter.keepToken) continue
    s.revokedAt = at
    count += 1
  }
  persist()
  return count
}
