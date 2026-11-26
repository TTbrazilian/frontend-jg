import { useCallback } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { EMPTY_CATALOG_SEARCH, toUrlSearch, withFilterChange, type CatalogSearch } from './search'

/** Rotas que exibem o catálogo (mesmo schema de busca). */
export type CatalogPath = '/' | '/mercado'

export interface CatalogNavigation {
  path: CatalogPath
  search: CatalogSearch
  /** Muda filtros: sempre reinicia a paginação (nova entrada no histórico). */
  setFilters: (patch: Partial<CatalogSearch>) => void
  /** Vai para uma página da listagem mantendo os filtros. */
  setPage: (page: number) => void
  /** Remove todos os filtros (mantém a busca textual se `keepQuery`). */
  clearFilters: (opts?: { keepQuery?: boolean }) => void
}

/**
 * A URL é a fonte da verdade do catálogo: filtros, aba, ordenação e página moram nela,
 * então refresh, voltar/avançar e links compartilhados restauram exatamente o mesmo estado.
 */
export function useCatalogNavigation(path: CatalogPath, search: CatalogSearch): CatalogNavigation {
  const navigate = useNavigate()

  const go = useCallback(
    (next: Partial<CatalogSearch>) => {
      // resetScroll: false — trocar filtro não deve "pular" a página para o topo.
      void navigate({ to: path, search: toUrlSearch(next), resetScroll: false })
    },
    [navigate, path],
  )

  const setFilters = useCallback((patch: Partial<CatalogSearch>) => go(withFilterChange(search, patch)), [go, search])
  const setPage = useCallback((page: number) => go({ ...search, page: page > 1 ? page : undefined }), [go, search])
  const clearFilters = useCallback(
    ({ keepQuery = false }: { keepQuery?: boolean } = {}) => go({ ...EMPTY_CATALOG_SEARCH, q: keepQuery ? search.q : undefined }),
    [go, search.q],
  )

  return { path, search, setFilters, setPage, clearFilters }
}
