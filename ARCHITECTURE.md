# Arquitetura

## Visão geral

```
UI (routes, features/*/components, components/ui)
  │  hooks de domínio (features/*/hooks.ts) ── TanStack Query (cache por escopo de usuário)
  │                                              │
  │  api/endpoints.ts ── api/http.ts (Axios: token, guest cart, normalização de erros)
  │                                              │ REST /api/*
  │  realtime/realtime-provider.tsx ── socket.io-client (WebSocket) ── /socket.io
  ▼                                              ▼
MSW (Service Worker + interceptação de WebSocket na página)
  mocks/handlers/* → mocks/services/* → mocks/db (estado único persistido) → mocks/realtime.ts (eventos)
```

Responsabilidades:
- **`api/contracts.ts`**: um único arquivo de tipos para transporte, estado, UI e mocks. ETH sempre como string decimal (`EthAmount`), quantidades inteiras, recursos mutáveis com `version`.
- **`api/http.ts`**: instância Axios com `Authorization: Bearer`, `X-Guest-Cart-Id` e timeout. Converte qualquer falha em `ApiError` (`code`, `status`, `fieldErrors`, `retryable`, `details`). Um 401 de sessão marca a sessão como expirada.
- **`features/*/hooks.ts`**: as únicas portas de entrada de dados da UI (queries/mutations). Componentes não chamam Axios direto e não contêm dados fictícios.
- **`mocks/`**: o "servidor". Toda regra de negócio simulada (preço, estoque, cupom, cotação, idempotência, resolução de pedido) vive aqui. Detalhes em `src/mocks/README.md`.

## Contratos REST

Base `/api`. Erros sempre no formato `{ error: { code, message, fieldErrors?, retryable, details? } }`.

| Recurso | Método e rota | Sucesso | Erros relevantes |
|---|---|---|---|
| Cadastro | `POST /auth/register` `{username,email,password}` | 201 `Session` | 422 `VALIDATION_ERROR`, 409 `CONFLICT` (`fieldErrors.email/username`) |
| Login | `POST /auth/login` | 200 `Session` | 401 `INVALID_CREDENTIALS` |
| Sessão | `GET /auth/session` | 200 `Session` | 401 `SESSION_EXPIRED` / `UNAUTHENTICATED` |
| Logout | `POST /auth/logout` | 204 | — |
| NFTs | `GET /nfts?q&tab&category&network&minPrice&maxPrice&availability&sort&page&pageSize` | 200 `NftListResponse` (página + facetas) | 422, 500 |
| Destaques | `GET /nfts/featured` | 200 `{items}` | — |
| Detalhe | `GET /nfts/:id` | 200 `Nft` | 404 `NOT_FOUND` |
| Relacionados | `GET /nfts/:id/related` | 200 `{items}` | 404 |
| Favoritos | `GET /me/favorites`, `PUT/DELETE /me/favorites/:nftId` | 200 / 204 | 401, 404 |
| Carrinho | `GET /cart`, `POST /cart/items`, `PATCH/DELETE /cart/items/:id`, `PUT/DELETE /cart/coupon`, `POST /cart/merge`, `POST /cart/acknowledge` | 200 `Cart` | 409 `AVAILABILITY_CONFLICT`, 422 `COUPON_INVALID`/`COUPON_EXPIRED`/`VALIDATION_ERROR`, 401 |
| Cotação | `POST /quotes {network}` | 200 `Quote` (subtotal, desconto, taxa de rede, total, issues, `fingerprint`) | 401 |
| Pedidos | `POST /orders` + header `Idempotency-Key` | 201 `Order` (mesma chave + mesmo corpo → 200 com o mesmo pedido) | 409 `QUOTE_STALE`/`AVAILABILITY_CONFLICT` (com `details.quote`), 409 `IDEMPOTENCY_CONFLICT`, 422 `collector.*` |
| Pedido | `GET /orders/:id`, `GET /orders` | 200 | 404 (também para pedido de outro usuário) |
| Perfil | `GET/PATCH /me/profile`, `PUT/DELETE /me/avatar` (multipart), `POST /me/password` | 200 `User` / 204 | 422, 409 |
| Carteiras | `GET/POST /me/wallets`, `PATCH /me/wallets/:id`, `POST /me/wallets/:id/connect|disconnect` | 200/201/204 | 422, 409 (`role`, `address`), 403 `WALLET_REJECTED` |

Falhas transitórias: rede (`NETWORK_ERROR`), `TIMEOUT`, 500/503 com `retryable: true`.

## Eventos Socket.IO

Envelope comum: `{ eventId, type, resource: {type, id}, version, occurredAt, data }`.

| Evento | Quem recebe | `data` | Efeito no cliente |
|---|---|---|---|
| `nft.updated` | todas as conexões | `{ nftId, minPriceEth, available, soldOut, editions[] }` | Atualiza detalhe, listas, destaques e relacionados no cache. Se o NFT está no carrinho: revalida carrinho e cotação, mostra toast e anúncio `aria-live`. |
| `order.updated` | só as conexões do dono | `{ order }` | Grava o pedido no cache. Ao chegar a estado terminal: limpa o ponteiro de pedido pendente e revalida carrinho, pedidos e catálogo. |
| `session.ready` | a conexão | `{ userId }` | Diagnóstico. |

**Identidade:** o token vai no pacote CONNECT (`auth`), nunca na URL. Há um socket por identidade (`epoch` da sessão): login, logout e troca de usuário desmontam o socket anterior e seus listeners.

**Transporte nos mocks:** só WebSocket (o binding não suporta polling), interceptado pelo MSW na página. Limitações: um namespace, sem rooms nem acks, eventos só na aba que causou a mudança. Detalhes em `src/mocks/README.md`.

## Reconciliação REST × Socket.IO

1. **Deduplicação:** `EventLedger` guarda os `eventId` já vistos (LRU de 500). Uma duplicata não reaplica efeitos (nem toast).
2. **Ordenação:** para cada recurso, só aplica se `event.version` for maior que a maior versão conhecida, tanto pelo ledger quanto pelo cache REST (`knownNftVersion`). Assim um evento antigo nunca regride um estado mais novo vindo do REST.
3. **Pedidos terminais:** `confirmed`/`declined` nunca voltam para `pending`.
4. **Reconexão:** no `connect` seguinte a uma queda, todas as queries ativas de catálogo e privadas são invalidadas, e o REST traz o que foi perdido.
5. **Isolamento:** `order.updated` só é aplicado se o dono do evento for o usuário atual e o socket for o da identidade atual.
6. **Fallback:** a página do pedido pendente faz polling leve (5 s) caso o socket esteja indisponível.

## Estratégia de cache (TanStack Query)

| Dado | Key | staleTime | Observações |
|---|---|---|---|
| Lista do catálogo | `['nfts','list',params]` | 30 s | `keepPreviousData` (sem piscar), `AbortSignal` cancela a requisição obsoleta |
| Destaques / relacionados | `['nfts','featured']`, `['nfts','related',id]` | 60 s | |
| Detalhe | `['nfts','detail',id]` | 15 s | atualizado por eventos |
| Privados | `['private', scope, ...]` | 0–30 s | `scope` = `user:<id>` ou `guest:<cartId>` |
| Cotação | `['private',scope,'quote',cartVersion,network]` | 20 s | a versão do carrinho na key garante uma cotação nova a cada mudança |
| Pedido | `['private',scope,'orders',id]` | 0 se pendente, ∞ se terminal | polling de 5 s só enquanto pendente |

- **Retries:** só para `ApiError.retryable` (rede, timeout, 5xx), até 2 vezes com backoff exponencial (500 ms → 4 s). Erros de negócio 4xx nunca são repetidos. Mutations não têm retry automático; o reenvio do pedido é explícito e idempotente.
- **Invalidação:** mutations de carrinho gravam o `Cart` retornado direto no cache e invalidam as cotações. Favoritos são otimistas com rollback e revalidação no `onSettled`. Perfil atualiza o cache e o usuário da sessão. Carteiras invalidam a lista. Eventos seguem a tabela acima.
- **Respostas fora de ordem:** cada combinação de parâmetros tem a sua key, então uma resposta antiga nunca sobrescreve a atual. Além disso, o `signal` aborta a requisição anterior.
- **Atualização otimista:** favoritar/desfavoritar (rollback + toast + `aria-live`) e remover item do carrinho.

## Política de sessão

- `session-store.ts` (fora do React, `useSyncExternalStore`) guarda **apenas** o token opaco, a expiração e os dados públicos do usuário (`localStorage`). Nunca guarda senha.
- **Boot:** `GET /auth/session` revalida o token salvo (também ao focar a janela).
- **Expiração** (401 `SESSION_EXPIRED` em qualquer chamada, por exemplo durante navegação ou checkout): o status vira `expired`, o token é descartado e o usuário e o escopo do cache são **mantidos**, então a página continua mostrando o último estado e não perde formulários. O `SessionExpiredDialog` pede re-login. Com o mesmo usuário, as queries privadas são revalidadas e o fluxo continua; com outro usuário, o cache do anterior é limpo.
- **Rotas privadas** (`/pagamento`, `/pedido/:id`, `/perfil*`): `beforeLoad` redireciona para `/login?redirect=<destino>`. Após o login, volta ao destino (só caminhos internos).
- **Logout e troca de usuário:** removem todas as queries `['private', 'user:<id>']`, os rascunhos de checkout, as chaves de idempotência e o ponteiro de pedido pendente do usuário (`private-state.ts`), além de recriar o socket.
- **Carrinho do visitante:** fica no servidor, identificado por `X-Guest-Cart-Id`. No login, `POST /cart/merge` soma os itens no carrinho do usuário (respeitando a disponibilidade) e um novo id de visitante é gerado.

## Estado do carrinho

- A fonte da verdade é o servidor (sobrevive a refresh e é por usuário/visitante). O cliente nunca calcula totais: subtotal, desconto, taxa de rede e total vêm da **cotação** (`POST /quotes`), calculada com precisão decimal (big.js no mock). No cliente, ETH é sempre string e só é formatado para exibição.
- Cada item expõe `status` (`ok`, `price_changed`, `insufficient`, `sold_out`, `unavailable`) comparando o preço atual com `acknowledgedPriceEth`. A UI destaca a mudança e bloqueia o checkout até o usuário aceitar (`POST /cart/acknowledge`).
- **Checkout:** o usuário revisa uma cotação. Na confirmação, o cliente cria uma nova cotação e compara o `fingerprint`; se mudou, exige nova confirmação. O servidor revalida de novo no `POST /orders` (409 com a nova cotação em `details`).
- **Idempotência:** a chave é derivada do conteúdo da tentativa (cotação, carteira, rede, colecionador) e guardada em `sessionStorage`. Timeout ou erro de rede fazem reenvio automático com a **mesma chave**, recuperando o mesmo pedido. Cliques repetidos são barrados por `isPending` e por uma guarda síncrona.
- **Pedido pendente:** o ponteiro fica em `localStorage` (`nft.pendingOrder.<userId>`), e o banner global leva de volta ao pedido após refresh ou reconexão. A confirmação só aparece para `status === 'confirmed'` vindo da simulação. O recibo usa o **snapshot** do pedido, não o catálogo. Na confirmação, o servidor remove do carrinho apenas as quantidades compradas; na recusa, o estoque volta e os itens ficam no carrinho.

## Roteamento e estado de URL

Rotas code-based em `src/router.tsx`, com páginas carregadas sob demanda (exceto a home). O catálogo guarda tudo na URL (`q, tab, category, network, minPrice, maxPrice, availability, sort, page`), validado por zod com descarte de valores inválidos. Mudar um filtro reinicia a página. Refresh e voltar/avançar restauram o estado. Rotas inexistentes caem em `NotFoundPage`; erros inesperados, em `RouteErrorPage`.

## Acessibilidade

Skip link, `main` focável, foco visível global (anel `Text/Accent`). Diálogos e drawers usam Radix (foco preso e devolvido). `FormField` associa label, `aria-invalid`, `aria-describedby` e `role="alert"`. Há uma região `aria-live` global para mutations e eventos em tempo real, além dos toasts (sonner). Estados não dependem só de cor (texto e ícone). `prefers-reduced-motion` desliga shimmer e animações.

## Decisões de UX e desvios do Figma

- **Cores de erro e sucesso:** `Color/Error #ED1B2E` não atinge 4.5:1 no fundo escuro. Erros usam o coral `#F0805F` do próprio Figma, e o sucesso foi clareado. Ambos documentados em `docs/DESIGN_SYSTEM.md`.
- **Telas sem frame mobile:** login e cadastro são modais no desktop e páginas cheias no mobile, como no Figma. Perfil, carteiras, favoritos, confirmação e pedido pendente não têm frame mobile e foram adaptados com o mesmo padrão visual.
- **Ações fora do escopo:** Criadores, Aprenda, Atividade, Ofertas, Downloads, Suporte, newsletter, login social e "Esqueceu a senha?" mostram um aviso "não disponível nesta demonstração" e nunca simulam sucesso.
- **Assets:** o Figma tem só 4 artes de NFT. Elas foram convertidas para WebP (900px e 480px) e reutilizadas pelo seed; os avatares são recortes das mesmas artes. Os ícones são os Iconly exportados do Figma, convertidos para componentes com `currentColor`. A fonte Roboto Mono é servida localmente.
- **Alterar senha:** tem botão próprio no perfil (no Figma, um único "Salvar"), para separar as duas operações.
- **Painel "Simulação":** é um acréscimo de demonstração, presente só com mocks ativos.

## Performance (Lighthouse)

Mediana de 3 execuções por página e perfil, com o build otimizado servido por `vite preview` e o cenário padrão dos mocks (Lighthouse 13.6, Chrome headless, Node 22, Linux x64, 2 vCPU). Configuração versionada em `lighthouse.config.json` e `scripts/lighthouse.mjs`; relatórios HTML/JSON e `summary.json` (versões e ambiente) em `lighthouse-reports/`.

| Página | Perfil | Perf | A11y | BP | SEO | LCP | CLS | TBT |
|---|---|---|---|---|---|---|---|---|
| Início | mobile | 61 | 100 | 100 | 100 | 4.9 s | 0 | 916 ms |
| Início | desktop | 98 | 95 | 100 | 100 | 1.1 s | 0 | 65 ms |
| Detalhe | mobile | 69 | 97 | 100 | 100 | 4.9 s | 0 | 547 ms |
| Detalhe | desktop | 98 | 100 | 100 | 100 | 1.2 s | 0 | 0 ms |

**Abaixo da meta: Performance no perfil mobile (61–69).** As causas, identificadas nos audits `bootup-time` e `mainthread-work-breakdown`:

1. **Boot da camada de mocks antes da primeira renderização.** O MSW precisa registrar o Service Worker e instalar a interceptação de WebSocket *antes* de qualquer requisição e antes de o `socket.io-client` ser avaliado (senão o socket não é interceptado). O chunk `start` (MSW, seed determinístico de 48 NFTs, serviços do "servidor") tem cerca de 500 KB e leva cerca de 1,1 s de avaliação com o throttling de CPU 4× do perfil mobile. É a maior parcela do TBT e atrasa o LCP.
2. **Latência simulada da API.** O cenário padrão adiciona 150–450 ms em cada resposta. A imagem LCP (hero e imagem principal do detalhe) depende da resposta de destaques/detalhe.
3. Esses dois custos são da **simulação**, não da aplicação. Em produção com API real, o item 1 desaparece (o `import()` dinâmico do MSW nem é carregado com `VITE_ENABLE_MOCKS=false`) e o item 2 vira a latência real. Conforme o enunciado, não há atalho exclusivo para a auditoria: as mesmas imagens, fontes, mocks e tempo real são carregados.

**O que já está otimizado:** code splitting por rota (só a home é estática), chunks separados para React e TanStack, imagens WebP com `srcSet` (480/900), `width`/`height` explícitos e `fetchPriority="high"` na imagem LCP, lazy loading nas demais, fonte local (só os pesos 400/500/700, latin), CLS 0 (o `main` tem altura mínima de viewport, então o rodapé não se desloca quando o conteúdo assíncrono chega).

**Próximos passos se a meta mobile for obrigatória com mocks:** gerar o seed no build (JSON estático) em vez de no runtime; mover a lógica do "servidor" para dentro do Service Worker (tirando-a da thread principal); renderizar o shell da página (header e skeletons) antes do `enableMocking()` e adiar só as queries.

## Limitações conhecidas

- O tempo real simulado não atravessa abas: o banco de dados é compartilhado via `localStorage`, mas os eventos ficam na aba de origem.
- Durante um pedido pendente, o estoque reservado pode fazer o próprio carrinho do comprador mostrar o item como indisponível até a resolução.
- As baselines visuais dependem do SO e da fonte renderizada. As versionadas foram geradas em Linux; em outro SO, use `pnpm test:e2e:update`.
