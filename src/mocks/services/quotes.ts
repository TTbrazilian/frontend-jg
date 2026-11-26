import Big from 'big.js'
import type { NetworkId, Quote, QuoteIssue, QuoteLine } from '@/api/contracts'
import { NETWORK_FEES_ETH, QUOTE_TTL_MS } from '../config'
import { db, persist } from '../db/store'
import type { DbCart } from '../db/types'
import { canonicalJson, hashHex, randomId } from '../lib/hash'
import { appliedCoupon, cartIdFor, findCart, ownerKey, toCartItem, type CartOwner } from './cart'

const fmt = (b: Big): string => b.toFixed()

function issueFor(item: NonNullable<ReturnType<typeof toCartItem>>): QuoteIssue | null {
  const name = `"${item.title}" (${item.editionLabel})`
  switch (item.status) {
    case 'ok':
      return null
    case 'price_changed':
      return {
        itemId: item.id,
        type: 'price_changed',
        message: `O preço de ${name} mudou de ${item.acknowledgedPriceEth} para ${item.unitPriceEth} ETH.`,
        previousPriceEth: item.acknowledgedPriceEth,
        currentPriceEth: item.unitPriceEth,
      }
    case 'insufficient':
      return {
        itemId: item.id,
        type: 'insufficient',
        message: `Restam apenas ${item.available} unidade(s) de ${name}.`,
        available: item.available,
      }
    case 'sold_out':
      return { itemId: item.id, type: 'sold_out', message: `${name} esgotou.`, available: 0 }
    case 'unavailable':
      return { itemId: item.id, type: 'unavailable', message: `${name} não está mais disponível para venda.` }
  }
}

/**
 * Calcula a cotação no "servidor" com Big.js:
 * subtotal = Σ unit × qty; desconto = subtotal × % / 100 (18 casas, half-even);
 * taxa fixa por rede (0 se carrinho vazio); total = subtotal − desconto + taxa.
 */
export function computeQuote(cart: DbCart | undefined, owner: CartOwner, network: NetworkId): Quote {
  const items = (cart?.items ?? []).map(toCartItem).filter((i): i is NonNullable<typeof i> => i !== null)
  const lines: QuoteLine[] = items.map((item) => ({
    itemId: item.id,
    nftId: item.nftId,
    editionId: item.editionId,
    tokenId: item.tokenId,
    title: item.title,
    editionLabel: item.editionLabel,
    image: item.image,
    quantity: item.quantity,
    unitPriceEth: item.unitPriceEth,
    lineTotalEth: fmt(new Big(item.unitPriceEth).times(item.quantity)),
  }))
  const issues = items.map(issueFor).filter((i): i is QuoteIssue => i !== null)
  const coupon = appliedCoupon(cart)
  const subtotal = lines.reduce((sum, l) => sum.plus(l.lineTotalEth), new Big(0))
  const discount = coupon ? subtotal.times(coupon.percentOff).div(100).round(18, Big.roundHalfEven) : new Big(0)
  const fee = lines.length > 0 ? new Big(NETWORK_FEES_ETH[network]) : new Big(0)
  const total = subtotal.minus(discount).plus(fee)

  const fingerprint = hashHex(
    canonicalJson({
      cartId: cart?.id ?? cartIdFor(owner),
      lines: items.map((i) => [i.id, i.editionId, i.quantity, i.unitPriceEth, i.status]),
      coupon: coupon ? [coupon.code, coupon.percentOff] : null,
      network,
      fee: fmt(fee),
    }),
    24,
  )

  const now = Date.now()
  return {
    id: `quo_${randomId()}`,
    cartId: cart?.id ?? cartIdFor(owner),
    cartVersion: cart?.version ?? 0,
    network,
    lines,
    subtotalEth: fmt(subtotal),
    discountEth: fmt(discount),
    networkFeeEth: fmt(fee),
    totalEth: fmt(total),
    coupon,
    issues,
    purchasable: lines.length > 0 && issues.length === 0,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + QUOTE_TTL_MS).toISOString(),
    fingerprint,
  }
}

/** Calcula e guarda a cotação (expira em 5 min). Limpa cotações vencidas. */
export function createQuote(owner: CartOwner, network: NetworkId): Quote {
  const quote = computeQuote(findCart(owner), owner, network)
  const cutoff = Date.now() - QUOTE_TTL_MS
  db().quotes = db().quotes.filter((q) => Date.parse(q.quote.expiresAt) > cutoff).slice(-50)
  db().quotes.push({ quote, ownerKey: ownerKey(owner) })
  persist()
  return quote
}

export function findQuote(id: string) {
  return db().quotes.find((q) => q.quote.id === id)
}
