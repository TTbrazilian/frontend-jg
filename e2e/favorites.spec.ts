import { test, expect, USERS, apiRequest, login, setScenario, toast, type MockScenario } from './fixtures'
import type { Locator, Page } from '@playwright/test'

const ANA_SEED_FAVORITES = ['nft-003', 'nft-010']

async function favoriteIds(page: Page): Promise<string[]> {
  const res = await apiRequest<{ nftIds: string[] }>(page, 'GET', '/me/favorites')
  expect(res.status).toBe(200)
  return [...res.body.nftIds].sort()
}

/** Primeiro card da grade que não está nos favoritos semeados da Ana. */
async function firstNonFavoriteCard(page: Page): Promise<{ card: Locator; id: string }> {
  const grid = page.getByTestId('catalog-grid')
  await expect(grid.getByTestId('nft-card').first()).toBeVisible()
  const ids = await grid.getByTestId('nft-card').evaluateAll((els) => els.map((el) => el.getAttribute('data-nft-id') ?? ''))
  const id = ids.find((i) => !ANA_SEED_FAVORITES.includes(i))!
  return { card: grid.locator(`[data-testid="nft-card"][data-nft-id="${id}"]`), id }
}

test.describe('Favoritos', () => {
  test('visitante é levado ao login e volta para a mesma página; favoritar persiste após refresh @mobile', async ({ page }) => {
    await page.goto('/mercado?sort=price_asc')
    const { card, id } = await firstNonFavoriteCard(page)
    await card.getByTestId('card-favorite-toggle').click()
    await expect(page).toHaveURL(/\/login\?redirect=/)
    await login(page, USERS.ana, { navigate: false })
    await expect(page).toHaveURL(/\/mercado\?sort=price_asc/)

    const toggle = page.getByTestId('catalog-grid').locator(`[data-nft-id="${id}"]`).getByTestId('card-favorite-toggle')
    await expect(toggle).toHaveAttribute('aria-pressed', 'false')
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-pressed', 'true')
    await expect(toggle).toHaveAccessibleName(/remover .* dos favoritos/i)
    await expect.poll(() => favoriteIds(page)).toEqual([...ANA_SEED_FAVORITES, id].sort())

    await page.reload()
    await expect(page.getByTestId('catalog-grid').locator(`[data-nft-id="${id}"]`).getByTestId('card-favorite-toggle')).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await page.goto('/perfil/favoritos')
    await expect(page.locator(`[data-testid="nft-card"][data-nft-id="${id}"]`)).toBeVisible()
  })

  test('desfavoritar remove da lista de interesse', async ({ page }) => {
    await login(page, USERS.ana, { redirect: '/perfil/favoritos' })
    const cards = page.getByTestId('nft-card')
    await expect(cards).toHaveCount(2)
    await page.locator('[data-testid="nft-card"][data-nft-id="nft-003"]').getByTestId('card-favorite-toggle').click()
    await expect(cards).toHaveCount(1)
    await expect.poll(() => favoriteIds(page)).toEqual(['nft-010'])
  })

  test.describe('falha ao favoritar', () => {
    test.use({ scenario: 'favorites-failure' satisfies MockScenario })

    test('rollback do estado otimista, mensagem de erro e recuperação', async ({ page }) => {
      await login(page, USERS.ana, { redirect: '/mercado' })
      const { id } = await firstNonFavoriteCard(page)
      const toggle = page.getByTestId('catalog-grid').locator(`[data-nft-id="${id}"]`).getByTestId('card-favorite-toggle')

      const put = page.waitForResponse((r) => r.url().includes(`/api/me/favorites/${id}`) && r.request().method() === 'PUT')
      await toggle.click()
      expect((await put).status()).toBe(500)
      await expect(toggle).toHaveAttribute('aria-pressed', 'false')
      await expect(toast(page, /não foi possível favoritar/i)).toBeVisible()
      await expect(page.getByTestId('live-assertive')).toContainText(/não foi possível favoritar/i)
      expect(await favoriteIds(page)).toEqual(ANA_SEED_FAVORITES)

      // Recuperação: a API volta ao normal e a mesma ação funciona.
      await setScenario(page, 'default')
      await toggle.click()
      await expect(toggle).toHaveAttribute('aria-pressed', 'true')
      await expect.poll(() => favoriteIds(page)).toEqual([...ANA_SEED_FAVORITES, id].sort())
    })
  })
})
