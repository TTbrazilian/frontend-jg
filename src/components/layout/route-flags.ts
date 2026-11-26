import { useRouterState } from '@tanstack/react-router'

/** Rotas do catálogo (mesmo schema de busca). */
export const CATALOG_PATHS = ['/', '/mercado'] as const

/**
 * Rotas que, no mobile, têm barra superior/inferior própria no Figma (voltar + título, CTA fixo):
 * nelas o layout global esconde a busca mobile, a tab bar e o rodapé (< 768px).
 */
const IMMERSIVE_MOBILE_PREFIXES = ['/nft', '/carrinho', '/pagamento', '/pedido', '/login', '/cadastro']

export function isCatalogPath(pathname: string): boolean {
  return (CATALOG_PATHS as readonly string[]).includes(pathname)
}

export function isImmersiveMobilePath(pathname: string): boolean {
  return IMMERSIVE_MOBILE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

export function usePathname(): string {
  return useRouterState({ select: (s) => s.location.pathname })
}

export function useCurrentHref(): string {
  return useRouterState({ select: (s) => s.location.href })
}
