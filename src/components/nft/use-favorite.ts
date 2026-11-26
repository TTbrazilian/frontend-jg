import { useAuthGate } from '@/features/auth/use-auth-gate'
import { useIsFavorite, useToggleFavorite } from '@/features/favorites/hooks'

/** Favoritar com portão de autenticação (visitante → login com retorno) e atualização otimista. */
export function useFavoriteToggle(nftId: string, title: string) {
  const isFavorite = useIsFavorite(nftId)
  const toggle = useToggleFavorite()
  const gate = useAuthGate()
  const onToggle = () => gate(() => toggle.mutate({ nftId, favorite: !isFavorite, title }))
  return { isFavorite, onToggle }
}
