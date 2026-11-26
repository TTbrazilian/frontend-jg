import { http } from 'msw'
import type { FavoritesResponse, NftSummary } from '@/api/contracts'
import { api } from '../config'
import { db, persist } from '../db/store'
import { guard, json, noContent, param } from '../lib/respond'
import { requireUser } from '../services/auth'
import { findNft, requireNft, toSummary } from '../services/catalog'

function favoritesOf(userId: string): string[] {
  const all = db().favorites
  if (!all[userId]) all[userId] = []
  return all[userId]
}

export const favoriteHandlers = [
  http.get(api('/me/favorites'), ({ request }) =>
    guard(() => {
      const { user } = requireUser(request)
      // Mais recentes primeiro.
      const nftIds = [...favoritesOf(user.id)].reverse().filter((id) => findNft(id))
      const items = nftIds.map((id) => findNft(id)).filter((n) => n !== undefined).map(toSummary) satisfies NftSummary[]
      const body: FavoritesResponse = { nftIds, items }
      return json(body)
    }),
  ),

  // Idempotentes: favoritar de novo / desfavoritar algo ausente → 204.
  http.put(api('/me/favorites/:nftId'), ({ request, params }) =>
    guard(() => {
      const { user } = requireUser(request)
      const nft = requireNft(param(params, 'nftId'))
      const list = favoritesOf(user.id)
      if (!list.includes(nft.id)) {
        list.push(nft.id)
        persist()
      }
      return noContent()
    }),
  ),

  http.delete(api('/me/favorites/:nftId'), ({ request, params }) =>
    guard(() => {
      const { user } = requireUser(request)
      const nft = requireNft(param(params, 'nftId'))
      const list = favoritesOf(user.id)
      const index = list.indexOf(nft.id)
      if (index >= 0) {
        list.splice(index, 1)
        persist()
      }
      return noContent()
    }),
  ),
]
