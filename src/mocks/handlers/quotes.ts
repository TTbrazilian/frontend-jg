import { http } from 'msw'
import { api } from '../config'
import { guard, json, readBody, validationError } from '../lib/respond'
import { isNetwork } from '../lib/validation'
import { resolveCartOwner } from '../services/cart'
import { createQuote } from '../services/quotes'

export const quoteHandlers = [
  // Funciona para visitante (resumo do carrinho) e para usuário (checkout).
  http.post(api('/quotes'), ({ request }) =>
    guard(async () => {
      const owner = resolveCartOwner(request)
      const body = await readBody(request)
      if (!isNetwork(body.network)) return validationError({ network: 'Selecione uma rede válida.' })
      return json(createQuote(owner, body.network))
    }),
  ),
]
