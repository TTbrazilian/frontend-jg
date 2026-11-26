import Big from 'big.js'
import { http } from 'msw'
import {
  AVAILABILITY_FILTERS,
  CATALOG_TABS,
  CATEGORIES,
  NETWORKS,
  SORT_OPTIONS,
  type AvailabilityFilter,
  type CatalogFacets,
  type CatalogTab,
  type Category,
  type NetworkId,
  type NftListResponse,
  type NftSummary,
  type SortOption,
} from '@/api/contracts'
import { api, NEW_RELEASE_WINDOW_MS, SEED_REFERENCE_DATE } from '../config'
import { db } from '../db/store'
import { guard, json, param, validationError } from '../lib/respond'
import { ETH_RE, normalizeText } from '../lib/validation'
import { isScenario } from '../scenarios'
import { requireNft, toNft, toSummary } from '../services/catalog'

interface ListFilters {
  q: string
  tab: CatalogTab
  categories: Category[]
  networks: NetworkId[]
  minPrice: string | null
  maxPrice: string | null
  availability: AvailabilityFilter
  sort: SortOption
  page: number
  pageSize: number
}

const oneOf = <T extends string>(list: readonly T[], value: string): value is T => (list as readonly string[]).includes(value)

function parseCsv<T extends string>(raw: string | null, list: readonly T[], field: string, errors: Record<string, string>): T[] {
  if (!raw) return []
  const values = raw.split(',').map((v) => v.trim()).filter(Boolean)
  const invalid = values.filter((v) => !oneOf(list, v))
  if (invalid.length) errors[field] = `Valor(es) inválido(s): ${invalid.join(', ')}.`
  return values.filter((v): v is T => oneOf(list, v))
}

function parseIntParam(raw: string | null, fallback: number, min: number, max: number, field: string, errors: Record<string, string>): number {
  if (raw === null || raw === '') return fallback
  if (!/^\d+$/.test(raw) || Number(raw) < min || Number(raw) > max) {
    errors[field] = `Use um inteiro entre ${min} e ${max}.`
    return fallback
  }
  return Number(raw)
}

function parseFilters(url: URL): { filters: ListFilters; errors: Record<string, string> } {
  const p = url.searchParams
  const errors: Record<string, string> = {}
  const tab = p.get('tab') ?? 'all'
  const availability = p.get('availability') ?? 'all'
  const sort = p.get('sort') ?? 'recent'
  const minPrice = p.get('minPrice') || null
  const maxPrice = p.get('maxPrice') || null
  if (!oneOf(CATALOG_TABS, tab)) errors.tab = 'Aba inválida.'
  if (!oneOf(AVAILABILITY_FILTERS, availability)) errors.availability = 'Filtro de disponibilidade inválido.'
  if (!oneOf(SORT_OPTIONS, sort)) errors.sort = 'Ordenação inválida.'
  if (minPrice !== null && !ETH_RE.test(minPrice)) errors.minPrice = 'Preço mínimo inválido.'
  if (maxPrice !== null && !ETH_RE.test(maxPrice)) errors.maxPrice = 'Preço máximo inválido.'
  if (minPrice && maxPrice && !errors.minPrice && !errors.maxPrice && new Big(minPrice).gt(maxPrice)) {
    errors.maxPrice = 'O preço máximo deve ser maior ou igual ao mínimo.'
  }
  const filters: ListFilters = {
    q: (p.get('q') ?? '').trim(),
    tab: oneOf(CATALOG_TABS, tab) ? tab : 'all',
    categories: parseCsv(p.get('category'), CATEGORIES, 'category', errors),
    networks: parseCsv(p.get('network'), NETWORKS, 'network', errors),
    minPrice,
    maxPrice,
    availability: oneOf(AVAILABILITY_FILTERS, availability) ? availability : 'all',
    sort: oneOf(SORT_OPTIONS, sort) ? sort : 'recent',
    page: parseIntParam(p.get('page'), 1, 1, 10_000, 'page', errors),
    pageSize: parseIntParam(p.get('pageSize'), 12, 1, 48, 'pageSize', errors),
  }
  return { filters, errors }
}

/** Aplica os filtros; `ignore` deixa de fora um filtro (para as facetas). */
function applyFilters(items: NftSummary[], f: ListFilters, ignore: 'category' | 'network' | null = null): NftSummary[] {
  const q = normalizeText(f.q)
  const newSince = SEED_REFERENCE_DATE - NEW_RELEASE_WINDOW_MS
  return items.filter((n) => {
    if (q && ![n.title, n.creator.name, n.collection.name].some((text) => normalizeText(text).includes(q))) return false
    if (f.tab === 'new' && Date.parse(n.createdAt) < newSince) return false
    if (f.tab === 'trending' && !n.trending) return false
    if (ignore !== 'category' && f.categories.length && !f.categories.includes(n.category)) return false
    if (ignore !== 'network' && f.networks.length && !f.networks.includes(n.network)) return false
    if (f.minPrice && new Big(n.minPriceEth).lt(f.minPrice)) return false
    if (f.maxPrice && new Big(n.minPriceEth).gt(f.maxPrice)) return false
    if (f.availability === 'available' && n.soldOut) return false
    if (f.availability === 'sold_out' && !n.soldOut) return false
    return true
  })
}

function sortItems(items: NftSummary[], sort: SortOption): NftSummary[] {
  const byId = (a: NftSummary, b: NftSummary) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  return [...items].sort((a, b) => {
    let diff: number
    if (sort === 'recent') diff = Date.parse(b.createdAt) - Date.parse(a.createdAt)
    else if (sort === 'price_asc') diff = new Big(a.minPriceEth).cmp(b.minPriceEth)
    else if (sort === 'price_desc') diff = new Big(b.minPriceEth).cmp(a.minPriceEth)
    else diff = b.favoritesCount - a.favoritesCount
    return diff !== 0 ? diff : byId(a, b)
  })
}

function buildFacets(all: NftSummary[], f: ListFilters): CatalogFacets {
  const categories = Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<Category, number>
  const networks = Object.fromEntries(NETWORKS.map((n) => [n, 0])) as Record<NetworkId, number>
  applyFilters(all, f, 'category').forEach((n) => (categories[n.category] += 1))
  applyFilters(all, f, 'network').forEach((n) => (networks[n.network] += 1))
  let min: Big | null = null
  let max: Big | null = null
  for (const n of all) {
    const price = new Big(n.minPriceEth)
    if (!min || price.lt(min)) min = price
    if (!max || price.gt(max)) max = price
  }
  return { categories, networks, priceRange: { minEth: (min ?? new Big(0)).toFixed(), maxEth: (max ?? new Big(0)).toFixed() } }
}

const catalog = (): NftSummary[] => (isScenario('empty-catalog') ? [] : db().nfts.map(toSummary))

export const nftHandlers = [
  http.get(api('/nfts'), ({ request }) =>
    guard(() => {
      const { filters, errors } = parseFilters(new URL(request.url))
      if (Object.keys(errors).length) return validationError(errors, 'Parâmetros de busca inválidos.')
      const all = catalog()
      const filtered = sortItems(applyFilters(all, filters), filters.sort)
      const start = (filters.page - 1) * filters.pageSize
      const body: NftListResponse = {
        items: filtered.slice(start, start + filters.pageSize),
        page: filters.page,
        pageSize: filters.pageSize,
        total: filtered.length,
        totalPages: Math.max(1, Math.ceil(filtered.length / filters.pageSize)),
        facets: buildFacets(all, filters),
      }
      return json(body)
    }),
  ),

  http.get(api('/nfts/featured'), () =>
    guard(() => {
      const items = catalog()
        .filter((n) => n.featured)
        .sort((a, b) => b.favoritesCount - a.favoritesCount || (a.id < b.id ? -1 : 1))
        .slice(0, 6)
      return json({ items })
    }),
  ),

  http.get(api('/nfts/:id/related'), ({ params }) =>
    guard(() => {
      const nft = requireNft(param(params, 'id'))
      const items = isScenario('empty-catalog')
        ? []
        : sortItems(
            db()
              .nfts.filter((n) => n.id !== nft.id && (n.category === nft.category || n.collection.id === nft.collection.id))
              .map(toSummary),
            'popular',
          ).slice(0, 8)
      return json({ items })
    }),
  ),

  http.get(api('/nfts/:id'), ({ params }) => guard(() => json(toNft(requireNft(param(params, 'id')))))),
]
