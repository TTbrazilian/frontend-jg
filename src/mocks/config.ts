/** Configuração compartilhada da camada de mocks (MSW). */

export const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/+$/, '')

/** Monta a URL de uma rota da API simulada (ex.: `api('/nfts')` → `/api/nfts`). */
export const api = (path: string): string => `${API_BASE}${path}`

/** Caminho (pathname) da base da API, mesmo quando VITE_API_BASE_URL é absoluta. */
export const API_PATHNAME = (() => {
  try {
    return new URL(API_BASE, 'http://mock.local').pathname.replace(/\/+$/, '')
  } catch {
    return '/api'
  }
})()

export const DB_STORAGE_KEY = 'nft-mock-db:v1'
export const SCENARIO_STORAGE_KEY = 'nft-mock-scenario'

export const SESSION_TTL_MS = 30 * 60 * 1000
export const QUOTE_TTL_MS = 5 * 60 * 1000

/** Latência base: cada resposta leva entre 50% e 150% deste valor (150–450 ms). */
export const DEFAULT_LATENCY_MS = 300
export const DEFAULT_ORDER_RESOLUTION_MS = 1500
export const SLOW_NETWORK_MS = 2500
export const ORDER_TIMEOUT_DELAY_MS = 8000

/** O binding anuncia pingInterval 25s/pingTimeout 5s mas nunca envia ping; enviamos a cada 20s. */
export const SOCKET_PING_INTERVAL_MS = 20_000

export const NETWORK_FEES_ETH = {
  ethereum: '0.016',
  polygon: '0.002',
  solana: '0.001',
} as const

export const AVATAR_MAX_BYTES = 1024 * 1024
export const AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const

/** Data de referência fixa do seed: a aba "Novos lançamentos" usa os 30 dias anteriores a ela. */
export const SEED_REFERENCE_DATE = Date.UTC(2026, 10, 20, 12, 0, 0)
export const NEW_RELEASE_WINDOW_MS = 30 * 24 * 3600 * 1000

export const EXPLORER_TX_URL = {
  ethereum: (hash: string) => `https://sepolia.etherscan.io/tx/${hash}`,
  polygon: (hash: string) => `https://amoy.polygonscan.com/tx/${hash}`,
  solana: (hash: string) => `https://explorer.solana.com/tx/${hash}?cluster=devnet`,
} as const
