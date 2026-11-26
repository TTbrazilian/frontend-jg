import { useNavigate, useRouterState } from '@tanstack/react-router'
import { useSession } from '@/app/session-store'

/**
 * Executa a ação se houver sessão; caso contrário leva ao login com retorno
 * para a página atual (ex.: favoritar como visitante).
 */
export function useAuthGate() {
  const session = useSession()
  const navigate = useNavigate()
  const href = useRouterState({ select: (s) => s.location.href })
  return (action: () => void) => {
    if (session.status === 'authenticated') return action()
    void navigate({ to: '/login', search: { redirect: href } })
  }
}
