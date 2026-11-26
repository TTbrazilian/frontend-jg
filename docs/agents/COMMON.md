# Brief comum dos agentes (NFT Marketplace "KURIO")

## Projeto
- Repositório `/home/claude/nft-market`: Vite 8, React 19, TypeScript 6, pnpm, TanStack Router (code-based, `src/router.tsx`), TanStack Query, Axios, Tailwind v4, shadcn/ui adaptado, MSW 2 + `@mswjs/socket.io-binding`, socket.io-client, Playwright, Lighthouse.
- Desafio técnico (enunciado resumido): fidelidade visual ao Figma (desktop + mobile; testar 390/768/1440 sem overflow horizontal), fluxos completos com validação e recuperação de erros, integração tipada Router/Query/Axios, tempo real, a11y (teclado, foco visível, foco em diálogos/drawers, labels e erros associados, alt, contraste, estados não só por cor, feedback acessível de mutations e eventos), skeletons com shimmer que preservam dimensões, Lighthouse ≥90 perf / ≥95 a11y e best practices / ≥90 SEO.
- ELIMINATÓRIO: fluxos só visuais, compra confirmada sem resposta da simulação, dados expostos entre usuários, eventos simulados direto na UI (só pela API do mock → Socket.IO), sem E2E.

## Leia antes de codar
- `docs/DESIGN_SYSTEM.md`, `src/styles/index.css` (tokens — use só utilitários Tailwind desses tokens; nada de hex solto), `src/components/ui/*`, `src/components/icons/index.tsx`.
- `src/api/contracts.ts`, `src/api/endpoints.ts`, `src/api/errors.ts` (ApiError com `fieldErrors`), `src/app/session-store.ts`, hooks em `src/features/*/hooks.ts`, `src/realtime/realtime-provider.tsx` (já aplica eventos no cache e avisa), `src/lib/money.ts` (ETH é string; nunca Number/parseFloat em valores), `src/lib/coming-soon.ts` (ações fora do escopo nunca aparentam sucesso), `src/components/layout/live-region.tsx` (`announce()`).
- Mocks prontos: `src/mocks/README.md` (cenários, endpoints `/api/__mock/*`, `window.__mock`, credenciais `ana@nft.dev`/`bruno@nft.dev` senha `Password123!`, cupons WELCOME10/JUNGLE25/EXPIRED20, NFTs `nft-001`…`nft-048`).
- Figma exportado em `/home/claude/figma/`: `spec/<tela>.json` (chaves: t=tipo, n=nome, b=[x,y,w,h], al=autolayout "H|V gapN pT,R,B,L primary/counter", f=fills, s=strokes, r=raio, e=efeitos, x=texto, fn=fonte, fs=tamanho, lh, ls, k=filhos; arquivos grandes — extraia subárvores com python), `renders/<tela>.png` (desktop 1440; mobile 828=@2x), `preview/*.jpg`.

## Já existe em disco
Vários arquivos já foram escritos por uma rodada anterior interrompida. SEMPRE confira o que existe no seu escopo antes de escrever, reaproveite e complete; não recrie do zero o que já funciona.

## Regras
- Só altere arquivos do seu escopo; bug bloqueante em arquivo compartilhado: correção mínima + relatar.
- Sem dados fictícios em componentes (tudo vem da API/hooks); textos editoriais do Figma são permitidos.
- `data-testid`s pedidos no seu brief são obrigatórios (os E2E dependem deles).
- Verificação: `pnpm exec tsc -p tsconfig.app.json --noEmit` e `pnpm exec eslint <seus arquivos>` limpos nos seus arquivos; visual com script Playwright (`chromium.launch({ channel: 'chrome' })`) contra `VITE_ENABLE_MOCKS=true pnpm exec vite --port <sua porta> --strictPort` em segundo plano; derrube o servidor ao final.
- Proibido: git commit/push/PR; imprimir/salvar senhas reais, tokens ou chaves; instalar pacotes sem necessidade real; apagar arquivos fora do escopo; criar subagentes.
- Resposta final: pontos principais primeiro, frases curtas — arquivos criados, desvios do Figma (e por quê), pendências, resultado de typecheck/lint/capturas. Sem narrar o processo.
