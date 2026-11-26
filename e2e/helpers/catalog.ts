import { expect, type Page } from '@playwright/test'
import { apiRequest } from '../fixtures'

/** Mesmo tamanho de página do app (src/features/catalog/search.ts → PAGE_SIZE). */
export const CATALOG_PAGE_SIZE = 9

export type CatalogQuery = Partial<Record<'q' | 'tab' | 'category' | 'network' | 'minPrice' | 'maxPrice' | 'availability' | 'sort' | 'page', string>>

export function catalogParams(query: CatalogQuery): string {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== '') params.set(k, v)
  if (!params.has('sort')) params.set('sort', 'recent')
  if (!params.has('page')) params.set('page', '1')
  params.set('pageSize', String(CATALOG_PAGE_SIZE))
  return params.toString()
}

/** Ids esperados na grade para um estado do catálogo, segundo a própria API simulada. */
export async function expectedIds(page: Page, query: CatalogQuery): Promise<string[]> {
  const res = await apiRequest<{ items: Array<{ id: string }> }>(page, 'GET', `/nfts?${catalogParams(query)}`)
  if (res.status !== 200) throw new Error(`GET /nfts → ${res.status}`)
  return res.body.items.map((i) => i.id)
}

/** Ids dos cards exibidos na grade do catálogo (na ordem). */
export async function cardIds(page: Page): Promise<string[]> {
  return page
    .getByTestId('catalog-grid')
    .getByTestId('nft-card')
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-nft-id') ?? ''))
}

/**
 * Busca pelo header: no desktop o campo abre pelo ícone ("Abrir busca"); no mobile a barra
 * "Explorar coleções" está sempre visível. Envia com Enter.
 */
export async function searchCatalog(page: Page, term: string): Promise<void> {
  const input = page.getByTestId('search-input').filter({ visible: true }).first()
  if (!(await input.count())) await page.getByTestId('search-toggle').click()
  const field = page.getByTestId('search-input').filter({ visible: true }).first()
  await field.fill(term)
  await field.press('Enter')
}

/** No mobile os filtros ficam num drawer: abre se o filtro de categoria não estiver visível. */
export async function openFiltersIfCollapsed(page: Page): Promise<void> {
  const probe = page.getByTestId('filter-category-digital-art')
  if (await probe.isVisible()) return
  await page.getByTestId('mobile-filter-button').click()
  await expect(probe).toBeVisible()
}

export async function closeFiltersIfOpen(page: Page): Promise<void> {
  const dialog = page.getByRole('dialog')
  if (!(await dialog.isVisible())) return
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
}

/** Seleciona a ordenação (funciona com <select> nativo ou Select do Radix). */
export async function selectSort(page: Page, value: string, label: string): Promise<void> {
  const sort = page.getByTestId('catalog-sort')
  const tag = await sort.evaluate((el) => el.tagName)
  if (tag === 'SELECT') {
    await sort.selectOption(value)
    return
  }
  await sort.click()
  await page.getByRole('option', { name: label }).click()
}
