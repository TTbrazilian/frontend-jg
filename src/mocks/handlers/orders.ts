import Big from 'big.js'
import { delay, http } from 'msw'
import type { CollectorInfo, Order, OrdersResponse } from '@/api/contracts'
import { api, ORDER_TIMEOUT_DELAY_MS } from '../config'
import { db, nowIso, persist } from '../db/store'
import type { DbOrder } from '../db/types'
import { canonicalJson, hashHex, randomId } from '../lib/hash'
import { apiError, guard, json, MockHttpError, param, readBody, validationError } from '../lib/respond'
import {
  isNetwork,
  isRecord,
  isWalletProvider,
  normalizeEmail,
  str,
  validateAddress,
  validateEmail,
  validateEnsName,
  validateLength,
  validateReferralCode,
  validateUsername,
} from '../lib/validation'
import { checkoutTriggerArmed, getMockState, isScenario, markCheckoutTriggered } from '../scenarios'
import { requireUser } from '../services/auth'
import { findCart, ownerKey, toCartItem, type CartOwner } from '../services/cart'
import { commitNftChange, findEdition, findNft } from '../services/catalog'
import { findOrderRecord, reserveStock, scheduleResolution } from '../services/orders'
import { computeQuote, createQuote, findQuote } from '../services/quotes'

interface ParsedOrderBody {
  quoteId: string
  quoteFingerprint: string
  walletId: string
  network: CollectorInfo['network']
  collector: CollectorInfo
}

/** Valida o corpo; chaves de erro do colecionador são prefixadas com `collector.`. */
function parseOrderBody(body: Record<string, unknown>): { value: ParsedOrderBody | null; fieldErrors: Record<string, string> } {
  const fieldErrors: Record<string, string> = {}
  const quoteId = str(body, 'quoteId')
  const quoteFingerprint = str(body, 'quoteFingerprint')
  const walletId = str(body, 'walletId')
  if (!quoteId) fieldErrors.quoteId = 'Obrigatório.'
  if (!quoteFingerprint) fieldErrors.quoteFingerprint = 'Obrigatório.'
  if (!walletId) fieldErrors.walletId = 'Selecione uma carteira.'
  const network = body.network
  if (!isNetwork(network)) fieldErrors.network = 'Selecione uma rede válida.'

  const c = isRecord(body.collector) ? body.collector : {}
  const set = (key: string, error: string | null) => {
    if (error) fieldErrors[`collector.${key}`] = error
  }
  set('displayName', validateLength(str(c, 'displayName'), 2, 40, 'O nome de exibição'))
  set('username', validateUsername(str(c, 'username')))
  set('profileName', validateLength(str(c, 'profileName'), 2, 40, 'O nome do perfil'))
  set('email', validateEmail(str(c, 'email')))
  set('referralCode', validateReferralCode(str(c, 'referralCode')))
  set('ensName', validateEnsName(str(c, 'ensName')))
  if (!isWalletProvider(c.walletType)) set('walletType', 'Selecione o tipo de carteira.')
  if (!isNetwork(c.network)) set('network', 'Selecione uma rede válida.')
  else if (isNetwork(network) && c.network !== network) set('network', 'A rede do perfil deve ser a mesma do pedido.')
  if (isNetwork(network)) set('walletAddress', validateAddress(str(c, 'walletAddress'), network))
  const ensOrSecondary = c.ensOrSecondary
  if (ensOrSecondary !== null && ensOrSecondary !== undefined && (typeof ensOrSecondary !== 'string' || ensOrSecondary.length > 64)) {
    set('ensOrSecondary', 'Use até 64 caracteres.')
  }
  const note = c.note
  if (note !== null && note !== undefined && (typeof note !== 'string' || note.length > 500)) set('note', 'Use até 500 caracteres.')

  if (Object.keys(fieldErrors).length) return { value: null, fieldErrors }
  const optional = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
  return {
    fieldErrors,
    value: {
      quoteId: quoteId as string,
      quoteFingerprint: quoteFingerprint as string,
      walletId: walletId as string,
      network: network as CollectorInfo['network'],
      collector: {
        displayName: (str(c, 'displayName') as string).trim(),
        username: str(c, 'username') as string,
        network: c.network as CollectorInfo['network'],
        profileName: (str(c, 'profileName') as string).trim(),
        walletAddress: (str(c, 'walletAddress') as string).trim(),
        ensOrSecondary: optional(ensOrSecondary),
        walletType: c.walletType as CollectorInfo['walletType'],
        referralCode: (str(c, 'referralCode') as string).trim().toUpperCase(),
        email: normalizeEmail(str(c, 'email') as string),
        ensName: str(c, 'ensName') as string,
        useOtherWallet: c.useOtherWallet === true,
        note: optional(note),
      },
    },
  }
}

/**
 * Cenários price-change/sold-out-on-checkout: na primeira tentativa de pedido do carrinho
 * (enquanto o cenário está ativo), muda o 1º item, emite nft.updated e responde 409 com a nova cotação.
 */
function checkoutScenarioResponse(owner: CartOwner, cartId: string, network: ParsedOrderBody['network']): Response | null {
  const priceChange = isScenario('price-change-on-checkout')
  const soldOut = isScenario('sold-out-on-checkout')
  if ((!priceChange && !soldOut) || !checkoutTriggerArmed(cartId)) return null
  const cart = findCart(owner)
  const items = (cart?.items ?? []).map(toCartItem).filter((i) => i !== null)
  const target = items.find((i) => i.status === 'ok') ?? items[0]
  if (!target) return null
  const nft = findNft(target.nftId)
  const edition = nft && findEdition(nft, target.editionId)
  if (!nft || !edition) return null
  markCheckoutTriggered(cartId)
  if (priceChange) edition.priceEth = new Big(edition.priceEth).times('1.1').round(6, Big.roundHalfEven).toFixed()
  else edition.available = 0
  commitNftChange(nft)
  const quote = createQuote(owner, network)
  return priceChange
    ? apiError('QUOTE_STALE', `O preço de "${nft.title}" mudou. Revise a nova cotação antes de confirmar.`, { details: { quote } })
    : apiError('AVAILABILITY_CONFLICT', `"${nft.title}" (${edition.label}) acabou de esgotar.`, { details: { quote } })
}

function sortOrders(orders: Order[]): Order[] {
  return [...orders].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || (a.id < b.id ? 1 : -1))
}

export const orderHandlers = [
  http.post(api('/orders'), ({ request }) =>
    guard(async () => {
      const { user } = requireUser(request)
      const key = request.headers.get('Idempotency-Key')?.trim() ?? ''
      if (key.length < 8 || key.length > 128) {
        return validationError({ idempotencyKey: 'Cabeçalho Idempotency-Key obrigatório (8 a 128 caracteres).' }, 'Cabeçalho Idempotency-Key ausente ou inválido.')
      }
      const body = await readBody(request)
      const bodyHash = hashHex(canonicalJson(body), 24)

      // Idempotência: mesma chave + mesmo corpo → mesmo pedido (200); corpo diferente → 409.
      const prior = db().idempotency.find((r) => r.userId === user.id && r.key === key)
      if (prior) {
        if (prior.bodyHash !== bodyHash) {
          return apiError('IDEMPOTENCY_CONFLICT', 'Esta chave de idempotência já foi usada com outro conteúdo.')
        }
        const existing = findOrderRecord(prior.orderId)
        if (existing) return json(existing.order, 200)
      }

      const { value, fieldErrors } = parseOrderBody(body)
      if (!value) return validationError(fieldErrors)

      const wallet = db().wallets.find((w) => w.id === value.walletId && w.userId === user.id)
      if (!wallet) return validationError({ walletId: 'Carteira não encontrada na sua conta.' })
      if (!value.collector.useOtherWallet && wallet.network !== value.network) {
        return validationError({ network: `A carteira "${wallet.nickname}" opera na rede ${wallet.network}.` })
      }

      const owner: CartOwner = { type: 'user', id: user.id }
      const cart = findCart(owner)
      if (!cart || cart.items.length === 0) return validationError({}, 'Seu carrinho está vazio.')

      const scenarioResponse = checkoutScenarioResponse(owner, cart.id, value.network)
      if (scenarioResponse) return scenarioResponse

      // Revalidação da cotação: existe, não expirou, é deste carrinho/rede e nada mudou desde então.
      const stored = findQuote(value.quoteId)
      const current = computeQuote(cart, owner, value.network)
      const stale =
        !stored ||
        stored.ownerKey !== ownerKey(owner) ||
        stored.quote.cartId !== cart.id ||
        stored.quote.network !== value.network ||
        Date.parse(stored.quote.expiresAt) <= Date.now() ||
        stored.quote.fingerprint !== value.quoteFingerprint ||
        current.fingerprint !== stored.quote.fingerprint ||
        !current.purchasable
      if (stale || !stored) {
        const fresh = createQuote(owner, value.network)
        const availabilityProblem = fresh.issues.some((i) => i.type !== 'price_changed')
        return availabilityProblem
          ? apiError('AVAILABILITY_CONFLICT', 'Alguns itens não têm mais estoque suficiente. Revise o carrinho.', { details: { quote: fresh } })
          : apiError('QUOTE_STALE', 'A cotação mudou. Revise os novos valores antes de confirmar.', { details: { quote: fresh } })
      }

      // Checagem final de estoque (defensiva; a cotação já refletiria a falta).
      for (const line of stored.quote.lines) {
        const nft = findNft(line.nftId)
        const edition = nft && findEdition(nft, line.editionId)
        if (!edition || edition.available < line.quantity) {
          throw new MockHttpError('AVAILABILITY_CONFLICT', `Estoque insuficiente para "${line.title}".`, {
            details: { quote: createQuote(owner, value.network) },
          })
        }
      }

      const now = nowIso()
      const q = stored.quote
      const order: Order = {
        id: `ord_${randomId()}`,
        userId: user.id,
        status: 'pending',
        // Snapshot imutável da cotação aprovada.
        lines: q.lines.map((l) => ({ ...l, image: { ...l.image } })),
        subtotalEth: q.subtotalEth,
        discountEth: q.discountEth,
        networkFeeEth: q.networkFeeEth,
        totalEth: q.totalEth,
        coupon: q.coupon ? { ...q.coupon } : null,
        network: value.network,
        wallet: value.collector.useOtherWallet
          ? {
              id: wallet.id,
              nickname: 'Outra carteira',
              address: value.collector.walletAddress,
              provider: value.collector.walletType,
              network: value.network,
            }
          : { id: wallet.id, nickname: wallet.nickname, address: wallet.address, provider: wallet.provider, network: wallet.network },
        collector: value.collector,
        txHash: null,
        explorerUrl: null,
        failureReason: null,
        createdAt: now,
        updatedAt: now,
        version: 1,
      }
      const record: DbOrder = {
        order,
        plannedStatus: isScenario('payment-declined') ? 'declined' : 'confirmed',
        resolveAt: Date.now() + getMockState().orderResolutionMs,
        cartId: cart.id,
      }
      db().orders.push(record)
      db().idempotency.push({ key, userId: user.id, bodyHash, orderId: order.id, createdAt: now })
      persist()
      reserveStock(order.lines)
      scheduleResolution(record)

      // order-timeout: o pedido JÁ existe; a resposta demora mais que o timeout do cliente (6s).
      if (isScenario('order-timeout')) await delay(ORDER_TIMEOUT_DELAY_MS)
      const latest = findOrderRecord(order.id)?.order ?? order
      return json(latest, 201)
    }),
  ),

  http.get(api('/orders'), ({ request }) =>
    guard(() => {
      const { user } = requireUser(request)
      const body: OrdersResponse = { items: sortOrders(db().orders.filter((o) => o.order.userId === user.id).map((o) => o.order)) }
      return json(body)
    }),
  ),

  http.get(api('/orders/:id'), ({ request, params }) =>
    guard(() => {
      const { user } = requireUser(request)
      const record = findOrderRecord(param(params, 'id'))
      // 404 também para pedido de outro usuário (não vaza existência).
      if (!record || record.order.userId !== user.id) return apiError('NOT_FOUND', 'Pedido não encontrado.')
      return json(record.order)
    }),
  ),
]
