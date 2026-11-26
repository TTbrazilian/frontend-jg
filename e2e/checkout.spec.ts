import { test, expect, USERS, findNft, getCart, getNft, listOrders, login, mockControl, seedCart, setScenario, type MockScenario } from './fixtures'
import { connectWallet, gotoCheckout, openReview, orderIdFromUrl, placeOrder } from './helpers/flows'
import type { Page } from '@playwright/test'

/** Ana logada com 2 NFTs no carrinho (dados do seed). */
async function anaWithCart(page: Page, nftIds = ['nft-001', 'nft-002']) {
  await login(page, USERS.ana)
  await seedCart(page, nftIds.map((nftId) => ({ nftId })))
}

test.describe('Pagamento', () => {
  // Relógio controlado: o pedido fica pendente até avançarmos o tempo (resolução do mock por setTimeout).
  test.use({ clock: {} })

  test('compra completa: pendente → confirmado com recibo, carrinho sem os itens comprados @mobile', async ({ page }) => {
    await anaWithCart(page)
    await mockControl(page, 'order-resolution', { ms: 10_000 })
    await gotoCheckout(page)
    await expect(page.getByTestId('checkout-line')).toHaveCount(2)

    const orderId = await placeOrder(page)
    await expect(page.getByTestId('order-pending')).toBeVisible()
    await expect(page.getByTestId('order-pending')).toContainText(orderId)
    expect((await listOrders(page)).map((o) => [o.id, o.status])).toEqual([[orderId, 'pending']])

    await page.clock.runFor(11_000)
    const receipt = page.getByTestId('order-confirmed').filter({ visible: true }).first()
    await expect(receipt).toBeVisible({ timeout: 15_000 })
    await expect(receipt.getByTestId('receipt-line')).toHaveCount(2)
    await expect(receipt.getByTestId('receipt-tx')).not.toHaveText('—')
    const [order] = await listOrders(page)
    expect(order).toMatchObject({ id: orderId, status: 'confirmed' })
    expect(order.txHash).toBeTruthy()

    await expect.poll(async () => (await getCart(page)).items.length).toBe(0)
    await page.goto('/carrinho')
    await expect(page.getByTestId('cart-empty')).toBeVisible()
  })

  test('confirmar só compra os itens da cotação; item adicionado depois continua no carrinho', async ({ page }) => {
    await anaWithCart(page, ['nft-001'])
    await mockControl(page, 'order-resolution', { ms: 1_000 })
    await gotoCheckout(page)
    const orderId = await placeOrder(page)
    const extra = await findNft(page, (n) => n.id !== 'nft-001' && n.editions.some((e) => e.status === 'available' && e.available > 0))
    await seedCart(page, [{ nftId: extra.id }])
    await page.clock.runFor(2_000)
    await expect(page.getByTestId('order-confirmed').filter({ visible: true }).first()).toBeVisible({ timeout: 15_000 })
    const cart = await getCart(page)
    expect(cart.items.map((i) => i.nftId)).toEqual([extra.id])
    expect((await listOrders(page)).find((o) => o.id === orderId)?.status).toBe('confirmed')
  })

  test('clique repetido em confirmar cria exatamente 1 pedido', async ({ page }) => {
    await anaWithCart(page)
    await gotoCheckout(page)
    await connectWallet(page)
    const dialog = await openReview(page)
    // Três cliques no mesmo tick (o primeiro desabilita o botão; a guarda síncrona cobre o resto).
    await dialog.getByTestId('review-confirm').evaluate((btn: HTMLButtonElement) => {
      btn.click()
      btn.click()
      btn.click()
    })
    await expect(page).toHaveURL(/\/pedido\//, { timeout: 20_000 })
    const orderId = orderIdFromUrl(page)
    await page.clock.runFor(3_000)
    await expect(page.getByTestId('order-confirmed').filter({ visible: true }).first()).toBeVisible({ timeout: 15_000 })
    const orders = await listOrders(page)
    expect(orders).toHaveLength(1)
    expect(orders[0].id).toBe(orderId)
  })

  test.describe('pagamento recusado', () => {
    test.use({ scenario: 'payment-declined' satisfies MockScenario })

    test('pedido recusado mostra o motivo, mantém o carrinho e libera o estoque', async ({ page }) => {
      await anaWithCart(page)
      const before = await getNft(page, 'nft-001')
      await gotoCheckout(page)
      const orderId = await placeOrder(page)
      await page.clock.runFor(3_000)
      const declined = page.getByTestId('order-declined')
      await expect(declined).toBeVisible({ timeout: 15_000 })
      await expect(declined.getByTestId('order-failure-reason')).not.toBeEmpty()
      expect((await listOrders(page)).map((o) => [o.id, o.status])).toEqual([[orderId, 'declined']])
      expect((await getCart(page)).items.map((i) => i.nftId).sort()).toEqual(['nft-001', 'nft-002'])
      const after = await getNft(page, 'nft-001')
      expect(after.editions.map((e) => e.available)).toEqual(before.editions.map((e) => e.available))

      await declined.getByTestId('order-retry-checkout').click()
      await expect(page).toHaveURL(/\/pagamento$/)
      await expect(page.getByTestId('checkout-line')).toHaveCount(2)
    })
  })

  test.describe('timeout na criação do pedido', () => {
    test.use({ scenario: 'order-timeout' satisfies MockScenario })

    test('reenvio com a mesma chave recupera o MESMO pedido (sem duplicar)', async ({ page }) => {
      await anaWithCart(page)
      await gotoCheckout(page)
      await connectWallet(page)
      const dialog = await openReview(page)
      const posts: string[] = []
      page.on('request', (r) => {
        if (r.method() === 'POST' && new URL(r.url()).pathname === '/api/orders') posts.push(r.headers()['idempotency-key'] ?? '')
      })
      await dialog.getByTestId('review-confirm').click()
      // Após 6 s sem resposta o app informa que está verificando o status.
      await page.clock.runFor(6_500)
      await expect(dialog.getByTestId('order-checking')).toBeVisible()
      await page.clock.runFor(3_000)
      await expect(page).toHaveURL(/\/pedido\//, { timeout: 15_000 })
      const orderId = orderIdFromUrl(page)

      expect(posts.length).toBeGreaterThanOrEqual(2)
      expect(new Set(posts).size).toBe(1)
      const orders = await listOrders(page)
      expect(orders).toHaveLength(1)
      expect(orders[0].id).toBe(orderId)

      await page.clock.runFor(3_000)
      await expect(page.getByTestId('order-confirmed').filter({ visible: true }).first()).toBeVisible({ timeout: 15_000 })
    })
  })

  test.describe('carteira recusa a conexão', () => {
    test.use({ scenario: 'wallet-rejected' satisfies MockScenario })

    test('mostra a recusa, bloqueia a confirmação e permite tentar de novo', async ({ page }) => {
      await anaWithCart(page)
      await gotoCheckout(page)
      await page.getByTestId('wallet-connect').filter({ visible: true }).first().click()
      const status = page.getByTestId('wallet-status').filter({ visible: true }).first()
      await expect(status).toHaveAttribute('data-status', 'rejected')
      await expect(status).toHaveRole('alert')
      await expect(status).toContainText(/conexão recusada/i)

      const confirm = page.getByTestId('confirm-purchase').filter({ visible: true }).first()
      await expect(confirm).toHaveAttribute('aria-disabled', 'true')
      await expect(confirm).toHaveAccessibleDescription(/conecte a carteira/i)
      // aria-disabled mantém o botão focável: ativar pelo teclado não abre a revisão e anuncia o motivo.
      await confirm.focus()
      await page.keyboard.press('Enter')
      await expect(page.getByTestId('live-assertive')).toContainText(/conecte a carteira/i)
      await expect(page.getByTestId('review-dialog')).toHaveCount(0)
      expect(await listOrders(page)).toHaveLength(0)

      await setScenario(page, 'default')
      await page.getByTestId('wallet-connect').filter({ visible: true }).first().click()
      await expect(status).toHaveAttribute('data-status', 'connected')
      await expect(confirm).not.toHaveAttribute('aria-disabled', 'true')
    })
  })

  test.describe('preço muda na confirmação', () => {
    test.use({ scenario: 'price-change-on-checkout' satisfies MockScenario })

    test('servidor recusa a cotação antiga; só cria o pedido após reconfirmar com o novo preço', async ({ page }) => {
      await anaWithCart(page)
      const firstItem = (await getCart(page)).items[0]
      await gotoCheckout(page)
      await connectWallet(page)
      const dialog = await openReview(page)
      await dialog.getByTestId('review-confirm').click()

      await expect(dialog.getByTestId('review-changes')).toBeVisible()
      await expect(dialog.getByTestId('review-confirm')).toHaveText(/aceitar alterações|novos valores/i)
      expect(await listOrders(page)).toHaveLength(0)

      // Reconfirmação (aceitar as alterações → nova revisão → confirmar).
      for (let i = 0; i < 3 && /\/pagamento$/.test(page.url()); i++) {
        await expect(dialog.getByTestId('review-confirm')).toBeEnabled()
        await dialog.getByTestId('review-confirm').click()
        await page.waitForURL(/\/pedido\//, { timeout: 5_000 }).catch(() => undefined)
      }
      await expect(page).toHaveURL(/\/pedido\//)
      const orders = await listOrders(page)
      expect(orders).toHaveLength(1)
      const nft = await getNft(page, firstItem.nftId)
      const edition = nft.editions.find((e) => e.id === firstItem.editionId)!
      expect(Number(edition.priceEth)).toBeCloseTo(Number(firstItem.unitPriceEth) * 1.1, 8)
      const full = await page.evaluate(async (id) => {
        const s = JSON.parse(localStorage.getItem('nft.session') ?? 'null') as { token: string }
        return (await fetch(`/api/orders/${id}`, { headers: { Authorization: `Bearer ${s.token}` } })).json()
      }, orders[0].id)
      const line = (full as { lines: Array<{ nftId: string; unitPriceEth: string }> }).lines.find((l) => l.nftId === firstItem.nftId)!
      expect(line.unitPriceEth).toBe(edition.priceEth)
    })
  })

  test.describe('esgota na confirmação', () => {
    test.use({ scenario: 'sold-out-on-checkout' satisfies MockScenario })

    test('item esgotado sai do pedido somente após reconfirmação', async ({ page }) => {
      await anaWithCart(page)
      const [soldOut, kept] = (await getCart(page)).items
      await gotoCheckout(page)
      await connectWallet(page)
      const dialog = await openReview(page)
      await dialog.getByTestId('review-confirm').click()
      await expect(dialog.getByTestId('review-changes')).toBeVisible()
      expect(await listOrders(page)).toHaveLength(0)

      for (let i = 0; i < 3 && /\/pagamento$/.test(page.url()); i++) {
        await expect(dialog.getByTestId('review-confirm')).toBeEnabled()
        await dialog.getByTestId('review-confirm').click()
        await page.waitForURL(/\/pedido\//, { timeout: 5_000 }).catch(() => undefined)
      }
      await expect(page).toHaveURL(/\/pedido\//)
      await page.clock.runFor(3_000)
      const receipt = page.getByTestId('order-confirmed').filter({ visible: true }).first()
      await expect(receipt).toBeVisible({ timeout: 15_000 })
      await expect(receipt.getByTestId('receipt-line')).toHaveCount(1)
      const full = await page.evaluate(async (id) => {
        const s = JSON.parse(localStorage.getItem('nft.session') ?? 'null') as { token: string }
        return (await fetch(`/api/orders/${id}`, { headers: { Authorization: `Bearer ${s.token}` } })).json()
      }, orderIdFromUrl(page))
      expect((full as { lines: Array<{ nftId: string }> }).lines.map((l) => l.nftId)).toEqual([kept.nftId])
      expect(soldOut.nftId).not.toBe(kept.nftId)
    })
  })

  test('validação do formulário do colecionador foca o 1º campo inválido', async ({ page }) => {
    await anaWithCart(page, ['nft-001'])
    await gotoCheckout(page)
    await connectWallet(page)
    test.skip((page.viewportSize()?.width ?? 0) < 768, 'no mobile os campos ficam no acordeão')
    const referral = page.getByTestId('field-referralCode')
    await referral.fill('!')
    await page.getByTestId('field-email').fill('email-invalido')
    await page.getByTestId('confirm-purchase').click()
    await expect(page.getByTestId('review-dialog')).toHaveCount(0)
    await expect(referral).toBeFocused()
    await expect(referral).toHaveAttribute('aria-invalid', 'true')
    await expect(referral).toHaveAccessibleDescription(/4 a 12 letras ou números/i)
    await expect(page.getByTestId('field-email')).toHaveAccessibleDescription(/e-mail válido/i)
    expect(await listOrders(page)).toHaveLength(0)
  })
})
