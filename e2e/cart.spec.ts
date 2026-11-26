import { test, expect, USERS, findNft, getCart, getNft, login, seedCart, toast } from './fixtures'
import { addToCartFromDetail, badgeCount, cartRow, expectSummaryMatchesServer, gotoCart, summaryValue } from './helpers/flows'

test.describe('Carrinho', () => {
  test('adicionar pelo detalhe atualiza badge, linha e resumo @mobile', async ({ page }) => {
    await addToCartFromDetail(page, 'nft-001')
    const nft = await getNft(page, 'nft-001')
    await gotoCart(page)
    const row = await cartRow(page, 'nft-001')
    await expect(row).toBeVisible()
    await expect(row).toContainText(nft.title)
    await expectSummaryMatchesServer(page)
    if ((page.viewportSize()?.width ?? 0) >= 768) expect(await badgeCount(page)).toBe(1)
  })

  test('alterar quantidade recalcula o resumo e respeita o limite', async ({ page }) => {
    const nft = await findNft(page, (n) => n.editions.some((e) => e.status === 'available' && Math.min(e.available, e.maxPerOrder) >= 2))
    const edition = nft.editions.find((e) => e.status === 'available' && Math.min(e.available, e.maxPerOrder) >= 2)!
    const limit = Math.min(edition.available, edition.maxPerOrder)
    await seedCart(page, [{ nftId: nft.id, editionId: edition.id }])
    await gotoCart(page)
    const row = await cartRow(page, nft.id)
    const subtotal1 = (await expectSummaryMatchesServer(page)).subtotalEth

    await row.getByTestId('quantity-increment').click()
    await expect(row.getByTestId('quantity-value')).toHaveValue('2')
    await expect.poll(async () => (await getCart(page)).items[0]?.quantity).toBe(2)
    const q2 = await expectSummaryMatchesServer(page)
    expect(Number(q2.subtotalEth)).toBeCloseTo(Number(subtotal1) * 2, 8)

    // Digitar além do limite volta ao máximo permitido.
    const value = row.getByTestId('quantity-value')
    await value.fill(String(limit + 10))
    await value.press('Enter')
    await expect(value).toHaveValue(String(limit))
    await expect(row.getByTestId('quantity-increment')).toBeDisabled()
    await expect.poll(async () => (await getCart(page)).items[0]?.quantity).toBe(limit)

    await row.getByTestId('quantity-decrement').click()
    await expect.poll(async () => (await getCart(page)).items[0]?.quantity).toBe(limit - 1)
  })

  test('remover item mostra o carrinho vazio @mobile', async ({ page }) => {
    await seedCart(page, [{ nftId: 'nft-001' }])
    await gotoCart(page)
    const row = await cartRow(page, 'nft-001')
    await row.getByTestId('cart-item-remove').click()
    await expect(page.getByTestId('cart-empty')).toBeVisible()
    expect((await getCart(page)).items).toHaveLength(0)
    // Foco vai para um ponto estável (título da página), não se perde no <body>.
    await expect(page.getByRole('heading', { level: 1 })).toBeFocused()
  })

  test('remover item dá feedback acessível (toast + região aria-live)', async ({ page }) => {
    await seedCart(page, [{ nftId: 'nft-001' }])
    await gotoCart(page)
    const row = await cartRow(page, 'nft-001')
    await row.getByTestId('cart-item-remove').click()
    await expect(page.getByTestId('cart-empty')).toBeVisible()
    await expect(page.getByTestId('live-polite')).toContainText(/removido do carrinho/i)
    await expect(toast(page, /removido do carrinho/i)).toBeVisible()
  })

  test('cupons: WELCOME10 aplica, inválido e EXPIRED20 mostram erro no campo, remover recalcula @mobile', async ({ page }) => {
    await seedCart(page, [{ nftId: 'nft-001' }, { nftId: 'nft-002' }])
    await gotoCart(page)
    const before = await expectSummaryMatchesServer(page)
    expect(Number(before.discountEth)).toBe(0)

    const input = page.getByTestId('coupon-input')
    // Inválido
    await input.fill('NAOEXISTE')
    await page.getByTestId('coupon-apply').click()
    await expect(page.getByTestId('coupon-error')).toHaveText(/cupom inválido/i)
    await expect(input).toHaveAttribute('aria-invalid', 'true')
    await expect(input).toHaveAccessibleDescription(/cupom inválido/i)
    // Expirado
    await input.fill('EXPIRED20')
    await page.getByTestId('coupon-apply').click()
    await expect(page.getByTestId('coupon-error')).toHaveText(/expirou/i)
    expect((await getCart(page)).coupon).toBeNull()

    // Válido
    await input.fill('welcome10')
    await page.getByTestId('coupon-apply').click()
    await expect(page.getByTestId('coupon-code')).toHaveText('WELCOME10')
    await expect(page.getByTestId('coupon-error')).toHaveCount(0)
    const withCoupon = await expectSummaryMatchesServer(page)
    expect(Number(withCoupon.discountEth)).toBeCloseTo(Number(withCoupon.subtotalEth) * 0.1, 8)
    expect(await summaryValue(page, 'summary-discount')).toBeGreaterThan(0)

    // Persiste após refresh
    await page.reload()
    await expect(page.getByTestId('coupon-code')).toHaveText('WELCOME10')

    // Remover
    await page.getByTestId('coupon-remove').click()
    await expect(page.getByTestId('coupon-input')).toBeVisible()
    await expect(toast(page, /cupom removido/i)).toBeVisible()
    const after = await expectSummaryMatchesServer(page)
    expect(Number(after.discountEth)).toBe(0)
    expect((await getCart(page)).coupon).toBeNull()
  })

  test('carrinho persiste após refresh', async ({ page }) => {
    await addToCartFromDetail(page, 'nft-002')
    await gotoCart(page)
    await expect(page.getByTestId('cart-item')).toHaveCount(1)
    await page.reload()
    await expect(page.getByTestId('cart-item')).toHaveCount(1)
    await expectSummaryMatchesServer(page)
  })

  test('carrinho do visitante é mesclado ao do usuário no login', async ({ page }) => {
    await addToCartFromDetail(page, 'nft-004')
    await login(page, USERS.ana, { redirect: '/carrinho' })
    await expect(page).toHaveURL(/\/carrinho$/)
    await expect(page.getByTestId('cart-item')).toHaveCount(1)
    const cart = await getCart(page)
    expect(cart.items.map((i) => i.nftId)).toEqual(['nft-004'])
    // O carrinho é o do usuário (não o do visitante).
    const owner = await page.evaluate(async () => {
      const s = JSON.parse(localStorage.getItem('nft.session') ?? 'null') as { token: string } | null
      const res = await fetch('/api/cart', { headers: { Authorization: `Bearer ${s?.token}` } })
      return ((await res.json()) as { owner: { type: string; id: string } }).owner
    })
    expect(owner).toEqual({ type: 'user', id: USERS.ana.id })
  })

  test('CTA de finalizar como visitante leva ao login com retorno ao pagamento', async ({ page }) => {
    await seedCart(page, [{ nftId: 'nft-001' }])
    await gotoCart(page)
    await expectSummaryMatchesServer(page)
    await page.getByTestId('checkout-cta').click()
    await expect(page).toHaveURL(/\/login\?redirect=%2Fpagamento/)
  })
})
