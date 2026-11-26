import { http } from 'msw'
import { api } from '../config'
import { db, nowIso } from '../db/store'
import type { DbCart, DbEdition } from '../db/types'
import { randomId } from '../lib/hash'
import { apiError, guard, json, MockHttpError, param, readBody, validationError } from '../lib/respond'
import { isPositiveInt, str } from '../lib/validation'
import { requireUser } from '../services/auth'
import {
  cartIdFor,
  findCart,
  findCoupon,
  getOrCreateCart,
  isCouponExpired,
  resolveCartOwner,
  toCart,
  touchCart,
  type CartOwner,
} from '../services/cart'
import { editionStatus, findEdition, findNft } from '../services/catalog'

const respondCart = (cart: DbCart | undefined, owner: CartOwner) => json(toCart(cart, owner))

/** Valida a quantidade TOTAL desejada para uma edição (≥1, ≤ maxPerOrder, ≤ disponível). */
function assertQuantity(edition: DbEdition, title: string, quantity: number): void {
  const status = editionStatus(edition)
  if (status === 'unavailable') {
    throw new MockHttpError('AVAILABILITY_CONFLICT', `A edição ${edition.label} de "${title}" não está disponível para venda.`)
  }
  if (status === 'sold_out') throw new MockHttpError('AVAILABILITY_CONFLICT', `A edição ${edition.label} de "${title}" está esgotada.`)
  if (quantity > edition.maxPerOrder) {
    throw new MockHttpError('VALIDATION_ERROR', `Limite de ${edition.maxPerOrder} unidade(s) por pedido para esta edição.`, {
      fieldErrors: { quantity: `Máximo de ${edition.maxPerOrder} por pedido.` },
    })
  }
  if (quantity > edition.available) {
    throw new MockHttpError(
      'AVAILABILITY_CONFLICT',
      `Restam apenas ${edition.available} unidade(s) da edição ${edition.label} de "${title}".`,
      { details: { available: edition.available } },
    )
  }
}

function lookup(nftId: string, editionId: string) {
  const nft = findNft(nftId)
  if (!nft) throw new MockHttpError('NOT_FOUND', 'NFT não encontrado.')
  const edition = findEdition(nft, editionId)
  if (!edition) throw new MockHttpError('NOT_FOUND', 'Edição não encontrada.')
  return { nft, edition }
}

export const cartHandlers = [
  http.get(api('/cart'), ({ request }) =>
    guard(() => {
      const owner = resolveCartOwner(request)
      return respondCart(findCart(owner), owner)
    }),
  ),

  http.post(api('/cart/items'), ({ request }) =>
    guard(async () => {
      const owner = resolveCartOwner(request)
      const body = await readBody(request)
      const nftId = str(body, 'nftId')
      const editionId = str(body, 'editionId')
      const fieldErrors: Record<string, string> = {}
      if (!nftId) fieldErrors.nftId = 'Obrigatório.'
      if (!editionId) fieldErrors.editionId = 'Selecione uma edição.'
      if (!isPositiveInt(body.quantity)) fieldErrors.quantity = 'A quantidade deve ser um inteiro maior ou igual a 1.'
      if (Object.keys(fieldErrors).length) return validationError(fieldErrors)

      const { nft, edition } = lookup(nftId as string, editionId as string)
      const quantity = body.quantity as number
      const cart = findCart(owner)
      const existing = cart?.items.find((i) => i.editionId === edition.id)
      assertQuantity(edition, nft.title, (existing?.quantity ?? 0) + quantity)

      const target = cart ?? getOrCreateCart(owner)
      if (existing) {
        existing.quantity += quantity
        existing.acknowledgedPriceEth = edition.priceEth // o usuário acabou de ver o preço atual
      } else {
        target.items.push({
          id: `itm_${randomId()}`,
          nftId: nft.id,
          editionId: edition.id,
          quantity,
          acknowledgedPriceEth: edition.priceEth,
          addedAt: nowIso(),
        })
      }
      touchCart(target)
      return respondCart(target, owner)
    }),
  ),

  http.patch(api('/cart/items/:itemId'), ({ request, params }) =>
    guard(async () => {
      const owner = resolveCartOwner(request)
      const cart = findCart(owner)
      const item = cart?.items.find((i) => i.id === param(params, 'itemId'))
      if (!cart || !item) return apiError('NOT_FOUND', 'Item não encontrado no carrinho.')
      const body = await readBody(request)
      if (!isPositiveInt(body.quantity)) return validationError({ quantity: 'A quantidade deve ser um inteiro maior ou igual a 1.' })
      const { nft, edition } = lookup(item.nftId, item.editionId)
      assertQuantity(edition, nft.title, body.quantity)
      item.quantity = body.quantity
      touchCart(cart)
      return respondCart(cart, owner)
    }),
  ),

  http.delete(api('/cart/items/:itemId'), ({ request, params }) =>
    guard(() => {
      const owner = resolveCartOwner(request)
      const cart = findCart(owner)
      const index = cart?.items.findIndex((i) => i.id === param(params, 'itemId')) ?? -1
      if (!cart || index < 0) return apiError('NOT_FOUND', 'Item não encontrado no carrinho.')
      cart.items.splice(index, 1)
      touchCart(cart)
      return respondCart(cart, owner)
    }),
  ),

  http.put(api('/cart/coupon'), ({ request }) =>
    guard(async () => {
      const owner = resolveCartOwner(request)
      const body = await readBody(request)
      const code = (str(body, 'code') ?? '').trim()
      if (!code) return validationError({ code: 'Informe um cupom.' })
      const coupon = findCoupon(code)
      if (!coupon) return apiError('COUPON_INVALID', 'Cupom inválido.', { fieldErrors: { code: 'Cupom inválido.' } })
      if (isCouponExpired(coupon)) return apiError('COUPON_EXPIRED', 'Este cupom expirou.', { fieldErrors: { code: 'Este cupom expirou.' } })
      const cart = getOrCreateCart(owner)
      cart.couponCode = coupon.code
      touchCart(cart)
      return respondCart(cart, owner)
    }),
  ),

  http.delete(api('/cart/coupon'), ({ request }) =>
    guard(() => {
      const owner = resolveCartOwner(request)
      const cart = findCart(owner)
      if (cart && cart.couponCode) {
        cart.couponCode = null
        touchCart(cart)
      }
      return respondCart(cart, owner)
    }),
  ),

  /** Aceita a situação atual: preços reconhecidos, quantidades ajustadas ao disponível, esgotados removidos. */
  http.post(api('/cart/acknowledge'), ({ request }) =>
    guard(() => {
      const owner = resolveCartOwner(request)
      const cart = findCart(owner)
      if (!cart) return respondCart(cart, owner)
      cart.items = cart.items.filter((item) => {
        const nft = findNft(item.nftId)
        const edition = nft && findEdition(nft, item.editionId)
        if (!edition || editionStatus(edition) !== 'available') return false
        item.quantity = Math.min(item.quantity, edition.available, edition.maxPerOrder)
        item.acknowledgedPriceEth = edition.priceEth
        return item.quantity > 0
      })
      touchCart(cart)
      return respondCart(cart, owner)
    }),
  ),

  /** Move o carrinho de visitante para o do usuário (soma limitada por disponibilidade/maxPerOrder). */
  http.post(api('/cart/merge'), ({ request }) =>
    guard(async () => {
      const { user } = requireUser(request)
      const body = await readBody(request)
      const guestCartId = (str(body, 'guestCartId') ?? '').trim()
      if (!guestCartId) return validationError({ guestCartId: 'Obrigatório.' })
      const owner: CartOwner = { type: 'user', id: user.id }
      const guestCart = db().carts.find((c) => c.id === cartIdFor({ type: 'guest', id: guestCartId }))
      if (!guestCart || (guestCart.items.length === 0 && !guestCart.couponCode)) return respondCart(findCart(owner), owner)

      const cart = getOrCreateCart(owner)
      for (const guestItem of guestCart.items) {
        const nft = findNft(guestItem.nftId)
        const edition = nft && findEdition(nft, guestItem.editionId)
        if (!edition || editionStatus(edition) !== 'available') continue
        const cap = Math.min(edition.available, edition.maxPerOrder)
        const existing = cart.items.find((i) => i.editionId === guestItem.editionId)
        if (existing) {
          existing.quantity = Math.max(existing.quantity, Math.min(existing.quantity + guestItem.quantity, cap))
        } else {
          const quantity = Math.min(guestItem.quantity, cap)
          if (quantity > 0) cart.items.push({ ...guestItem, id: `itm_${randomId()}`, quantity })
        }
      }
      if (!cart.couponCode && guestCart.couponCode) cart.couponCode = guestCart.couponCode
      guestCart.items = []
      guestCart.couponCode = null
      touchCart(guestCart)
      touchCart(cart)
      return respondCart(cart, owner)
    }),
  ),
]
