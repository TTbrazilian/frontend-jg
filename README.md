# Kurio — NFT Marketplace (frontend-jg)

Solução do desafio técnico de front-end da Jungle Gaming: descoberta, compra e conta do colecionador de um marketplace de NFTs, fiel ao Figma ("Marketplace de NFTs GreenMint", marca **KURIO**). Desktop, tablet e mobile.

Toda a API (REST) e o tempo real (Socket.IO) são **simulados na camada de rede com MSW**. Isso funciona no desenvolvimento, nos testes e no build publicado, sem nenhum backend.

**Stack:** React 19 · TypeScript · TanStack Router · TanStack Query · Axios · Socket.IO (client) · Tailwind CSS v4 · shadcn/ui (Radix) · MSW 2 + `@mswjs/socket.io-binding` · Playwright · Lighthouse · Vite.

| Entrega | Link |
|---|---|
| Aplicação publicada | **https://frontend-jg.vercel.app** _(atualizar após o deploy)_ |
| Repositório | https://github.com/TTbrazilian/frontend-jg |
| Relatório E2E (HTML) | `playwright-report/index.html` (`pnpm test:report`); traces de falhas em `test-results/` |
| Relatórios Lighthouse | `lighthouse-reports/` (HTML + JSON por execução, `SUMMARY.md`, `summary.json` com versões e ambiente) |

> Arquitetura, contratos, cache e tempo real: [ARCHITECTURE.md](./ARCHITECTURE.md). Design system extraído do Figma: [docs/DESIGN_SYSTEM.md](./docs/DESIGN_SYSTEM.md). Mocks: [src/mocks/README.md](./src/mocks/README.md).

## Setup

Requisitos: Node 20.19+ (testado com Node 22) e pnpm 10 (`corepack enable`).

```bash
pnpm install
pnpm exec playwright install chromium   # só para rodar os testes E2E
pnpm dev:mocks                           # http://localhost:5173 com MSW ativo
```

## Variáveis de ambiente

| Variável | Padrão | Descrição |
|---|---|---|
| `VITE_ENABLE_MOCKS` | `true` (`.env.development` e `.env.production`) | Ativa a camada MSW (REST + Socket.IO). Obrigatória no build de demonstração. |
| `VITE_API_BASE_URL` | `/api` | Base das chamadas REST (Axios). |
| `VITE_SOCKET_URL` | origem da página | URL do servidor Socket.IO. Em mocks, a conexão é interceptada pelo MSW. |

Veja `.env.example`.

## Comandos

| Comando | O que faz |
|---|---|
| `pnpm dev:mocks` | Desenvolvimento com mocks |
| `pnpm dev` | Desenvolvimento (usa `.env.development`, que também ativa os mocks) |
| `pnpm build` | Typecheck + build otimizado (`dist/`) |
| `pnpm preview` | Serve o build em `http://localhost:4173` |
| `pnpm typecheck` | Verificação de tipos |
| `pnpm lint` | ESLint |
| `pnpm test:e2e` | Playwright (faz o build com mocks e sobe o preview sozinho) |
| `pnpm test:e2e:update` | Regenera as baselines de regressão visual |
| `pnpm test:report` | Abre o relatório HTML do Playwright |
| `pnpm lighthouse` | Auditoria Lighthouse (rode `pnpm build` antes) — 3 medições × página × perfil, com mediana em `lighthouse-reports/SUMMARY.md` |

Em ambientes sem download de browsers do Playwright, use o Chrome instalado: `PW_CHANNEL=chrome pnpm test:e2e`.

## Credenciais fictícias

| Usuário | E-mail | Senha | Dados |
|---|---|---|---|
| Ana Collector | `ana@nft.dev` | `Password123!` | 2 carteiras (Principal/MetaMask/Ethereum, Reserva/Coinbase/Polygon), 2 favoritos |
| Bruno Holder | `bruno@nft.dev` | `Password123!` | 1 carteira (WalletConnect/Ethereum) |

Cupons: `WELCOME10` (10%), `JUNGLE25` (25%), `EXPIRED20` (expirado). Qualquer outro código é inválido.

As senhas ficam só como hash SHA-256 com salt no banco simulado. O cliente guarda apenas o token opaco da sessão.

## Cenários de simulação (seleção e reset)

Há três formas equivalentes de escolher um cenário:

1. **Painel "Simulação"**: botão no canto inferior esquerdo, disponível com mocks ativos. Ele permite selecionar o cenário, restaurar os dados (reset) e disparar eventos (mudar preço ou estoque de um item do carrinho, evento duplicado ou antigo, derrubar o socket, expirar a sessão). O painel só chama a API do mock; os efeitos chegam à interface por REST e Socket.IO, como viriam de um servidor real.
2. **URL**: `?scenario=<nome>` (e `?latency=<ms>`) em qualquer rota, por exemplo `/?scenario=slow-network`.
3. **Console**: `window.__mock.setScenario('payment-declined')`, `window.__mock.reset()`, `window.__mock.nftUpdate({...})` etc.

**Reset** (`POST /api/__mock/reset` ou o botão do painel) restaura integralmente o seed, volta ao cenário `default`, encerra as sessões e derruba os sockets.

| Cenário | Efeito |
|---|---|
| `default` | Sucesso, latência determinística de 150–450 ms |
| `empty-catalog` | Catálogo e destaques vazios |
| `slow-network` | 2,5 s em toda a API (skeletons visíveis) |
| `variable-latency` | Busca com termo de tamanho ímpar leva 1,8 s e par 200 ms (respostas fora de ordem) |
| `offline` | Falha de conexão em toda a API e no socket |
| `server-error` | 500 no catálogo e no detalhe |
| `session-expired` | Revoga as sessões ativas (401 `SESSION_EXPIRED`) |
| `unauthorized` | 403 em `/me/*` e `/orders` |
| `favorites-failure` | 500 ao favoritar ou desfavoritar (rollback da atualização otimista) |
| `price-change-on-checkout` | Preço sobe 10% na 1ª tentativa de pedido (409 `QUOTE_STALE`) |
| `sold-out-on-checkout` | Edição esgota na 1ª tentativa de pedido (409 `AVAILABILITY_CONFLICT`) |
| `order-timeout` | Pedido criado, resposta após 8 s (o cliente expira em 6 s e reenvia com a mesma chave) |
| `payment-declined` | Pagamento recusado |
| `wallet-rejected` | Conexão da carteira recusada |

## Como reproduzir os fluxos de falha

| Fluxo | Passos |
|---|---|
| Resultados fora de ordem | `/?scenario=variable-latency`: digite `a` e logo depois `ab` na busca. A grade mostra o resultado de `ab`; a resposta antiga é descartada. |
| Falha e recuperação | `/?scenario=server-error`: erro com "Tentar novamente". Troque para `default` no painel e tente de novo. |
| Sem conexão | Painel → `offline`: feedback de erro e socket "reconectando". Volte para `default` e tente de novo. |
| Sessão expirada no checkout | Logue como Ana, vá ao pagamento, preencha parte do formulário. Painel → "Expirar sessão" e faça qualquer ação. Faça login no diálogo: o formulário continua preenchido. |
| Cupom inválido/expirado | No carrinho, `XYZ` (inválido) ou `EXPIRED20` (expirado). |
| Preço alterado durante a compra | Com um item no carrinho, use o painel → "Preço +10%". O carrinho mostra a mudança e o resumo é recalculado; o checkout exige aceitar a nova cotação. Ou use o cenário `price-change-on-checkout`. |
| Edição esgotada | Painel → "Zerar estoque", ou o cenário `sold-out-on-checkout`. |
| Timeout com idempotência | Cenário `order-timeout` + confirmar compra: "Verificando o status do pedido…". O mesmo pedido é recuperado, sem duplicar. |
| Pagamento recusado | Cenário `payment-declined`: pedido recusado e itens preservados no carrinho. |
| Desconexão com pedido pendente | Confirme uma compra, use o painel → "Derrubar conexão em tempo real" e recarregue a página. O banner leva ao mesmo pedido, que chega a confirmado. |
| Eventos duplicados/antigos | Painel → "Reenviar evento duplicado" / "Emitir evento antigo": nada regride nem repete o aviso. |
| Carteira recusada | Cenário `wallet-rejected` + "Conectar carteira" no pagamento. |
| Conflito de cadastro | Cadastre com `bruno@nft.dev`: erro no campo de e-mail. |

## Resultados

- **E2E (Playwright, Chromium):** 93 testes em 11 specs (desktop 1440 + mobile 390), 92 passam e 1 é pulado por design (fluxo que não existe naquele viewport). Regressão visual de Início, Detalhe, Carrinho e Pagamento em desktop e mobile, com baselines em `e2e/__screenshots__`.
- **Lighthouse** (mediana de 3 execuções, build otimizado, cenário padrão): veja `lighthouse-reports/SUMMARY.md` e a análise em [ARCHITECTURE.md](./ARCHITECTURE.md#performance-lighthouse).

## Deploy

O deploy é estático (Vercel recomendada; `vercel.json` incluído com rewrite SPA, cache dos assets e `mockServiceWorker.js` sem cache).

1. Importe o repositório na Vercel (framework: Vite; build `pnpm build`; output `dist`).
2. Variáveis já vêm de `.env.production` (`VITE_ENABLE_MOCKS=true`).
3. Acesso direto e refresh em qualquer rota funcionam pelo rewrite para `index.html`.

## Estrutura

```
src/
  api/            contratos tipados, cliente Axios, endpoints, erros, query keys
  app/            QueryClient, sessão, providers
  realtime/       cliente Socket.IO, provider, deduplicação/versão de eventos
  features/       domínio: catalog, favorites, cart, checkout, orders, auth, profile, wallets, account
  components/     ui (shadcn adaptado), icons (Figma), layout, nft
  routes/         páginas (TanStack Router)
  mocks/          MSW: seed, store, serviços, handlers, cenários, Socket.IO
  styles/         tokens do design system (Tailwind v4)
e2e/              Playwright (specs, fixtures, baselines visuais)
scripts/          lighthouse.mjs, build-icons.py
docs/             design system, logs
```
