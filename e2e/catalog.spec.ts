import { test, expect, apiRequest, setScenario, type MockScenario } from './fixtures'
import { cardIds, expectedIds, openFiltersIfCollapsed, closeFiltersIfOpen, searchCatalog, selectSort } from './helpers/catalog'

test.describe('Catálogo', () => {
  test('busca reflete na URL e filtra a grade @mobile', async ({ page }) => {
    await page.goto('/mercado')
    await expect(page.getByTestId('nft-card').first()).toBeVisible()

    await searchCatalog(page, 'Nomad')

    await expect(page).toHaveURL(/[?&]q=Nomad/)
    const expected = await expectedIds(page, { q: 'Nomad' })
    expect(expected.length).toBeGreaterThan(0)
    await expect.poll(() => cardIds(page)).toEqual(expected)
    for (const title of await page.getByTestId('nft-card').getByRole('heading').allInnerTexts()) {
      expect(title.toLowerCase()).toContain('nomad')
    }
  })

  test('filtros combinados (categoria + rede + preço), reset de página, refresh e histórico @mobile', async ({ page }) => {
    await page.goto('/mercado?page=2')
    await expect(page.getByTestId('pagination-page-2')).toHaveAttribute('aria-current', 'page')

    await openFiltersIfCollapsed(page)
    await page.getByTestId('filter-category-digital-art').click()
    // Mudar filtro volta para a página 1 (page some da URL).
    await expect(page).toHaveURL(/category=digital-art/)
    await expect(page).not.toHaveURL(/[?&]page=/)

    await page.getByTestId('filter-network-ethereum').click()
    await expect(page).toHaveURL(/network=ethereum/)

    await page.getByTestId('price-min').fill('0.01')
    await page.getByTestId('price-max').fill('5')
    await page.getByTestId('price-apply').click()
    await expect(page).toHaveURL(/minPrice=0\.01/)
    await expect(page).toHaveURL(/maxPrice=5/)
    await closeFiltersIfOpen(page)

    const combined = { category: 'digital-art', network: 'ethereum', minPrice: '0.01', maxPrice: '5' }
    const expected = await expectedIds(page, combined)
    await expect.poll(() => cardIds(page)).toEqual(expected)

    // Refresh mantém o estado (URL é a fonte da verdade).
    await page.reload()
    await expect.poll(() => cardIds(page)).toEqual(expected)
    await openFiltersIfCollapsed(page)
    await expect(page.getByTestId('filter-category-digital-art')).toBeChecked()
    await expect(page.getByTestId('filter-network-ethereum')).toBeChecked()
    await expect(page.getByTestId('price-min')).toHaveValue('0.01')
    await closeFiltersIfOpen(page)

    // Voltar restaura o estado anterior (sem faixa de preço); avançar restaura o combinado.
    const withoutPrice = await expectedIds(page, { category: 'digital-art', network: 'ethereum' })
    await page.goBack()
    await expect(page).not.toHaveURL(/minPrice=/)
    await expect(page).toHaveURL(/network=ethereum/)
    await expect.poll(() => cardIds(page)).toEqual(withoutPrice)

    await page.goForward()
    await expect(page).toHaveURL(/minPrice=0\.01/)
    await expect.poll(() => cardIds(page)).toEqual(expected)
  })

  test('ordenação por menor preço', async ({ page }) => {
    await page.goto('/mercado')
    await expect(page.getByTestId('nft-card').first()).toBeVisible()
    await selectSort(page, 'price_asc', 'Menor preço')
    await expect(page).toHaveURL(/sort=price_asc/)
    const expected = await expectedIds(page, { sort: 'price_asc' })
    await expect.poll(() => cardIds(page)).toEqual(expected)
  })

  test('paginação navega, reflete na URL e volta com o histórico', async ({ page }) => {
    await page.goto('/mercado')
    const page1 = await expectedIds(page, {})
    await expect.poll(() => cardIds(page)).toEqual(page1)

    await page.getByTestId('pagination-page-2').click()
    await expect(page).toHaveURL(/[?&]page=2/)
    const page2 = await expectedIds(page, { page: '2' })
    await expect.poll(() => cardIds(page)).toEqual(page2)
    await expect(page.getByTestId('pagination-page-2')).toHaveAttribute('aria-current', 'page')

    // Ordenar (mudança de filtro) reinicia a paginação.
    await selectSort(page, 'price_desc', 'Maior preço')
    await expect(page).toHaveURL(/sort=price_desc/)
    await expect(page).not.toHaveURL(/[?&]page=/)

    await page.goBack()
    await expect(page).toHaveURL(/[?&]page=2/)
    await expect.poll(() => cardIds(page)).toEqual(page2)
  })

  test('resultado vazio mostra estado vazio', async ({ page }) => {
    await page.goto('/mercado?q=zzzzzz')
    await expect(page.getByTestId('catalog-empty')).toBeVisible()
    await expect(page.getByTestId('nft-card')).toHaveCount(0)
  })

  test.describe('respostas fora de ordem', () => {
    test.use({ scenario: 'variable-latency' satisfies MockScenario, clock: {} })

    test('a grade final mostra o resultado do ÚLTIMO termo digitado', async ({ page }) => {
      // "Ape" (3, ímpar → 1800 ms) e depois "Beat" (4, par → 200 ms): a resposta de "Beat" chega antes.
      await page.goto('/mercado')
      await expect(page.getByTestId('nft-card').first()).toBeVisible()
      const apeIds = await expectedIds(page, { q: 'Ape' })
      const beatIds = await expectedIds(page, { q: 'Beat' })
      expect(apeIds).not.toEqual(beatIds)
      expect(beatIds.length).toBeGreaterThan(0)

      const slowRequest = page.waitForRequest((r) => r.url().includes('/api/nfts?') && new URL(r.url()).searchParams.get('q') === 'Ape')
      await searchCatalog(page, 'Ape')
      await slowRequest
      await searchCatalog(page, 'Beat')

      await expect(page).toHaveURL(/[?&]q=Beat/)
      await expect.poll(() => cardIds(page)).toEqual(beatIds)

      // Deixa a resposta lenta de "Ape" chegar (1800 ms no relógio controlado) e confirma que nada regrediu.
      await page.clock.runFor(2500)
      await expect.poll(() => cardIds(page)).toEqual(beatIds)
      await expect(page).toHaveURL(/[?&]q=Beat/)
    })
  })

  test.describe('falha do servidor', () => {
    test.use({ scenario: 'server-error' })

    test('5xx mostra mensagem e "Tentar novamente" recupera', async ({ page }) => {
      await page.goto('/mercado')
      const error = page.getByTestId('catalog-error')
      await expect(error).toBeVisible({ timeout: 20_000 })
      await expect(error).toContainText(/erro|não foi possível|tente novamente/i)

      await setScenario(page, 'default')
      await error.getByRole('button', { name: /tentar novamente/i }).click()
      await expect(page.getByTestId('catalog-error')).toBeHidden()
      await expect.poll(() => cardIds(page)).toEqual(await expectedIds(page, {}))
    })
  })

  test('URL inválida/manipulada não quebra a página', async ({ page }) => {
    await page.goto('/mercado?category=nao-existe&sort=xyz&page=abc&minPrice=-1')
    await expect(page.getByTestId('nft-card').first()).toBeVisible()
    expect((await apiRequest(page, 'GET', '/nfts?pageSize=1')).status).toBe(200)
  })
})

