import Big from 'big.js'
import type { EditionStatus, Nft, NftEdition, NftSummary, NftUpdatedData, NftUpdatedEvent } from '@/api/contracts'
import { db, persist } from '../db/store'
import type { DbEdition, DbNft } from '../db/types'
import { MockHttpError } from '../lib/respond'
import { broadcastNftUpdated, envelope } from '../realtime'

export function editionStatus(edition: DbEdition): EditionStatus {
  if (edition.disabled) return 'unavailable'
  return edition.available <= 0 ? 'sold_out' : 'available'
}

export function toEdition(edition: DbEdition): NftEdition {
  return {
    id: edition.id,
    label: edition.label,
    priceEth: edition.priceEth,
    supply: edition.supply,
    available: Math.max(0, edition.available),
    maxPerOrder: edition.maxPerOrder,
    status: editionStatus(edition),
  }
}

function minPrice(editions: DbEdition[]): string {
  const purchasable = editions.filter((e) => editionStatus(e) === 'available')
  const enabled = editions.filter((e) => !e.disabled)
  const pool = purchasable.length ? purchasable : enabled.length ? enabled : editions
  return pool.reduce((min, e) => (new Big(e.priceEth).lt(min) ? new Big(e.priceEth) : min), new Big(pool[0]?.priceEth ?? '0')).toFixed()
}

export function nftAggregates(nft: DbNft): { minPriceEth: string; available: number; soldOut: boolean } {
  const available = nft.editions.filter((e) => !e.disabled).reduce((sum, e) => sum + Math.max(0, e.available), 0)
  return { minPriceEth: minPrice(nft.editions), available, soldOut: available === 0 }
}

export function favoritesCount(nft: DbNft): number {
  let count = nft.baseFavorites
  for (const ids of Object.values(db().favorites)) if (ids.includes(nft.id)) count += 1
  return count
}

export function toSummary(nft: DbNft): NftSummary {
  const agg = nftAggregates(nft)
  return {
    id: nft.id,
    tokenId: nft.tokenId,
    title: nft.title,
    creator: nft.creator,
    collection: nft.collection,
    category: nft.category,
    network: nft.network,
    image: nft.images[0],
    minPriceEth: agg.minPriceEth,
    compareAtPriceEth: nft.compareAtPriceEth && new Big(nft.compareAtPriceEth).gt(agg.minPriceEth) ? nft.compareAtPriceEth : null,
    badge: nft.badge,
    available: agg.available,
    soldOut: agg.soldOut,
    featured: nft.featured,
    trending: nft.trending,
    favoritesCount: favoritesCount(nft),
    rating: nft.rating,
    createdAt: nft.createdAt,
    version: nft.version,
  }
}

export function toNft(nft: DbNft): Nft {
    const { image: _image, ...summary } = toSummary(nft)
  return {
    ...summary,
    description: nft.description,
    longDescription: nft.longDescription,
    images: nft.images,
    editions: nft.editions.map(toEdition),
    attributes: nft.attributes,
    reviews: nft.reviews,
    contractAddress: nft.contractAddress,
    tokenStandard: nft.tokenStandard,
    royaltiesPercent: nft.royaltiesPercent,
  }
}

export function nftUpdatedData(nft: DbNft): NftUpdatedData {
  const agg = nftAggregates(nft)
  return {
    nftId: nft.id,
    minPriceEth: agg.minPriceEth,
    available: agg.available,
    soldOut: agg.soldOut,
    editions: nft.editions.map((e) => ({ id: e.id, priceEth: e.priceEth, available: Math.max(0, e.available), status: editionStatus(e) })),
  }
}

export function findNft(id: string): DbNft | undefined {
  return db().nfts.find((n) => n.id === id)
}

export function requireNft(id: string): DbNft {
  const nft = findNft(id)
  if (!nft) throw new MockHttpError('NOT_FOUND', 'NFT não encontrado.')
  return nft
}

export function findEdition(nft: DbNft, editionId: string): DbEdition | undefined {
  return nft.editions.find((e) => e.id === editionId)
}

/**
 * Registra uma mudança de preço/estoque: incrementa `version`, persiste e emite `nft.updated`
 * (a mesma mudança fica visível via REST e via Socket.IO).
 */
export function commitNftChange(nft: DbNft, { emit = true }: { emit?: boolean } = {}): NftUpdatedEvent {
  nft.version += 1
  persist()
  const event = envelope('nft.updated', { type: 'nft', id: nft.id }, nft.version, nftUpdatedData(nft))
  if (emit) broadcastNftUpdated(event)
  return event
}
