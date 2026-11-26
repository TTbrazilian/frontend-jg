import { useSyncExternalStore } from 'react'

/**
 * Media query reativa (SPA: avaliada de forma síncrona no primeiro render, sem "piscar").
 * Usada quando a variante desktop e mobile não podem coexistir no DOM
 * (ex.: controles com o mesmo data-testid ou filtros duplicados).
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {}
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : true),
    () => true,
  )
}

/** Breakpoints do layout (Tailwind: md = 768, lg = 1024). */
export const useIsDesktop = () => useMediaQuery('(min-width: 768px)')
export const useIsLarge = () => useMediaQuery('(min-width: 1024px)')

export function usePrefersReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)')
}
