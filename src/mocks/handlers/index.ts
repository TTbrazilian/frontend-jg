import { http } from 'msw'
import { api } from '../config'
import { apiError } from '../lib/respond'
import { createSocketHandler } from '../realtime'
import { authHandlers } from './auth'
import { cartHandlers } from './cart'
import { controlHandlers } from './control'
import { favoriteHandlers } from './favorites'
import { gateHandler } from './gate'
import { nftHandlers } from './nfts'
import { orderHandlers } from './orders'
import { profileHandlers } from './profile'
import { quoteHandlers } from './quotes'
import { walletHandlers } from './wallets'

/** Ordem importa: controle primeiro (imune a cenários), depois o "gate" (offline/latência/erros), depois as rotas. */
export function createHandlers() {
  return [
    ...controlHandlers,
    gateHandler,
    ...authHandlers,
    ...nftHandlers,
    ...favoriteHandlers,
    ...cartHandlers,
    ...quoteHandlers,
    ...orderHandlers,
    ...profileHandlers,
    ...walletHandlers,
    // Rota /api desconhecida: 404 no contrato de erro (nunca vaza para a rede real).
    http.all(api('/*'), ({ request }) => {
      console.warn(`[mocks] rota sem handler: ${request.method} ${new URL(request.url).pathname}`)
      return apiError('NOT_FOUND', 'Rota não encontrada.')
    }),
    createSocketHandler(),
  ]
}
