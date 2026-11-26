import { test, expect, findNft, getNft } from './fixtures'

test.describe('Detalhe do NFT', () => {
  test('acesso direto por URL mostra o NFT @mobile', async ({ page }) => {
    await page.goto('/nft/nft-001')
    const detail = page.getByTestId('nft-detail')
    await expect(detail).toBeVisible()
    const nft = await getNft(page, 'nft-001')
    await expect(detail.getByRole('heading', { level: 1 })).toHaveText(nft.title)
    await expect(page.getByTestId('related-nfts')).toBeVisible()
  })

  test('NFT inexistente mostra estado "não encontrado"', async ({ page }) => {
    await page.goto('/nft/nft-999')
    await expect(page.getByTestId('nft-not-found')).toBeVisible()
    await expect(page.getByTestId('nft-detail')).toHaveCount(0)
  })

  test('rota inexistente mostra a página 404', async ({ page }) => {
    await page.goto('/rota/que/nao/existe')
    await expect(page.getByRole('heading', { name: /não encontrad|404/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /início|voltar|mercado|explorar/i }).first()).toBeVisible()
  })

  test('edição indisponível fica desabilitada e não pode ser escolhida', async ({ page }) => {
    await page.goto('/nft/nft-001')
    const nft = await findNft(page, (n) => n.editions.some((e) => e.status !== 'available') && n.editions.some((e) => e.status === 'available' && e.available > 0))
    const blocked = nft.editions.find((e) => e.status !== 'available')!
    await page.goto(`/nft/${nft.id}`)
    const chip = page.getByTestId(`edition-option-${blocked.id}`)
    await expect(chip).toBeVisible()
    await expect(chip).toHaveAttribute('aria-disabled', 'true')
    await chip.click({ force: true })
    await expect(chip).toHaveAttribute('aria-checked', 'false')
  })

  test('quantidade é limitada ao máximo permitido @mobile', async ({ page }) => {
    await page.goto('/nft/nft-001')
    const nft = await findNft(page, (n) => n.editions.some((e) => e.status === 'available' && Math.min(e.maxPerOrder, e.available) >= 2))
    const edition = nft.editions.find((e) => e.status === 'available' && Math.min(e.maxPerOrder, e.available) >= 2)!
    const limit = Math.min(edition.maxPerOrder, edition.available)

    await page.goto(`/nft/${nft.id}`)
    await page.getByTestId(`edition-option-${edition.id}`).click()
    await expect(page.getByTestId(`edition-option-${edition.id}`)).toHaveAttribute('aria-checked', 'true')

    const inc = page.getByTestId('quantity-increment').first()
    const value = page.getByTestId('quantity-value').first()
    await expect(value).toHaveValue('1')
    for (let i = 1; i < limit; i++) await inc.click()
    await expect(value).toHaveValue(String(limit))
    await expect(inc).toBeDisabled()
    // Digitar acima do limite volta ao máximo.
    await value.fill(String(limit + 5))
    await value.press('Enter')
    await expect(value).toHaveValue(String(limit))
  })
})
