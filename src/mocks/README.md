# Camada de mocks (MSW 2 + Socket.IO)

Ativada por `VITE_ENABLE_MOCKS=true` (também no build de produção). `enableMocking()` (em `browser.ts`) carrega `start.ts` por import dinâmico, inicializa o DB, aplica `?scenario=`/`?latency=` da URL, sobe o Service Worker (`/mockServiceWorker.js`), reagenda pedidos pendentes e expõe `window.__mock`.

## Arquitetura

```
browser.ts        enableMocking() + tipo de window.__mock
start.ts          boot: initDb → initScenario → setupWorker → reschedulePendingOrders
config.ts         base da API, chaves de storage, TTLs, taxas por rede, URLs de explorer
scenarios.ts      MockState persistido (nft-mock-scenario) + latência determinística
realtime.ts       ws.link + toSocketIo: conexões, session.ready, nft.updated, order.updated
db/seed.ts        seed determinístico (48 NFTs, 2 usuários, carteiras, cupons, favoritos)
db/store.ts       DB em memória + localStorage (nft-mock-db:v1), reset, sync entre abas
services/*        regras de domínio (auth, catálogo, carrinho, cotação, pedidos, controle)
handlers/*        rotas MSW (gate → auth, nfts, favorites, cart, quotes, orders, profile, wallets, control)
```

Ordem dos handlers: `/__mock/*` (sem latência, imunes a cenários) → `gate` (offline, latência e erros transversais; devolve `undefined` para seguir) → rotas → 404 `NOT_FOUND` para `/api/*` desconhecido.

Toda mutação de preço/estoque passa por `commitNftChange()`: incrementa `version`, persiste e emite `nft.updated`. Assim, REST e Socket.IO mostram a mesma mudança.

## Credenciais do seed

`ana@nft.dev` / `Password123!` (2 carteiras: Principal/MetaMask/ethereum e Reserva/Coinbase/polygon; 2 favoritos) e `bruno@nft.dev` / `Password123!` (1 carteira primary WalletConnect/ethereum). As senhas ficam como SHA-256(salt + ":" + senha), com um salt por usuário.

Cupons: `WELCOME10` (10%), `JUNGLE25` (25%), `EXPIRED20` (→ `COUPON_EXPIRED`); qualquer outro → `COUPON_INVALID`.

## Cenários (`MockScenario`)

| Cenário | Efeito |
|---|---|
| `default` | latência 150–450 ms |
| `empty-catalog` | `/nfts`, `/nfts/featured` e `/related` vazios (detalhe continua) |
| `slow-network` | 2500 ms em toda a API |
| `variable-latency` | GET `/nfts`: `q` de comprimento **ímpar → 1800 ms**, **par (inclusive vazio) → 200 ms**. Digitar "a" e depois "ab" faz "ab" chegar antes de "a" |
| `offline` | `HttpResponse.error()` em `/api/*` (exceto `/__mock/*`); sockets derrubados e reconexões recusadas |
| `server-error` | GET `/nfts` e `/nfts/:id` → 500 `INTERNAL_ERROR` (`retryable: true`) |
| `session-expired` | ao ativar, revoga TODAS as sessões existentes (→ 401 `SESSION_EXPIRED`); logins posteriores funcionam |
| `unauthorized` | `/me/*` e `/orders*` → 403 `FORBIDDEN` |
| `favorites-failure` | PUT/DELETE de favoritos → 500 (`retryable: false`) |
| `price-change-on-checkout` | 1ª tentativa de pedido de cada carrinho: +10% no preço do 1º item, `nft.updated`, 409 `QUOTE_STALE` + `details.quote` |
| `sold-out-on-checkout` | idem, mas zera a edição: 409 `AVAILABILITY_CONFLICT` + `details.quote` |
| `order-timeout` | POST `/orders` cria o pedido e só responde após 8 s; reenviar com a mesma `Idempotency-Key` devolve 200 com o mesmo pedido na hora |
| `payment-declined` | pedido resolve como `declined` (`failureReason`) e o estoque volta |
| `wallet-rejected` | POST `/me/wallets/:id/connect` → 403 `WALLET_REJECTED` |

Os gatilhos de checkout disparam uma vez por carrinho enquanto o cenário está ativo. Reativar o cenário arma de novo.

Latência padrão: `latencyMs × (0.5 + h)`, com `h` = hash(método + URL + contador de requisições). Com `latencyMs = 300`, fica entre 150 e 450 ms. `latencyMs = 0` desliga a latência. Não há `Math.random`: a mesma sequência de requisições gera os mesmos atrasos. Os atrasos usam `delay()`/`setTimeout`, então `page.clock` do Playwright controla tudo.

## Endpoints de controle (sempre ativos, inclusive offline)

| Rota | Corpo |
|---|---|
| `GET /api/__mock/state` | — |
| `POST /api/__mock/scenario` | `{ scenario }` |
| `POST /api/__mock/reset` | — (seed + cenário default + sem sessões + sockets derrubados) |
| `POST /api/__mock/latency` | `{ latencyMs }` |
| `POST /api/__mock/order-resolution` | `{ ms }` (padrão 1500) |
| `POST /api/__mock/nft-update` | `{ nftId, editionId?, priceEth?, available? }` |
| `POST /api/__mock/emit-duplicate` | `{ eventId? }` (padrão: último `nft.updated`, mesmo `eventId`) |
| `POST /api/__mock/emit-stale` | `{ nftId }` (versão atual − 1, preço ÷ 2, +1 unidade) |
| `POST /api/__mock/socket/disconnect` | — (fecha os sockets pelo lado do servidor) |
| `POST /api/__mock/sessions/expire` | — (revoga todas as sessões) |
| `POST /api/__mock/orders/:id/resolve` | `{ status: 'confirmed' \| 'declined' }` |

`window.__mock` expõe as mesmas operações: `state`, `setScenario`, `reset`, `setLatency`, `setOrderResolution`, `nftUpdate`, `emitDuplicate`, `emitStale`, `disconnectSockets`, `expireSessions` e `resolveOrder`.

## Decisões que afetam o cliente

- Carrinho: Bearer válido → carrinho do usuário. Sem Bearer → `X-Guest-Cart-Id`. Bearer inválido → 401 `SESSION_EXPIRED` (nunca cai no carrinho de visitante). Passar de `maxPerOrder` → 422 `fieldErrors.quantity`. Passar do disponível ou edição esgotada/indisponível → 409 `AVAILABILITY_CONFLICT`.
- Pedido: o estoque é reservado na criação, porque `available` cai e emite `nft.updated`. Na confirmação, emite `nft.updated` de novo e tira do carrinho só as quantidades compradas. Na recusa, o estoque volta. Durante o `pending`, o próprio carrinho do comprador pode mostrar `sold_out`/`insufficient` para os itens reservados.
- Pedido: `network` precisa ser igual a `wallet.network`, a menos que `collector.useOtherWallet = true`. Nesse caso, `order.wallet` usa `walletAddress`/`walletType` do formulário, com `nickname: "Outra carteira"`. Os erros do colecionador vêm em `fieldErrors["collector.<campo>"]`.
- Carteiras: no máximo 1 `primary` e 1 `secondary`. POST com papel ocupado → 409 `fieldErrors.role`. **PATCH de `role` faz swap** (a outra carteira assume o papel antigo). Endereço repetido (por usuário) → 409 `fieldErrors.address`.
- `eventId` é estável por (geração do DB, recurso, versão). Reemissões do mesmo estado repetem o id, e o reset muda a geração.
- Troca de senha mantém a sessão atual e revoga as demais.

## Transporte em tempo real e limitações

- O MSW reescreve `/socket.io/` para `/` antes de casar a URL, então `ws.link(/\/socket\.io\//)` **não casa**. O link usa a origem do socket (`VITE_SOCKET_URL` ou `location.origin`, ws/wss). Conexões que não são `/socket.io/*` (ex.: HMR do Vite) seguem para o servidor real com `server.connect()`.
- A identidade vem do pacote CONNECT bruto (`40{"token":…,"guestCartId":…}`) e é revalidada a cada emissão: um token revogado deixa de receber `order.updated`.
- O binding anuncia `pingInterval: 25000` mas nunca envia ping. Enviamos `2` a cada 20 s para o cliente não cair após ~30 s.
- Só namespace `/`. Sem rooms, sem acks e sem polling (o cliente usa só WebSocket). A reconexão é testada fechando a conexão pelo servidor (`client.close()`), e o MSW intercepta a nova.
- Várias abas compartilham o localStorage (o DB é recarregado no evento `storage`), mas os eventos de tempo real ficam na aba que fez a mudança.
