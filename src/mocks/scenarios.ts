import { MOCK_SCENARIOS, type MockScenario, type MockState } from '@/api/contracts'
import { API_PATHNAME, DEFAULT_LATENCY_MS, DEFAULT_ORDER_RESOLUTION_MS, SCENARIO_STORAGE_KEY, SLOW_NETWORK_MS } from './config'
import { unitInterval } from './lib/hash'

/**
 * Estado do cenário de simulação, persistido em localStorage (`nft-mock-scenario`).
 * Efeitos colaterais da troca de cenário (revogar sessões, derrubar sockets) ficam em
 * services/control.ts para evitar dependências circulares.
 */

interface PersistedScenario extends MockState {
  /** Carrinhos em que o cenário de checkout já disparou (rearma quando o cenário é reativado). */
  checkoutTriggered: string[]
}

const DEFAULT_STATE: PersistedScenario = {
  scenario: 'default',
  latencyMs: DEFAULT_LATENCY_MS,
  orderResolutionMs: DEFAULT_ORDER_RESOLUTION_MS,
  checkoutTriggered: [],
}

let current: PersistedScenario = { ...DEFAULT_STATE }
/** Contador de requisições (semente da latência determinística). Zera no boot/reset. */
let requestCounter = 0

export function isMockScenario(value: unknown): value is MockScenario {
  return typeof value === 'string' && (MOCK_SCENARIOS as readonly string[]).includes(value)
}

function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
}

function save(): void {
  try {
    storage()?.setItem(SCENARIO_STORAGE_KEY, JSON.stringify(current))
  } catch {
    /* ignora */
  }
}

function load(): PersistedScenario {
  try {
    const raw = storage()?.getItem(SCENARIO_STORAGE_KEY)
    if (!raw) return { ...DEFAULT_STATE }
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return { ...DEFAULT_STATE }
    const p = parsed as Partial<Record<keyof PersistedScenario, unknown>>
    return {
      scenario: isMockScenario(p.scenario) ? p.scenario : 'default',
      latencyMs: typeof p.latencyMs === 'number' && p.latencyMs >= 0 ? p.latencyMs : DEFAULT_LATENCY_MS,
      orderResolutionMs:
        typeof p.orderResolutionMs === 'number' && p.orderResolutionMs >= 0 ? p.orderResolutionMs : DEFAULT_ORDER_RESOLUTION_MS,
      checkoutTriggered: Array.isArray(p.checkoutTriggered) ? p.checkoutTriggered.filter((x): x is string => typeof x === 'string') : [],
    }
  } catch {
    return { ...DEFAULT_STATE }
  }
}

/** Overrides vindos da URL no boot (`?scenario=`, `?latency=`). */
export interface BootOverrides {
  scenario?: MockScenario
  latencyMs?: number
}

/** Carrega o estado persistido e devolve os overrides da URL (aplicados por control.applyScenario). */
export function initScenario(): BootOverrides {
  current = load()
  requestCounter = 0
  save()
  const overrides: BootOverrides = {}
  if (typeof window === 'undefined') return overrides
  const params = new URLSearchParams(window.location.search)
  const scenario = params.get('scenario')
  if (isMockScenario(scenario)) overrides.scenario = scenario
  else if (scenario) console.warn(`[mocks] cenário desconhecido em ?scenario=: ${scenario}`)
  const latency = params.get('latency')
  if (latency !== null && /^\d+$/.test(latency)) overrides.latencyMs = Number(latency)
  return overrides
}

export function getMockState(): MockState {
  return { scenario: current.scenario, latencyMs: current.latencyMs, orderResolutionMs: current.orderResolutionMs }
}

export const scenario = (): MockScenario => current.scenario
export const isScenario = (s: MockScenario): boolean => current.scenario === s

/** Troca o cenário; retorna true se mudou. Rearma os gatilhos de checkout. */
export function setScenarioState(next: MockScenario): boolean {
  const changed = current.scenario !== next
  current = { ...current, scenario: next, checkoutTriggered: [] }
  save()
  return changed
}

export function setLatency(ms: number): void {
  current = { ...current, latencyMs: ms }
  save()
}

export function setOrderResolution(ms: number): void {
  current = { ...current, orderResolutionMs: ms }
  save()
}

export function resetScenarioState(): void {
  current = { ...DEFAULT_STATE, checkoutTriggered: [] }
  requestCounter = 0
  save()
}

export function checkoutTriggerArmed(cartId: string): boolean {
  return !current.checkoutTriggered.includes(cartId)
}

export function markCheckoutTriggered(cartId: string): void {
  current = { ...current, checkoutTriggered: [...current.checkoutTriggered, cartId] }
  save()
}

/**
 * Latência determinística por requisição:
 * - endpoints de controle (`/__mock/*`): 0;
 * - `slow-network`: 2500 ms fixos;
 * - `variable-latency` em GET /nfts: comprimento de `q` ímpar → 1800 ms, par (inclusive vazio) → 200 ms.
 *   Ex.: digitar "a" e depois "ab" faz a resposta de "ab" chegar ANTES da de "a" (fora de ordem);
 * - demais: `latencyMs × (0.5 + h)`, h ∈ [0,1) = hash(método + URL + contador). Padrão 300 → 150–450 ms.
 *   `latencyMs = 0` desliga a latência.
 */
export function computeDelay(method: string, url: URL): number {
  if (url.pathname.startsWith(`${API_PATHNAME}/__mock`)) return 0
  if (current.scenario === 'slow-network') return SLOW_NETWORK_MS
  if (current.scenario === 'variable-latency' && method === 'GET' && url.pathname === `${API_PATHNAME}/nfts`) {
    return (url.searchParams.get('q') ?? '').length % 2 === 1 ? 1800 : 200
  }
  if (current.latencyMs <= 0) return 0
  requestCounter += 1
  const h = unitInterval(`${method} ${url.pathname}${url.search}#${requestCounter}`)
  return Math.round(current.latencyMs * (0.5 + h))
}
