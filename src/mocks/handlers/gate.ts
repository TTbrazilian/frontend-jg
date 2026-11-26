import { delay, http, HttpResponse } from 'msw'
import { API_PATHNAME, api } from '../config'
import { apiError } from '../lib/respond'
import { computeDelay, scenario } from '../scenarios'

/**
 * Primeiro handler da cadeia para `/api/*` (exceto `/api/__mock/*`): aplica offline,
 * latência determinística e erros de cenário transversais. Quando não responde,
 * retorna `undefined` e o MSW segue para o handler específico da rota.
 */
export const gateHandler = http.all(api('/*'), async ({ request }) => {
  const url = new URL(request.url)
  if (url.pathname.startsWith(`${API_PATHNAME}/__mock`)) return undefined

  const sc = scenario()
  if (sc === 'offline') return HttpResponse.error()

  const ms = computeDelay(request.method, url)
  if (ms > 0) await delay(ms)

  const path = url.pathname.slice(API_PATHNAME.length)
  const method = request.method.toUpperCase()

  if (sc === 'unauthorized' && (path.startsWith('/me/') || path === '/orders' || path.startsWith('/orders/'))) {
    return apiError('FORBIDDEN', 'Você não tem permissão para acessar este recurso.')
  }
  if (sc === 'server-error' && method === 'GET' && (path === '/nfts' || /^\/nfts\/(?!featured$)[^/]+$/.test(path))) {
    return apiError('INTERNAL_ERROR', 'O servidor encontrou um erro temporário. Tente novamente.', { retryable: true })
  }
  if (sc === 'favorites-failure' && (method === 'PUT' || method === 'DELETE') && /^\/me\/favorites\/[^/]+$/.test(path)) {
    return apiError('INTERNAL_ERROR', 'Não foi possível atualizar seus favoritos.', { retryable: false })
  }
  return undefined
})
