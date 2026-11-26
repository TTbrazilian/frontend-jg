import { DB_STORAGE_KEY } from '../config'
import { buildSeed } from './seed'
import type { DbState } from './types'

/**
 * "Banco" em memória com persistência em localStorage (`nft-mock-db:v1`).
 * Todas as mutações passam por `persist()` depois de alterar o objeto retornado por `db()`.
 */

let state: DbState | null = null

function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
}

function isDbState(value: unknown): value is DbState {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    v.schema === 1 &&
    typeof v.epoch === 'string' &&
    ['users', 'sessions', 'nfts', 'carts', 'coupons', 'quotes', 'orders', 'idempotency', 'wallets', 'walletConnections'].every((k) =>
      Array.isArray(v[k]),
    ) &&
    typeof v.favorites === 'object' &&
    v.favorites !== null
  )
}

function load(): DbState | null {
  const raw = storage()?.getItem(DB_STORAGE_KEY)
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    return isDbState(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function db(): DbState {
  if (!state) throw new Error('[mocks] DB não inicializado: chame initDb() antes de iniciar o worker.')
  return state
}

export function persist(): void {
  const s = storage()
  if (!s || !state) return
  try {
    s.setItem(DB_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Quota excedida: descarta dados recriáveis (cotações) e tenta de novo.
    state.quotes = []
    try {
      s.setItem(DB_STORAGE_KEY, JSON.stringify(state))
    } catch (error) {
      console.warn('[mocks] não foi possível persistir o DB simulado', error)
    }
  }
}

export async function initDb(): Promise<void> {
  state = load() ?? (await buildSeed())
  persist()
}

/** Restaura integralmente o seed. */
export async function resetDb(): Promise<void> {
  state = await buildSeed()
  persist()
}

let syncing = false

/** Mantém abas sincronizadas: outra aba gravou o DB → recarrega o estado em memória. */
export function enableCrossTabSync(): void {
  if (syncing || typeof window === 'undefined') return
  syncing = true
  window.addEventListener('storage', (event) => {
    if (event.key !== DB_STORAGE_KEY || !event.newValue) return
    try {
      const parsed: unknown = JSON.parse(event.newValue)
      if (isDbState(parsed)) state = parsed
    } catch {
      /* ignora */
    }
  })
}

export const nowIso = (): string => new Date().toISOString()
