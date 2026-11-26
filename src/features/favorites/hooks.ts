import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/api/endpoints'
import type { FavoritesResponse } from '@/api/contracts'
import { qk } from '@/api/query-keys'
import { errorMessage } from '@/api/errors'
import { useScope } from '@/features/auth/use-scope'
import { announce } from '@/components/layout/live-region'

export function useFavorites() {
  const { scope, isAuthenticated } = useScope()
  return useQuery({
    queryKey: qk.favorites(scope),
    queryFn: ({ signal }) => api.favorites.list({ signal }),
    enabled: isAuthenticated,
    staleTime: 30_000,
  })
}

export function useIsFavorite(nftId: string): boolean {
  const { data } = useFavorites()
  return !!data?.nftIds.includes(nftId)
}

/**
 * Atualização OTIMISTA com rollback: o coração muda na hora; se a API falhar,
 * restauramos o snapshot e avisamos o usuário. Ao final, revalidamos com o servidor.
 */
export function useToggleFavorite() {
  const queryClient = useQueryClient()
  const { scope } = useScope()
  const key = qk.favorites(scope)

  return useMutation({
    mutationKey: ['favorite-toggle'],
    mutationFn: ({ nftId, favorite }: { nftId: string; favorite: boolean; title?: string }) =>
      favorite ? api.favorites.add(nftId) : api.favorites.remove(nftId),
    onMutate: async ({ nftId, favorite }) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<FavoritesResponse>(key)
      queryClient.setQueryData<FavoritesResponse>(key, (old) => {
        const base = old ?? { nftIds: [], items: [] }
        const ids = new Set(base.nftIds)
        if (favorite) ids.add(nftId)
        else ids.delete(nftId)
        return { nftIds: [...ids], items: favorite ? base.items : base.items.filter((i) => i.id !== nftId) }
      })
      return { previous }
    },
    onError: (error, { favorite, title }, context) => {
      queryClient.setQueryData(key, context?.previous)
      const msg = `Não foi possível ${favorite ? 'favoritar' : 'remover dos favoritos'}${title ? ` "${title}"` : ''}. ${errorMessage(error)}`
      toast.error(msg)
      announce(msg, 'assertive')
    },
    onSuccess: (_d, { favorite, title }) => {
      announce(favorite ? `${title ?? 'NFT'} adicionado aos favoritos.` : `${title ?? 'NFT'} removido dos favoritos.`)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  })
}
