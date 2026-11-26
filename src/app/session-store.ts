import { useSyncExternalStore } from 'react'
import type { Session, User } from '@/api/contracts'
import { readJson, uuid, writeJson } from '@/lib/utils'

/**
 * Store de sessão fora do React (para o interceptor do Axios e o socket).
 * Persistimos apenas o token opaco + dados públicos do usuário; nunca senha.
 */
const SESSION_KEY = 'nft.session'
const GUEST_CART_KEY = 'nft.guestCartId'

export type SessionStatus = 'anonymous' | 'authenticated' | 'expired'

export interface SessionState {
  status: SessionStatus
  token: string | null
  user: User | null
  expiresAt: string | null
  /** Incrementa a cada troca de identidade (login/logout/troca de usuário). */
  epoch: number
}

type Listener = () => void
const listeners = new Set<Listener>()

function load(): SessionState {
  const saved = readJson<Session>(SESSION_KEY)
  if (saved?.token && saved.user) {
    return { status: 'authenticated', token: saved.token, user: saved.user, expiresAt: saved.expiresAt, epoch: 0 }
  }
  return { status: 'anonymous', token: null, user: null, expiresAt: null, epoch: 0 }
}

let state: SessionState = typeof window === 'undefined' ? { status: 'anonymous', token: null, user: null, expiresAt: null, epoch: 0 } : load()

function emit() {
  listeners.forEach((l) => l())
}

export const sessionStore = {
  get: () => state,
  subscribe(listener: Listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  /** Login/cadastro bem-sucedido. */
  signIn(session: Session) {
    const sameUser = state.user?.id === session.user.id
    state = {
      status: 'authenticated',
      token: session.token,
      user: session.user,
      expiresAt: session.expiresAt,
      epoch: sameUser ? state.epoch : state.epoch + 1,
    }
    writeJson(SESSION_KEY, session)
    emit()
  },
  /** Atualiza dados públicos do usuário (ex.: após editar perfil). */
  updateUser(user: User) {
    if (!state.token) return
    state = { ...state, user }
    writeJson(SESSION_KEY, { token: state.token, user, expiresAt: state.expiresAt })
    emit()
  },
  /** Sessão expirou no servidor: mantém o usuário para retomada, mas derruba o token. */
  expire() {
    if (state.status !== 'authenticated') return
    state = { ...state, status: 'expired', token: null }
    writeJson(SESSION_KEY, null)
    emit()
  },
  signOut() {
    state = { status: 'anonymous', token: null, user: null, expiresAt: null, epoch: state.epoch + 1 }
    writeJson(SESSION_KEY, null)
    emit()
  },
}

export function getGuestCartId(): string {
  let id = readJson<string>(GUEST_CART_KEY)
  if (!id) {
    id = `guest_${uuid()}`
    writeJson(GUEST_CART_KEY, id)
  }
  return id
}

export function resetGuestCartId(): void {
  writeJson(GUEST_CART_KEY, null)
}

export function useSession(): SessionState {
  return useSyncExternalStore(sessionStore.subscribe, sessionStore.get, sessionStore.get)
}

/** Escopo usado nas query keys para isolar dados por usuário. */
export function sessionScope(s: SessionState = state): string {
  // Sessão expirada mantém o escopo do usuário: o cache continua visível (somente leitura)
  // até ele autenticar de novo, preservando o contexto (ex.: checkout).
  return s.user && s.status !== 'anonymous' ? `user:${s.user.id}` : `guest:${getGuestCartId()}`
}
