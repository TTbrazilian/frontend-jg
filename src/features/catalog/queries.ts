import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api } from '@/api/endpoints'
import { qk } from '@/api/query-keys'
import type { NftListParams } from '@/api/contracts'

/**
 * Listagem: a key inclui todos os parâmetros, então respostas de buscas antigas
 * nunca sobrescrevem a atual (fora de ordem). O AbortSignal cancela a requisição
 * obsoleta quando os parâmetros mudam. keepPreviousData evita "piscar" a grade.
 */
export function useNftList(params: NftListParams) {
  return useQuery({
    queryKey: qk.nfts.list(params),
    queryFn: ({ signal }) => api.nfts.list(params, { signal }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })
}

export function useFeaturedNfts() {
  return useQuery({
    queryKey: qk.nfts.featured(),
    queryFn: ({ signal }) => api.nfts.featured({ signal }),
    staleTime: 60_000,
  })
}

export function useNft(id: string) {
  return useQuery({
    queryKey: qk.nfts.detail(id),
    queryFn: ({ signal }) => api.nfts.detail(id, { signal }),
    staleTime: 15_000,
  })
}

export function useRelatedNfts(id: string) {
  return useQuery({
    queryKey: qk.nfts.related(id),
    queryFn: ({ signal }) => api.nfts.related(id, { signal }),
    staleTime: 60_000,
  })
}
