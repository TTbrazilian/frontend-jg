import { test, expect, USERS, login, seedCart, setScenario, type MockScenario } from './fixtures'
import { cardIds, expectedIds } from './helpers/catalog'

test.describe('Carregamento lento', () => {
  // 2500 ms em toda a API; o relógio controlado acelera a espera depois de verificarmos os skeletons.
  test.use({ scenario: 'slow-network' satisfies MockScenario, clock: {} })

  test('catálogo mostra skeletons com as dimensões do card e depois os NFTs', async ({ page }) => {
    await page.goto('/mercado')
    const skeletons = page.getByTestId('nft-card-skeleton')
    await expect(skeletons.first()).toBeVisible()
    expect(await skeletons.count()).toBeGreaterThanOrEqual(3)
    const box = await skeletons.first().boundingBox()
    // A região ocupada fica ocupada (busy) para tecnologias assistivas.
    await expect(page.locator('[aria-busy="true"]').first()).toBeAttached()

    await page.clock.runFor(3_000)
    const card = page.getByTestId('catalog-grid').getByTestId('nft-card').first()
    await expect(card).toBeVisible()
    await expect(skeletons).toHaveCount(0)
    const cardBox = await card.boundingBox()
    // Skeleton preserva a largura do card (sem salto de layout).
    expect(Math.abs((cardBox?.width ?? 0) - (box?.width ?? 0))).toBeLessThanOrEqual(2)
  })

  test('detalhe mostra skeleton até o NFT carregar', async ({ page }) => {
    await page.goto('/nft/nft-001')
    await expect(page.getByTestId('nft-detail-skeleton')).toBeVisible()
    await expect(page.getByTestId('nft-detail')).toHaveCount(0)
    await page.clock.runFor(3_000)
    await expect(page.getByTestId('nft-detail')).toBeVisible()
    await expect(page.getByTestId('nft-detail-skeleton')).toHaveCount(0)
  })

  test('resumo do carrinho mostra skeleton enquanto a cotação é calculada', async ({ page }) => {
    await setScenario(page, 'default')
    await seedCart(page, [{ nftId: 'nft-001' }])
    await setScenario(page, 'slow-network')
    await page.goto('/carrinho')
    await page.clock.runFor(3_000) // carrinho
    await expect(page.getByTestId('cart-item')).toHaveCount(1)
    await expect(page.getByTestId('summary-skeleton').filter({ visible: true })).toBeVisible()
    await page.clock.runFor(3_000) // cotação
    await expect(page.getByTestId('summary-total').filter({ visible: true })).toBeVisible()
    await expect(page.getByTestId('summary-skeleton')).toHaveCount(0)
  })

  test('resumo do pagamento mostra skeleton enquanto a cotação é calculada', async ({ page }) => {
    await setScenario(page, 'default')
    await login(page, USERS.ana)
    await seedCart(page, [{ nftId: 'nft-001' }])
    await setScenario(page, 'slow-network')
    await page.goto('/pagamento')
    await expect(page.getByTestId('summary-skeleton').filter({ visible: true }).first()).toBeVisible()
    await page.clock.runFor(8_000)
    await expect(page.getByTestId('summary-total').filter({ visible: true }).first()).toBeVisible()
  })
})

test.describe('Sem conexão', () => {
  test.use({ scenario: 'offline' satisfies MockScenario })

  test('catálogo offline mostra erro e "Tentar novamente" recupera quando a rede volta', async ({ page }) => {
    await page.goto('/mercado')
    const error = page.getByTestId('catalog-error')
    await expect(error).toBeVisible({ timeout: 20_000 })
    await expect(error).toContainText(/conexão|internet|rede|offline|não foi possível/i)
    await expect(page.getByTestId('nft-card')).toHaveCount(0)

    await setScenario(page, 'default')
    await error.getByRole('button', { name: /tentar novamente/i }).click()
    await expect(error).toBeHidden()
    await expect.poll(() => cardIds(page)).toEqual(await expectedIds(page, {}))
  })

  test('detalhe offline mostra erro e recupera @mobile', async ({ page }) => {
    await page.goto('/nft/nft-001')
    const retry = page.getByTestId('nft-detail-error').getByRole('button', { name: /tentar novamente/i })
    await expect(retry).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('nft-detail')).toHaveCount(0)
    await setScenario(page, 'default')
    await retry.click()
    await expect(page.getByTestId('nft-detail')).toBeVisible()
  })
})
