import {
  test,
  expect,
  USERS,
  getCart,
  getNft,
  listOrders,
  login,
  mockControl,
  realtimeProbe,
  seedCart,
  toast,
  waitForNftEvents,
  waitForSocketConnected,
} from './fixtures'
import { cartRow, connectWallet, expectSummaryMatchesServer, gotoCart, gotoCheckout, openReview, orderIdFromUrl, placeOrder } from './helpers/flows'
import type { Page } from '@playwright/test'

/** Observa a região aria-live educada e conta anúncios que casam com `pattern` (só observa). */
async function watchAnnouncements(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { __e2eAnnouncements?: string[] }
    w.__e2eAnnouncements = []
    const el = document.querySelector('[data-testid="live-polite"]')
    if (!el) throw new Error('live region ausente')
    new MutationObserver(() => {
      const text = el.textContent?.trim()
      if (text) w.__e2eAnnouncements!.push(text)
    }).observe(el, { childList: true, characterData: true, subtree: true })
  })
}

async function announcements(page: Page, pattern: RegExp): Promise<number> {
  const all = await page.evaluate(() => (window as unknown as { __e2eAnnouncements?: string[] }).__e2eAnnouncements ?? [])
  return all.filter((t) => pattern.test(t)).length
}

const double = (eth: string) => (Number(eth) * 2).toFixed(6).replace(/0+$/, '').replace(/\.$/, '')

test.describe('Tempo real (Socket.IO)', () => {
  test('preço muda com o NFT no carrinho: aviso, item sinalizado e resumo atualizado', async ({ page }) => {
    await seedCart(page, [{ nftId: 'nft-001' }])
    await gotoCart(page)
    await waitForSocketConnected(page)
    const before = await expectSummaryMatchesServer(page)
    const item = (await getCart(page)).items[0]
    const newPrice = double(item.unitPriceEth)

    const { nftEvents } = await realtimeProbe(page)
    await mockControl(page, 'nft-update', { nftId: 'nft-001', editionId: item.editionId, priceEth: newPrice })
    await waitForNftEvents(page, nftEvents)

    await expect(toast(page, /o preço de .* mudou/i)).toBeVisible()
    await expect(page.getByTestId('live-polite')).toContainText(/o preço de .* mudou/i)
    const row = await cartRow(page, 'nft-001')
    await expect(row.getByTestId('cart-item-issue')).toHaveAttribute('data-status', 'price_changed')
    await expect(page.getByTestId('cart-issues-banner')).toBeVisible()
    // Finalizar fica bloqueado com motivo visível até aceitar a mudança.
    await expect(page.getByTestId('checkout-cta')).toHaveAttribute('aria-disabled', 'true')
    await expect(page.getByTestId('checkout-cta-reason')).toBeVisible()
    const after = await expectSummaryMatchesServer(page)
    expect(Number(after.subtotalEth)).toBeGreaterThan(Number(before.subtotalEth))

    await page.getByTestId('cart-acknowledge').click()
    await expect(page.getByTestId('cart-issues-banner')).toHaveCount(0)
    await expect(page.getByTestId('checkout-cta')).not.toHaveAttribute('aria-disabled', 'true')
    expect((await getCart(page)).items[0].unitPriceEth).toBe(newPrice)
  })

  test('evento duplicado ou antigo não regride o estado nem repete o aviso', async ({ page }) => {
    await seedCart(page, [{ nftId: 'nft-001' }])
    await gotoCart(page)
    await waitForSocketConnected(page)
    await expectSummaryMatchesServer(page)
    await watchAnnouncements(page)
    const item = (await getCart(page)).items[0]
    const newPrice = double(item.unitPriceEth)
    const priceWarning = /o preço de .* mudou/i

    let { nftEvents } = await realtimeProbe(page)
    await mockControl(page, 'nft-update', { nftId: 'nft-001', editionId: item.editionId, priceEth: newPrice })
    await waitForNftEvents(page, nftEvents)
    await expect.poll(() => announcements(page, priceWarning)).toBe(1)
    const shown = await expectSummaryMatchesServer(page)

    // Duplicado (mesmo eventId)
    ;({ nftEvents } = await realtimeProbe(page))
    await mockControl(page, 'emit-duplicate')
    await waitForNftEvents(page, nftEvents)
    // Antigo (versão menor, preço pela metade)
    ;({ nftEvents } = await realtimeProbe(page))
    await mockControl(page, 'emit-stale', { nftId: 'nft-001' })
    await waitForNftEvents(page, nftEvents)

    // Um evento novo depois dos descartados garante que todos já foram processados (ordem do socket).
    ;({ nftEvents } = await realtimeProbe(page))
    await mockControl(page, 'nft-update', { nftId: 'nft-002', priceEth: '0.5' })
    await waitForNftEvents(page, nftEvents)

    expect(await announcements(page, priceWarning)).toBe(1)
    await expect(page.locator('[data-sonner-toast]').filter({ hasText: priceWarning })).toHaveCount(1)
    const now = await expectSummaryMatchesServer(page)
    expect(now.subtotalEth).toBe(shown.subtotalEth)
    const nft = await getNft(page, 'nft-001')
    expect(nft.editions.find((e) => e.id === item.editionId)?.priceEth).toBe(newPrice)
  })

  test('detalhe aberto reflete o novo preço e ignora evento antigo', async ({ page }) => {
    await page.goto('/nft/nft-001')
    await expect(page.getByTestId('nft-detail')).toBeVisible()
    await waitForSocketConnected(page)
    const nft = await getNft(page, 'nft-001')
    const edition = nft.editions.find((e) => e.status === 'available')!
    const newPrice = double(edition.priceEth)
    const chip = page.getByTestId(`edition-option-${edition.id}`).filter({ visible: true }).first()

    let { nftEvents } = await realtimeProbe(page)
    await mockControl(page, 'nft-update', { nftId: 'nft-001', editionId: edition.id, priceEth: newPrice })
    await waitForNftEvents(page, nftEvents)
    const formatted = new RegExp(`${Number(newPrice).toFixed(4).replace(/0+$/, '').replace(/\.$/, '').replace('.', '\\.')} ETH`)
    await expect(chip).toHaveAccessibleName(formatted)

    ;({ nftEvents } = await realtimeProbe(page))
    await mockControl(page, 'emit-stale', { nftId: 'nft-001' })
    await waitForNftEvents(page, nftEvents)
    await expect(chip).toHaveAccessibleName(formatted)
  })

  test.describe('pagamento', () => {
    test.use({ clock: {} })

    test('checkout bloqueia cotação desatualizada por evento e exige reconfirmação', async ({ page }) => {
      await login(page, USERS.ana)
      await seedCart(page, [{ nftId: 'nft-001' }])
      await gotoCheckout(page)
      await waitForSocketConnected(page)
      await connectWallet(page)
      const dialog = await openReview(page)
      const item = (await getCart(page)).items[0]

      const { nftEvents } = await realtimeProbe(page)
      await mockControl(page, 'nft-update', { nftId: 'nft-001', editionId: item.editionId, priceEth: double(item.unitPriceEth) })
      await waitForNftEvents(page, nftEvents)

      // A revisão aberta tinha a cotação antiga: ao confirmar, o app revalida e NÃO cria o pedido.
      await dialog.getByTestId('review-confirm').click()
      await expect(dialog.getByTestId('review-changes')).toBeVisible()
      expect(await listOrders(page)).toHaveLength(0)

      for (let i = 0; i < 3 && /\/pagamento$/.test(page.url()); i++) {
        await expect(dialog.getByTestId('review-confirm')).toBeEnabled()
        await dialog.getByTestId('review-confirm').click()
        await page.waitForURL(/\/pedido\//, { timeout: 5_000 }).catch(() => undefined)
      }
      await expect(page).toHaveURL(/\/pedido\//)
      const orders = await listOrders(page)
      expect(orders).toHaveLength(1)
      expect(Number(orders[0].totalEth)).toBeGreaterThan(Number(item.unitPriceEth))
    })

    test('desconexão com pedido pendente + refresh retoma o MESMO pedido até confirmar', async ({ page }) => {
      await login(page, USERS.ana)
      await seedCart(page, [{ nftId: 'nft-001' }])
      await mockControl(page, 'order-resolution', { ms: 30_000 })
      await gotoCheckout(page)
      const orderId = await placeOrder(page)
      await expect(page.getByTestId('order-pending')).toBeVisible()
      await waitForSocketConnected(page)

      await mockControl(page, 'socket/disconnect')
      await expect.poll(async () => (await realtimeProbe(page)).connected).toBe(0)
      await page.reload()
      await expect(page).toHaveURL(new RegExp(`/pedido/${orderId}$`))
      await expect(page.getByTestId('order-pending')).toContainText(orderId)
      await waitForSocketConnected(page)

      // Em outra página, a faixa global aponta para o mesmo pedido.
      await page.goto('/')
      const banner = page.getByTestId('pending-order-banner')
      await expect(banner).toBeVisible()
      await banner.getByRole('link', { name: /acompanhar/i }).click()
      await expect(page).toHaveURL(new RegExp(`/pedido/${orderId}$`))

      await page.clock.runFor(35_000)
      await expect(page.getByTestId('order-confirmed').filter({ visible: true }).first()).toBeVisible({ timeout: 15_000 })
      expect(orderIdFromUrl(page)).toBe(orderId)
      const orders = await listOrders(page)
      expect(orders.map((o) => [o.id, o.status])).toEqual([[orderId, 'confirmed']])
    })
  })
})
