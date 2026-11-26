import type { MockControl } from './start'

declare global {
  interface Window {
    /** Controle da simulação (apenas com VITE_ENABLE_MOCKS=true). Mesma lógica de `/api/__mock/*`. */
    __mock?: MockControl
  }
}

/**
 * Liga a camada de mocks (MSW REST + Socket.IO) quando `VITE_ENABLE_MOCKS === 'true'`.
 * Funciona também no build de produção. O código do MSW é carregado sob demanda
 * (import dinâmico), então não pesa no bundle quando os mocks estão desligados.
 * Chame (e aguarde) antes de renderizar a aplicação.
 */
export async function enableMocking(): Promise<void> {
  if (import.meta.env.VITE_ENABLE_MOCKS !== 'true') return
  const { startMockLayer } = await import('./start')
  window.__mock = await startMockLayer()
}
