import { toast } from 'sonner'

/**
 * Ações fora do escopo (Criadores, Aprenda, Atividade, Ofertas, Downloads, Suporte, login social,
 * "Esqueceu a senha?"…) nunca aparentam sucesso: informam que não estão disponíveis na demonstração.
 */
export function comingSoon(feature: string) {
  toast.info(`${feature} não está disponível nesta demonstração.`, { id: `soon-${feature}` })
}
