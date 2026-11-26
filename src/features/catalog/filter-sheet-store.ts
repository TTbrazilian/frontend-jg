import { useSyncExternalStore } from 'react'

/**
 * Estado do Sheet de filtros (abaixo de 1024px). Fica fora do React porque o botão que o abre
 * vive no header mobile (layout global) e o Sheet vive na página do catálogo.
 */
let open = false
const listeners = new Set<() => void>()

export const filterSheetStore = {
  get: () => open,
  set(next: boolean) {
    if (next === open) return
    open = next
    listeners.forEach((l) => l())
  },
  subscribe(l: () => void) {
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  },
}

export function useFilterSheetOpen(): [boolean, (open: boolean) => void] {
  const value = useSyncExternalStore(filterSheetStore.subscribe, filterSheetStore.get, filterSheetStore.get)
  return [value, filterSheetStore.set]
}
