import { setupWorker } from 'msw/browser'
import { API_PATHNAME } from './config'
import { enableCrossTabSync, initDb } from './db/store'
import { createHandlers } from './handlers'
import { initScenario } from './scenarios'
import * as control from './services/control'
import { reschedulePendingOrders } from './services/orders'

/** Fachada de controle para testes/console: chama a mesma lógica dos endpoints `/api/__mock/*`. */
export const mockControl = {
  state: control.getState,
  setScenario: (scenario: Parameters<typeof control.setScenario>[0]) => control.setScenario(scenario),
  reset: control.reset,
  setLatency: control.setLatency,
  setOrderResolution: control.setOrderResolution,
  nftUpdate: control.nftUpdate,
  emitDuplicate: control.emitDuplicate,
  emitStale: control.emitStale,
  disconnectSockets: control.disconnectSockets,
  expireSessions: control.expireSessions,
  resolveOrder: control.resolveOrderManually,
}

export type MockControl = typeof mockControl

const IGNORED_PREFIXES = ['/@', '/node_modules/', '/src/', '/images/', '/fonts/', '/assets/']

export async function startMockLayer(): Promise<MockControl> {
  await initDb()
  enableCrossTabSync()
  const overrides = initScenario()
  if (overrides.latencyMs !== undefined) control.setLatency(overrides.latencyMs)
  if (overrides.scenario) control.setScenario(overrides.scenario, { fromBoot: true })

  const worker = setupWorker(...createHandlers())
  await worker.start({
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
    quiet: true,
    onUnhandledRequest(request, print) {
      const url = new URL(request.url)
      if (url.origin !== window.location.origin) return
      if (IGNORED_PREFIXES.some((p) => url.pathname.startsWith(p))) return
      // Só avisamos sobre chamadas à API sem handler; assets, fontes e arquivos do Vite são ignorados.
      if (url.pathname === API_PATHNAME || url.pathname.startsWith(`${API_PATHNAME}/`)) print.warning()
    },
  })

  // Pedidos pendentes persistidos continuam resolvendo após refresh.
  reschedulePendingOrders()
  return mockControl
}
