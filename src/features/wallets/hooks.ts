import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/endpoints'
import type { CreateWalletRequest, NetworkId, UpdateWalletRequest } from '@/api/contracts'
import { qk } from '@/api/query-keys'
import { useScope } from '@/features/auth/use-scope'

export function useWallets() {
  const { scope, isAuthenticated } = useScope()
  return useQuery({
    queryKey: qk.wallets(scope),
    queryFn: ({ signal }) => api.wallets.list({ signal }),
    enabled: isAuthenticated,
    staleTime: 30_000,
  })
}

export function useCreateWallet() {
  const queryClient = useQueryClient()
  const { scope } = useScope()
  return useMutation({
    mutationFn: (body: CreateWalletRequest) => api.wallets.create(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.wallets(scope) }),
  })
}

export function useUpdateWallet() {
  const queryClient = useQueryClient()
  const { scope } = useScope()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateWalletRequest }) => api.wallets.update(id, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.wallets(scope) }),
  })
}

/** Simulação de conexão com a extensão da carteira (aceite/recusa vêm da API mock). */
export function useConnectWallet() {
  return useMutation({ mutationFn: ({ id, network }: { id: string; network: NetworkId }) => api.wallets.connect(id, { network }) })
}

export function useDisconnectWallet() {
  return useMutation({ mutationFn: (id: string) => api.wallets.disconnect(id) })
}
