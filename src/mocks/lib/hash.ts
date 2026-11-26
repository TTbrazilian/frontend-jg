/**
 * Hashes e PRNG determinísticos (nada de Math.random): tudo que parece aleatório
 * na camada de mocks é derivado de uma semente para ser reproduzível.
 */

/** cyrb53: hash rápido de 53 bits. */
export function cyrb53(input: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed
  let h2 = 0x41c6ce57 ^ seed
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507)
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507)
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return 4294967296 * (2097151 & h2) + (h1 >>> 0)
}

/** Hex determinístico de tamanho arbitrário. */
export function hashHex(input: string, length = 16): string {
  let out = ''
  let round = 0
  while (out.length < length) {
    out += cyrb53(input, round++).toString(16).padStart(14, '0')
  }
  return out.slice(0, length)
}

/** Número em [0, 1) derivado do texto. */
export function unitInterval(input: string): number {
  return cyrb53(input) / 2 ** 53
}

/** UUID v4 (formato) derivado de um texto: mesma entrada → mesmo id. */
export function stableUuid(input: string): string {
  const h = hashHex(input, 32)
  const variant = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16)
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`
}

/** PRNG com semente (mulberry32). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** JSON com chaves ordenadas (para hashes de corpo/idempotência). */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`
}

let fallbackCounter = 0

/** Id aleatório (crypto.randomUUID); em contexto inseguro cai para um id derivado de relógio+contador. */
export function randomId(): string {
  const c: Crypto | undefined = typeof crypto !== 'undefined' ? crypto : undefined
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  fallbackCounter += 1
  return stableUuid(`fallback:${Date.now()}:${fallbackCounter}`)
}
