import { readJson, uuid, writeJson } from '@/lib/utils'
import type { CreateOrderRequest } from '@/api/contracts'

/**
 * Chave de idempotência por TENTATIVA de compra: o mesmo conteúdo (cotação revisada,
 * carteira, rede e dados do colecionador) reutiliza a mesma chave — inclusive após
 * timeout, refresh ou reconexão —, então o servidor devolve o mesmo pedido.
 * Conteúdo diferente gera chave nova. Guardada em sessionStorage, por usuário.
 */
function stableHash(input: string): string {
  let h1 = 0xdeadbeef ^ input.length
  let h2 = 0x41c6ce57 ^ input.length
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value as Record<string, unknown>)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

export function attemptFingerprint(body: CreateOrderRequest): string {
  return stableHash(canonical(body))
}

const keyFor = (userId: string, fp: string) => `nft.idem.${userId}.${fp}`

export function getOrCreateIdempotencyKey(userId: string, body: CreateOrderRequest): string {
  const storageKey = keyFor(userId, attemptFingerprint(body))
  const existing = readJson<string>(storageKey, 'session')
  if (existing) return existing
  const key = `idem_${uuid()}`
  writeJson(storageKey, key, 'session')
  return key
}

export function clearIdempotencyKey(userId: string, body: CreateOrderRequest): void {
  writeJson(keyFor(userId, attemptFingerprint(body)), null, 'session')
}

// ---- ponteiro de pedido pendente (recuperação após refresh/reconexão) ----
const pendingKey = (userId: string) => `nft.pendingOrder.${userId}`

export function setPendingOrder(userId: string, orderId: string | null): void {
  writeJson(pendingKey(userId), orderId)
}

export function getPendingOrder(userId: string): string | null {
  return readJson<string>(pendingKey(userId))
}
