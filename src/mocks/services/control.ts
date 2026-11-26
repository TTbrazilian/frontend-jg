import Big from 'big.js'
import type { MockScenario, MockState, Nft, NftUpdatedEvent, Order } from '@/api/contracts'
import { resetDb } from '../db/store'
import { ETH_RE } from '../lib/validation'
import { MockHttpError } from '../lib/respond'
import {
  broadcastNftUpdated,
  clearRealtimeMemory,
  disconnectAllSockets,
  envelope,
  findNftEvent,
  getLastNftEvent,
  nextStaleSeed,
} from '../realtime'
import {
  getMockState,
  isMockScenario,
  resetScenarioState,
  setLatency as setLatencyState,
  setOrderResolution as setOrderResolutionState,
  setScenarioState,
} from '../scenarios'
import { revokeSessions } from './auth'
import { commitNftChange, editionStatus, nftUpdatedData, requireNft, toNft } from './catalog'
import { clearOrderTimers, resolveOrder } from './orders'

/**
 * Lógica de controle da simulação. Usada pelos endpoints `/api/__mock/*` e pela
 * fachada `window.__mock` (mesmo código, mesmos efeitos).
 */

export function getState(): MockState {
  return getMockState()
}

/**
 * Ativa um cenário. Efeitos: `session-expired` revoga todas as sessões emitidas até agora
 * (logins posteriores funcionam); `offline` derruba os sockets (reconexões são recusadas).
 * No boot (`?scenario=`), a revogação só acontece se o cenário mudou.
 */
export function setScenario(value: unknown, { fromBoot = false } = {}): MockState {
  if (!isMockScenario(value)) {
    throw new MockHttpError('VALIDATION_ERROR', 'Cenário desconhecido.', { fieldErrors: { scenario: 'Cenário desconhecido.' } })
  }
  const scenario: MockScenario = value
  const changed = setScenarioState(scenario)
  if (scenario === 'session-expired' && (!fromBoot || changed)) revokeSessions()
  if (scenario === 'offline' && (!fromBoot || changed)) disconnectAllSockets(1013, 'offline')
  return getMockState()
}

/** Restaura o seed, o cenário padrão, derruba sessões (o seed não tem sessões) e sockets. */
export async function reset(): Promise<MockState> {
  clearOrderTimers()
  await resetDb()
  resetScenarioState()
  clearRealtimeMemory()
  disconnectAllSockets()
  return getMockState()
}

function intInRange(value: unknown, min: number, max: number, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw new MockHttpError('VALIDATION_ERROR', `Valor inválido para ${field}.`, {
      fieldErrors: { [field]: `Use um inteiro entre ${min} e ${max}.` },
    })
  }
  return value
}

export function setLatency(value: unknown): MockState {
  setLatencyState(intInRange(value, 0, 60_000, 'latencyMs'))
  return getMockState()
}

export function setOrderResolution(value: unknown): MockState {
  setOrderResolutionState(intInRange(value, 0, 600_000, 'ms'))
  return getMockState()
}

export interface NftUpdateInput {
  nftId?: unknown
  editionId?: unknown
  priceEth?: unknown
  available?: unknown
}

/** Muta preço/estoque de uma edição (padrão: a primeira) e emite `nft.updated`. */
export function nftUpdate(input: NftUpdateInput): { nft: Nft; event: NftUpdatedEvent } {
  if (typeof input.nftId !== 'string') {
    throw new MockHttpError('VALIDATION_ERROR', 'Informe nftId.', { fieldErrors: { nftId: 'Obrigatório.' } })
  }
  const nft = requireNft(input.nftId)
  const edition = input.editionId === undefined ? nft.editions[0] : nft.editions.find((e) => e.id === input.editionId)
  if (!edition) throw new MockHttpError('NOT_FOUND', 'Edição não encontrada.')
  const fieldErrors: Record<string, string> = {}
  if (input.priceEth !== undefined && (typeof input.priceEth !== 'string' || !ETH_RE.test(input.priceEth) || new Big(input.priceEth).lte(0))) {
    fieldErrors.priceEth = 'Use um decimal positivo em string (ex.: "0.25").'
  }
  if (input.available !== undefined && (typeof input.available !== 'number' || !Number.isInteger(input.available) || input.available < 0)) {
    fieldErrors.available = 'Use um inteiro ≥ 0.'
  }
  if (input.priceEth === undefined && input.available === undefined) fieldErrors.priceEth = 'Informe priceEth e/ou available.'
  if (Object.keys(fieldErrors).length) throw new MockHttpError('VALIDATION_ERROR', 'Parâmetros inválidos.', { fieldErrors })

  if (typeof input.priceEth === 'string') edition.priceEth = new Big(input.priceEth).toFixed()
  if (typeof input.available === 'number') {
    edition.available = input.available
    if (input.available > edition.supply) edition.supply = input.available
  }
  const event = commitNftChange(nft)
  return { nft: toNft(nft), event }
}

/** Reemite um nft.updated já enviado com o MESMO eventId (testa deduplicação). */
export function emitDuplicate(eventId?: unknown): NftUpdatedEvent {
  const event = typeof eventId === 'string' && eventId ? findNftEvent(eventId) : getLastNftEvent()
  if (!event) throw new MockHttpError('NOT_FOUND', 'Nenhum evento nft.updated para reemitir.')
  broadcastNftUpdated(event, { remember: false })
  return event
}

/**
 * Emite nft.updated com versão MENOR que a atual e dados antigos/divergentes
 * (preço pela metade, +1 unidade), para provar que o cliente descarta eventos obsoletos.
 */
export function emitStale(nftId: unknown): NftUpdatedEvent {
  if (typeof nftId !== 'string') throw new MockHttpError('VALIDATION_ERROR', 'Informe nftId.', { fieldErrors: { nftId: 'Obrigatório.' } })
  const nft = requireNft(nftId)
  const current = nftUpdatedData(nft)
  const editions = nft.editions.map((e) => ({
    id: e.id,
    priceEth: new Big(e.priceEth).div(2).round(6, Big.roundHalfEven).toFixed(),
    available: Math.max(0, e.available) + 1,
    status: e.disabled ? editionStatus(e) : ('available' as const),
  }))
  const minPriceEth = new Big(current.minPriceEth).div(2).round(6, Big.roundHalfEven).toFixed()
  const event = envelope(
    'nft.updated',
    { type: 'nft', id: nft.id },
    Math.max(0, nft.version - 1),
    { nftId: nft.id, minPriceEth, available: current.available + 1, soldOut: false, editions },
    nextStaleSeed(nft.id),
  )
  broadcastNftUpdated(event, { remember: false })
  return event
}

export function disconnectSockets(): { closed: number } {
  return { closed: disconnectAllSockets() }
}

export function expireSessions(): { revoked: number } {
  return { revoked: revokeSessions() }
}

export function resolveOrderManually(orderId: string, status: unknown): Order {
  if (status !== 'confirmed' && status !== 'declined') {
    throw new MockHttpError('VALIDATION_ERROR', 'Status inválido.', { fieldErrors: { status: 'Use "confirmed" ou "declined".' } })
  }
  return resolveOrder(orderId, status)
}
