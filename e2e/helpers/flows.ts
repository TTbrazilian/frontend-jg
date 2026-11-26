import { expect, type Locator, type Page } from '@playwright/test'
import { apiRequest, buyableEdition, getCart, getNft, parseEth } from '../fixtures'

/** Abre o detalhe, escolhe a edição (padrão: a 1ª vendável) e adiciona ao carrinho pela UI. */
export async function addToCartFromDetail(page: Page, nftId: string, { editionId, quantity = 1 }: { editionId?: string; quantity?: number } = {}) {
  await page.goto(`/nft/${nftId}`)
  await expect(page.getByTestId('nft-detail')).toBeVisible()
  const edition = editionId ?? buyableEdition(await getNft(page, nftId), quantity).id
  const chip = page.getByTestId(`edition-option-${edition}`).filter({ visible: true }).first()
  await chip.click()
  await expect(chip).toHaveAttribute('aria-checked', 'true')
  const inc = page.getByTestId('quantity-increment').filter({ visible: true }).first()
  for (let i = 1; i < quantity; i++) await inc.click()
  const before = await cartCount(page)
  await page.getByTestId('add-to-cart').filter({ visible: true }).first().click()
  await expect.poll(() => cartCount(page)).toBe(before + quantity)
  return edition
}

/**
 * Quantidade de itens do carrinho segundo a API simulada (mesma identidade da página).
 * No mobile o badge some nas telas imersivas (detalhe/carrinho), então a fonte é o servidor.
 */
export async function cartCount(page: Page): Promise<number> {
  return (await getCart(page)).itemCount
}

/** Número exibido no badge do carrinho (0 quando o badge não aparece). */
export async function badgeCount(page: Page): Promise<number> {
  const badge = page.getByTestId('cart-badge').filter({ visible: true }).first()
  if (!(await badge.count())) return 0
  const n = Number.parseInt((await badge.innerText()).replace(/\D+/g, ''), 10)
  return Number.isNaN(n) ? 0 : n
}

export type SummaryField = 'summary-subtotal' | 'summary-discount' | 'summary-network-fee' | 'summary-total'

export async function summaryValue(page: Page, testId: SummaryField): Promise<number> {
  return parseEth(await page.getByTestId(testId).filter({ visible: true }).first().innerText())
}

export interface QuoteInfo {
  id: string
  subtotalEth: string
  discountEth: string
  networkFeeEth: string
  totalEth: string
  purchasable: boolean
  issues: Array<{ type: string; itemId: string }>
  lines: Array<{ nftId: string; unitPriceEth: string; quantity: number }>
}

/** Cotação calculada pelo servidor simulado para o carrinho atual (fonte da verdade dos valores). */
export async function serverQuote(page: Page, network = 'ethereum'): Promise<QuoteInfo> {
  const res = await apiRequest<QuoteInfo>(page, 'POST', '/quotes', { network })
  if (res.status !== 200 && res.status !== 201) throw new Error(`POST /quotes → ${res.status}`)
  return res.body
}

/** Os valores exibidos no resumo batem com a cotação do servidor (arredondamento de 4 casas). */
export async function expectSummaryMatchesServer(page: Page): Promise<QuoteInfo> {
  let quote!: QuoteInfo
  await expect
    .poll(
      async () => {
        quote = await serverQuote(page)
        const shown = await Promise.all((['summary-subtotal', 'summary-discount', 'summary-total'] as const).map((t) => summaryValue(page, t)))
        const expected = [quote.subtotalEth, quote.discountEth, quote.totalEth].map((v) => Number(Number(v).toFixed(4)))
        return shown.every((v, i) => Math.abs(v - expected[i]) < 0.00011)
      },
      { timeout: 10_000 },
    )
    .toBe(true)
  return quote
}

export async function gotoCart(page: Page) {
  await page.goto('/carrinho')
  await expect(page.getByTestId('cart-page')).toBeVisible()
}

/** Linha do carrinho de um NFT (localizada pelo id do item no servidor). */
export async function cartRow(page: Page, nftId: string): Promise<Locator> {
  const item = (await getCart(page)).items.find((i) => i.nftId === nftId)
  if (!item) throw new Error(`${nftId} não está no carrinho`)
  return page.locator(`[data-testid="cart-item"][data-item-id="${item.id}"]`)
}

// ---------------------------------------------------------------------------
// Pagamento
// ---------------------------------------------------------------------------

export async function gotoCheckout(page: Page) {
  await page.goto('/pagamento')
  await expect(page.getByTestId('checkout-form')).toBeVisible({ timeout: 15_000 })
}

/** Conecta a carteira selecionada (simulação via API) e espera o estado "Conectada". */
export async function connectWallet(page: Page) {
  const status = page.getByTestId('wallet-status').filter({ visible: true }).first()
  await expect(status).toBeVisible({ timeout: 15_000 })
  if ((await status.getAttribute('data-status')) === 'connected') return
  await page.getByTestId('wallet-connect').filter({ visible: true }).first().click()
  await expect(status).toHaveAttribute('data-status', 'connected')
}

/** "Confirmar compra" → diálogo de revisão aberto (com a cotação revisada). */
export async function openReview(page: Page): Promise<Locator> {
  const confirm = page.getByTestId('confirm-purchase').filter({ visible: true }).first()
  await expect(confirm).not.toHaveAttribute('aria-disabled', 'true', { timeout: 15_000 })
  await confirm.click()
  const dialog = page.getByTestId('review-dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.getByTestId('review-confirm')).toBeEnabled()
  return dialog
}

/** Conecta, revisa e confirma; devolve o id do pedido criado (URL /pedido/:id). */
export async function placeOrder(page: Page): Promise<string> {
  await connectWallet(page)
  const dialog = await openReview(page)
  await dialog.getByTestId('review-confirm').click()
  await expect(page).toHaveURL(/\/pedido\/[^/?#]+$/, { timeout: 20_000 })
  return orderIdFromUrl(page)
}

export function orderIdFromUrl(page: Page): string {
  const m = new URL(page.url()).pathname.match(/\/pedido\/([^/]+)$/)
  if (!m) throw new Error(`URL não é de pedido: ${page.url()}`)
  return decodeURIComponent(m[1])
}
