import type { Order, OrderLine } from '@/api/contracts'
import { EXPLORER_TX_URL } from '../config'
import { base58Address } from '../db/seed'
import { db, nowIso, persist } from '../db/store'
import type { DbOrder } from '../db/types'
import { hashHex } from '../lib/hash'
import { MockHttpError } from '../lib/respond'
import { emitToUser, orderEvent } from '../realtime'
import { subtractPurchased } from './cart'
import { commitNftChange, findEdition, findNft } from './catalog'

const timers = new Map<string, ReturnType<typeof setTimeout>>()

export const DECLINE_REASON = 'Pagamento recusado pela carteira (saldo insuficiente na simulação).'

export function findOrderRecord(id: string): DbOrder | undefined {
  return db().orders.find((o) => o.order.id === id)
}

/** Agrupa as linhas por NFT e aplica `delta` na disponibilidade; emite um nft.updated por NFT. */
function adjustStock(lines: OrderLine[], direction: -1 | 1): void {
  const touched = new Set<string>()
  for (const line of lines) {
    const nft = findNft(line.nftId)
    const edition = nft && findEdition(nft, line.editionId)
    if (!nft || !edition) continue
    edition.available = Math.min(edition.supply, Math.max(0, edition.available + direction * line.quantity))
    touched.add(nft.id)
  }
  touched.forEach((id) => {
    const nft = findNft(id)
    if (nft) commitNftChange(nft)
  })
}

/** Reserva o estoque das linhas (pedido pendente). */
export function reserveStock(lines: OrderLine[]): void {
  adjustStock(lines, -1)
}

function txHashFor(order: Order): string {
  const seed = `tx:${db().epoch}:${order.id}`
  return order.network === 'solana' ? base58Address(seed, 88) : `0x${hashHex(seed, 64)}`
}

/** Resolve um pedido pendente. Snapshot de linhas/valores nunca é alterado. */
export function resolveOrder(orderId: string, status: 'confirmed' | 'declined'): Order {
  const record = findOrderRecord(orderId)
  if (!record) throw new MockHttpError('NOT_FOUND', 'Pedido não encontrado.')
  if (record.order.status !== 'pending') {
    throw new MockHttpError('CONFLICT', `O pedido já foi ${record.order.status === 'confirmed' ? 'confirmado' : 'recusado'}.`)
  }
  const timer = timers.get(orderId)
  if (timer) clearTimeout(timer)
  timers.delete(orderId)

  const order = record.order
  if (status === 'confirmed') {
    const txHash = txHashFor(order)
    order.status = 'confirmed'
    order.txHash = txHash
    order.explorerUrl = EXPLORER_TX_URL[order.network](txHash)
    order.failureReason = null
    // Venda efetivada: o estoque já reservado passa a definitivo; notificamos cada NFT afetado.
    new Set(order.lines.map((l) => l.nftId)).forEach((id) => {
      const nft = findNft(id)
      if (nft) commitNftChange(nft)
    })
    const cart = db().carts.find((c) => c.id === record.cartId)
    if (cart) subtractPurchased(cart, order.lines)
  } else {
    order.status = 'declined'
    order.failureReason = DECLINE_REASON
    adjustStock(order.lines, 1) // devolve o estoque reservado
  }
  order.version += 1
  order.updatedAt = nowIso()
  persist()
  emitToUser(order.userId, orderEvent(order))
  return order
}

export function scheduleResolution(record: DbOrder): void {
  const existing = timers.get(record.order.id)
  if (existing) clearTimeout(existing)
  const wait = Math.max(0, record.resolveAt - Date.now())
  // setTimeout (e não um relógio próprio) para que page.clock do Playwright controle a resolução.
  const timer = setTimeout(() => {
    timers.delete(record.order.id)
    const current = findOrderRecord(record.order.id)
    if (!current || current.order.status !== 'pending') return
    try {
      resolveOrder(current.order.id, current.plannedStatus)
    } catch (error) {
      console.error('[mocks] falha ao resolver pedido', error)
    }
  }, wait)
  timers.set(record.order.id, timer)
}

/** No boot: pedidos pendentes persistidos voltam a ser agendados. */
export function reschedulePendingOrders(): void {
  db()
    .orders.filter((o) => o.order.status === 'pending')
    .forEach(scheduleResolution)
}

export function clearOrderTimers(): void {
  timers.forEach((t) => clearTimeout(t))
  timers.clear()
}
