# Design system — Kurio (Figma "Marketplace de NFTs GreenMint")

Extraído do Figma via Plugin API (estilos locais, variáveis e specs das 15 telas). Fonte da verdade no código: `src/styles/index.css` (tokens) e `src/components/ui/*` (componentes shadcn adaptados).

## Fundamentos (perceptual patterns)

### Cor — 3 camadas de tokens
| Global (Figma) | Hex | Semântico (Tailwind) | Uso |
|---|---|---|---|
| Color/Ink | `#140D0A` | `bg-background`, `text-primary-foreground` | fundo da página; texto sobre botões laranja |
| Color/Surface Card | `#241612` | `bg-card` / `bg-surface` | sidebar de filtros, cards, modais, rodapé |
| Color/Surface Raised | `#2F1D15` | `bg-surface-raised` / `bg-muted` | linhas do carrinho, hover |
| Color/Surface Dark | `#38220F` | `bg-surface-dark` | faixa do rodapé |
| Color/Border | `#3F2319` | `border-border` | inputs, paginação, divisórias |
| Color/Border Soft | `#55321F` | `border-border-soft` | bordas secundárias |
| Color/Primary | `#D28A4C` | `bg-primary`, `border-primary` | CTA, badge do carrinho, chips ativos |
| Color/Primary Light / Dark | `#DD9A5F` / `#C47B3E` | `bg-brand-light` / `bg-brand-dark` | hover / active |
| Text/Accent | `#E89B55` | `text-text-accent`, `ring` | links, preço, aba ativa, foco |
| Color/Foreground | `#F5F1EB` | `text-foreground` | texto principal |
| Text/Secondary | `#CFB28C` | `text-text-secondary` / `text-muted-foreground` | descrições, labels de filtro |
| Color/Secondary | `#B39463` | `text-sand` | placeholders, metadados |
| Text/Coral | `#F0805F` | `text-destructive`, `text-coral` | asterisco de obrigatório, erros |
| Color/Success | `#00A66C` → `#3CCF91` | `text-success` | confirmação (clareado para AA) |

**Ajuste de acessibilidade:** `Color/Error #ED1B2E` tem contraste 3.6:1 no fundo escuro; erros usam o coral `#F0805F` (6.9:1). `Color/Success` foi clareado para 4.5:1+.

### Tipografia
Família única **Roboto Mono** (400/500/700), servida localmente via `@fontsource/roboto-mono` (sem CDN).

| Token | px | Uso no Figma |
|---|---|---|
| `text-display` | 43 / lh 70 | título do hero (MAIÚSCULAS, Bold) |
| `text-display-sm` | 32 | título hero mobile |
| `text-heading` | 24 | título do detalhe do NFT |
| `text-title` | 22 | — |
| `text-title-sm` | 18 | preço, títulos de seção, paginação |
| `text-body-lg` | 16 | nav, botões, nomes |
| `text-body-md` | 15 | filtros, labels |
| `text-body` | 14 | corpo (lh 22–24) |
| `text-body-sm` | 13 | rodapé |
| `text-caption` | 12 | hints, erros |
| `text-tiny` | 10 | badge do carrinho |

### Espaço, raio, sombra
- Container: 1200px (frames de 1440 com margem de 120). Grid do catálogo: sidebar 238px + gap 120 + grade 842 (3 colunas, gap 32/72).
- Raios: 3px (chips), 4px (paginação), **6px (botões/inputs — `rounded-md`)**, 8px, 16px (cards de imagem — `rounded-xl`), 20px, 37–40px (pílulas mobile/avatares).
- Sombras: `shadow-card` (0 4 12 ink/15%), `shadow-overlay` (0 6 20 #0A0604/45%).
- Divisor do header: linha `#D28A4C` 0.3px; aba ativa: sublinhado 2–3px laranja.

### Movimento
Skeleton com shimmer (`.skeleton`, 1.6s linear). `prefers-reduced-motion` desliga shimmer, transições e animações.

## Componentes (functional patterns)

| Nível | Componente | Arquivo | Notas |
|---|---|---|---|
| Átomo | Button (`default`, `outline`, `secondary`, `ghost`, `link`, `destructive`; `sm/default/lg/xl/icon`) | `ui/button.tsx` | `xl` = pílula 60px do mobile; `loading` com `aria-busy` |
| Átomo | Input, Textarea, Label (`required` → asterisco coral + "(obrigatório)" para leitor de tela) | `ui/input.tsx`… | |
| Átomo | Badge (`RARO`, status) | `ui/badge.tsx` | |
| Átomo | Skeleton | `ui/skeleton.tsx` | preserva dimensões do conteúdo |
| Átomo | Ícones Iconly exportados do Figma (`currentColor`) | `components/icons` | gerado por `scripts/build-icons.py` |
| Molécula | FormField (label + controle + erro `aria-describedby` + `aria-invalid`) | `ui/form-field.tsx` | |
| Molécula | Select, RadioGroup (anel laranja), Checkbox (círculo), Tabs (sublinhado) | `ui/*` | Radix + tokens |
| Organismo | Dialog (borda inferior laranja 8px, como os modais do Figma), Sheet (drawer de filtros mobile) | `ui/dialog.tsx`, `ui/sheet.tsx` | foco preso e devolvido pelo Radix |
| Organismo | Toaster (sonner, `aria-live`) + LiveRegion global | `ui/sonner.tsx`, `layout/live-region.tsx` | feedback de mutations e tempo real |

## Assets
- 4 artes de NFT do Figma (1254px) → `public/images/nfts/nft-{1..4}.webp` (900px) e `-480.webp`.
- Avatares derivados das mesmas artes → `public/images/avatars/avatar-{1..4}.webp`.
- Logo/wordmark KURIO → `components/icons` (`LogoWordmark`) e `public/images/brand/`.
- Ícone "Thank you" do recibo → `ThankYouIcon`.

## Mapa de telas (Figma → rota)
| Frame | Rota |
|---|---|
| Desktop/Mobile · Início | `/` (e `/mercado`) |
| Desktop/Mobile · Detalhes do NFT | `/nft/$nftId` |
| Desktop/Mobile · Carrinho de NFTs | `/carrinho` |
| Desktop/Mobile · Pagamento | `/pagamento` |
| Desktop · Confirmação de Pedido (modal) | `/pedido/$orderId` |
| Desktop (modal) / Mobile (página) · Login | `/login` |
| Desktop (modal) / Mobile (página) · Cadastro | `/cadastro` |
| Desktop · Perfil do Colecionador | `/perfil` |
| Desktop · Carteiras | `/perfil/carteiras` |
| (sem frame) Lista de interesse | `/perfil/favoritos` — mesmo padrão do perfil |
