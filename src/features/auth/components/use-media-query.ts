import { useCallback, useSyncExternalStore } from 'react'

/** Media query reativa (síncrona no primeiro render, sem "piscar" entre layouts). */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    [query],
  )
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => true,
  )
}

export const DESKTOP_QUERY = '(min-width: 768px)'
