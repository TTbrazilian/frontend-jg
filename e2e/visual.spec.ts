import { test, expect, USERS, login, seedCart, waitForImagesAndFonts } from './fixtures'
import { gotoCart, gotoCheckout } from './helpers/flows'
import type { Page } from '@playwright/test'

/**
 * Regressão visual (desktop 1440×900 e mobile 390×844).
 * Dados estáveis: cenário default, latência 0, relógio fixo, fontes e imagens prontas,
 * animações desligadas, toasts e cursor de texto mascarados/ocultos.
 */
test.use({ latencyMs: 0, fixedTime: '2026-11-25T12:00:00-03:00' })

const STABILIZE_CSS = `
  *, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }
  [data-sonner-toaster] { display: none !important; }
`

async function stable(page: Page): Promise<void> {
  await page.addStyleTag({ content: STABILIZE_CSS })
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
  await page.mouse.move(0, 0)
  await waitForImagesAndFonts(page)
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0)
}

async function snap(page: Page, name: string): Promise<void> {
  await stable(page)
  await expect(page).toHaveScreenshot(name, { fullPage: true, animations: 'disabled', caret: 'hide', timeout: 15_000 })
}

test.describe('Visual', () => {
  test('Início @mobile', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('nft-card').first()).toBeVisible()
    await expect(page.getByTestId('nft-card-skeleton')).toHaveCount(0)
    await snap(page, 'inicio.png')
  })

  test('Detalhe nft-001 @mobile', async ({ page }) => {
    await page.goto('/nft/nft-001')
    await expect(page.getByTestId('nft-detail')).toBeVisible()
    await expect(page.getByTestId('related-nfts').getByTestId('nft-card').first()).toBeVisible()
    await snap(page, 'detalhe-nft-001.png')
  })

  test('Carrinho com 2 itens @mobile', async ({ page }) => {
    await seedCart(page, [{ nftId: 'nft-001' }, { nftId: 'nft-002' }])
    await gotoCart(page)
    await expect(page.getByTestId('cart-item')).toHaveCount(2)
    await expect(page.getByTestId('summary-total').filter({ visible: true }).first()).toBeVisible()
    await snap(page, 'carrinho-2-itens.png')
  })

  test('Pagamento (Ana) @mobile', async ({ page }) => {
    await login(page, USERS.ana)
    await seedCart(page, [{ nftId: 'nft-001' }, { nftId: 'nft-002' }])
    await gotoCheckout(page)
    await expect(page.getByTestId('wallet-status').filter({ visible: true }).first()).toBeVisible()
    await expect(page.getByTestId('summary-skeleton')).toHaveCount(0)
    await snap(page, 'pagamento-ana.png')
  })
})
