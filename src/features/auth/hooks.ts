import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { api } from '@/api/endpoints'
import type { LoginRequest, RegisterRequest, Session } from '@/api/contracts'
import { qk } from '@/api/query-keys'
import { ApiError } from '@/api/errors'
import { getGuestCartId, resetGuestCartId, sessionStore, useSession } from '@/app/session-store'
import { clearPrivateClientState } from './private-state'

/**
 * Após autenticar: troca a identidade, limpa caches privados de outra identidade
 * e mescla o carrinho do visitante no carrinho do usuário.
 */
async function completeSignIn(session: Session, queryClient: ReturnType<typeof useQueryClient>) {
  const previous = sessionStore.get()
  const switchingUser = previous.user && previous.user.id !== session.user.id
  if (switchingUser) clearPrivateClientState(queryClient, previous.user!.id)
  const guestCartId = getGuestCartId()
  sessionStore.signIn(session)
  try {
    await api.cart.merge({ guestCartId })
    resetGuestCartId()
  } catch {
    // Merge é best-effort: o carrinho do visitante continua no servidor e pode ser mesclado depois.
  }
  // Remove caches do visitante e recarrega os do usuário.
  queryClient.removeQueries({ queryKey: ['private'], predicate: (q) => String(q.queryKey[1]).startsWith('guest:') })
  await queryClient.invalidateQueries({ queryKey: ['private'] })
}

export function useLogin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: LoginRequest) => api.auth.login(body),
    onSuccess: (session) => completeSignIn(session, queryClient),
  })
}

export function useRegister() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: RegisterRequest) => api.auth.register(body),
    onSuccess: (session) => completeSignIn(session, queryClient),
  })
}

export function useLogout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      try {
        await api.auth.logout()
      } catch {
        // logout local mesmo se a rede falhar
      }
    },
    onSettled: () => {
      const userId = sessionStore.get().user?.id
      sessionStore.signOut()
      if (userId) clearPrivateClientState(queryClient, userId)
      queryClient.removeQueries({ queryKey: ['private'] })
    },
  })
}

/**
 * Revalida a sessão persistida no boot (e ao focar a janela). 401 → interceptor marca "expired".
 */
export function useSessionBootstrap() {
  const session = useSession()
  const query = useQuery({
    queryKey: [...qk.session(), session.user?.id ?? 'anon', session.epoch],
    queryFn: ({ signal }) => api.auth.session({ signal }),
    enabled: session.status === 'authenticated',
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    retry: (count, error) => error instanceof ApiError && error.retryable && count < 2,
  })
  useEffect(() => {
    if (query.data && query.data.user.id === sessionStore.get().user?.id) sessionStore.updateUser(query.data.user)
  }, [query.data])
  return query
}
