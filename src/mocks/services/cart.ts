import type { AppliedCoupon, Cart, CartItem, CartItemStatus } from '@/api/contracts'
import { db, nowIso, persist } from '../db/store'
import type { DbCart, DbCartItem, DbCoupon } from '../db/types'
import { hashHex } from '../lib/hash'
import { MockHttpError } from '../lib/respond'
import { resolveAuth } from './auth'
import { editionStatus, findEdition, findNft } from './catalog'

export interface CartOwner {
  type: 'guest' | 'user'
  id: string
}

export const ownerKey = (owner: CartOwner): string => `${owner.type}:${owner.id}`
export const cartIdFor = (owner: CartOwner): string => `cart_${hashHex(ownerKey(owner), 16)}`

const GUEST_ID_RE = /^[A-Za-z0-9_-]{8,128}$/

/**
 * Dono do carrinho: usuário (Bearer válido) ou visitante (`X-Guest-Cart-Id`).
 * Bearer presente mas inválido → 401 SESSION_EXPIRED (nunca cai no carrinho de visitante).
 */
export function resolveCartOwner(request: Request): CartOwner {
  const auth = resolveAuth(request)
  if (auth.kind === 'invalid') throw new MockHttpError('SESSION_EXPIRED', 'Sua sessão expirou. Entre novamente.')
  if (auth.kind === 'user') return { type: 'user', id: auth.user.id }
  const guestId = request.headers.get('X-Guest-Cart-Id')?.trim() ?? ''
  if (!GUEST_ID_RE.test(guestId)) {
    throw new MockHttpError('VALIDATION_ERROR', 'Identificador de carrinho de visitante ausente ou inválido (X-Guest-Cart-Id).')
  }
  return { type: 'guest', id: guestId }
}

export function findCart(owner: CartOwner): DbCart | undefined {
  const id = cartIdFor(owner)
  return db().carts.find((c) => c.id === id)
}

export function getOrCreateCart(owner: CartOwner): DbCart {
  const existing = findCart(owner)
  if (existing) return existing
  const cart: DbCart = { id: cartIdFor(owner), owner: { ...owner }, items: [], couponCode: null, updatedAt: nowIso(), version: 0 }
  db().carts.push(cart)
  return cart
}

/** Toda mudança no carrinho incrementa `version`. */
export function touchCart(cart: DbCart): void {
  cart.version += 1
  cart.updatedAt = nowIso()
  persist()
}

export function findCoupon(code: string): DbCoupon | undefined {
  return db().coupons.find((c) => c.code === code.trim().toUpperCase())
}

export function isCouponExpired(coupon: DbCoupon): boolean {
  return coupon.expiresAt !== null && Date.parse(coupon.expiresAt) <= Date.now()
}

export function appliedCoupon(cart: DbCart | undefined): AppliedCoupon | null {
  if (!cart?.couponCode) return null
  const coupon = findCoupon(cart.couponCode)
  if (!coupon || isCouponExpired(coupon)) return null
  return { code: coupon.code, description: coupon.description, percentOff: coupon.percentOff }
}

export function itemStatus(item: DbCartItem): { status: CartItemStatus; unitPriceEth: string; available: number } | null {
  const nft = findNft(item.nftId)
  const edition = nft && findEdition(nft, item.editionId)
  if (!nft || !edition) return null
  const available = Math.max(0, edition.available)
  const st = editionStatus(edition)
  let status: CartItemStatus = 'ok'
  if (st === 'unavailable') status = 'unavailable'
  else if (available === 0) status = 'sold_out'
  else if (item.quantity > available) status = 'insufficient'
  else if (edition.priceEth !== item.acknowledgedPriceEth) status = 'price_changed'
  return { status, unitPriceEth: edition.priceEth, available }
}

export function toCartItem(item: DbCartItem): CartItem | null {
  const nft = findNft(item.nftId)
  const edition = nft && findEdition(nft, item.editionId)
  const computed = itemStatus(item)
  if (!nft || !edition || !computed) return null
  return {
    id: item.id,
    nftId: nft.id,
    editionId: edition.id,
    tokenId: nft.tokenId,
    title: nft.title,
    editionLabel: edition.label,
    image: nft.images[0],
    creatorName: nft.creator.name,
    quantity: item.quantity,
    unitPriceEth: computed.unitPriceEth,
    acknowledgedPriceEth: item.acknowledgedPriceEth,
    available: computed.available,
    maxPerOrder: edition.maxPerOrder,
    status: computed.status,
  }
}

export function toCart(cart: DbCart | undefined, owner: CartOwner): Cart {
  if (!cart) {
    return { id: cartIdFor(owner), owner: { ...owner }, items: [], itemCount: 0, coupon: null, updatedAt: nowIso(), version: 0 }
  }
  const items = cart.items.map(toCartItem).filter((i): i is CartItem => i !== null)
  return {
    id: cart.id,
    owner: { ...cart.owner },
    items,
    itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
    coupon: appliedCoupon(cart),
    updatedAt: cart.updatedAt,
    version: cart.version,
  }
}

/** Remove do carrinho do usuário apenas as quantidades compradas (por edição). */
export function subtractPurchased(cart: DbCart, purchased: Array<{ editionId: string; quantity: number }>): boolean {
  let changed = false
  for (const line of purchased) {
    const item = cart.items.find((i) => i.editionId === line.editionId)
    if (!item) continue
    item.quantity -= line.quantity
    changed = true
  }
  if (changed) {
    cart.items = cart.items.filter((i) => i.quantity > 0)
    touchCart(cart)
  }
  return changed
}
