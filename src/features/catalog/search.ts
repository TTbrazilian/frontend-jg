import { z } from 'zod'
import { AVAILABILITY_FILTERS, CATALOG_TABS, CATEGORIES, NETWORKS, SORT_OPTIONS, type NftListParams } from '@/api/contracts'
import { isValidEthInput } from '@/lib/money'

export const PAGE_SIZE = 9

const csvOf = <T extends string>(values: readonly T[]) =>
  z
    .union([z.array(z.string()), z.string()])
    .optional()
    .transform((v) => {
      const arr = Array.isArray(v) ? v : typeof v === 'string' ? v.split(',') : []
      const valid = arr.filter((x): x is T => (values as readonly string[]).includes(x))
      return valid.length ? [...new Set(valid)].sort() : undefined
    })

const ethParam = z
  .union([z.string(), z.number()])
  .optional()
  .transform((v) => {
    if (v === undefined) return undefined
    const s = String(v)
    return isValidEthInput(s) ? s : undefined
  })

/**
 * Estado do catálogo na URL (fonte da verdade). Valores inválidos são descartados,
 * então links manipulados ou antigos nunca quebram a página.
 */
export const catalogSearchSchema = z.object({
  // O parser de busca do router converte "123" em número: aceita e volta para texto.
  q: z
    .union([z.string(), z.number()])
    .optional()
    .catch(undefined)
    .transform((v) => (v === undefined ? undefined : String(v).trim().slice(0, 80) || undefined)),
  tab: z.enum(CATALOG_TABS).optional().catch(undefined),
  category: csvOf(CATEGORIES).catch(undefined),
  network: csvOf(NETWORKS).catch(undefined),
  minPrice: ethParam.catch(undefined),
  maxPrice: ethParam.catch(undefined),
  availability: z.enum(AVAILABILITY_FILTERS).optional().catch(undefined),
  sort: z.enum(SORT_OPTIONS).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(999).optional().catch(undefined),
})

export type CatalogSearch = z.output<typeof catalogSearchSchema>

export function toListParams(search: CatalogSearch): NftListParams {
  return {
    q: search.q,
    tab: search.tab ?? 'all',
    category: search.category,
    network: search.network,
    minPrice: search.minPrice,
    maxPrice: search.maxPrice,
    availability: search.availability ?? 'all',
    sort: search.sort ?? 'recent',
    page: search.page ?? 1,
    pageSize: PAGE_SIZE,
  }
}

/** Estado vazio (todas as chaves presentes, como no tipo de saída do schema). */
export const EMPTY_CATALOG_SEARCH: CatalogSearch = {
  q: undefined,
  tab: undefined,
  category: undefined,
  network: undefined,
  minPrice: undefined,
  maxPrice: undefined,
  availability: undefined,
  sort: undefined,
  page: undefined,
}

/** Qualquer mudança de filtro reinicia a paginação. */
export function withFilterChange(prev: Partial<CatalogSearch>, patch: Partial<CatalogSearch>): CatalogSearch {
  return { ...EMPTY_CATALOG_SEARCH, ...prev, ...patch, page: undefined }
}

/** Forma da busca na URL: listas viram CSV (`category=arte,foto`) e valores vazios somem. */
export interface CatalogUrlSearch {
  q?: string
  tab?: CatalogSearch['tab']
  category?: string
  network?: string
  minPrice?: string
  maxPrice?: string
  availability?: CatalogSearch['availability']
  sort?: CatalogSearch['sort']
  page?: number
}

export function toUrlSearch(search: Partial<CatalogSearch>): CatalogUrlSearch {
  const out: CatalogUrlSearch = {}
  if (search.q) out.q = search.q
  if (search.tab && search.tab !== 'all') out.tab = search.tab
  if (search.category?.length) out.category = [...search.category].sort().join(',')
  if (search.network?.length) out.network = [...search.network].sort().join(',')
  if (search.minPrice) out.minPrice = search.minPrice
  if (search.maxPrice) out.maxPrice = search.maxPrice
  if (search.availability && search.availability !== 'all') out.availability = search.availability
  if (search.sort && search.sort !== 'recent') out.sort = search.sort
  if (search.page && search.page > 1) out.page = search.page
  return out
}

/** Há algum filtro ativo (além da paginação)? */
export function hasActiveFilters(search: Partial<CatalogSearch>): boolean {
  return !!(
    search.q ||
    (search.tab && search.tab !== 'all') ||
    search.category?.length ||
    search.network?.length ||
    search.minPrice ||
    search.maxPrice ||
    (search.availability && search.availability !== 'all') ||
    (search.sort && search.sort !== 'recent')
  )
}

/** Chave estável dos filtros (sem a página), usada para anunciar o total após mudanças. */
export function filtersKey(search: Partial<CatalogSearch>): string {
  const { page: _page, ...rest } = toUrlSearch(search)
  return JSON.stringify(rest)
}
