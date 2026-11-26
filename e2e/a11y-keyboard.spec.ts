import { test, expect } from './fixtures'
import type { Page } from '@playwright/test'

/** Pressiona Tab até o foco satisfazer o predicado (falha após `max` teclas). */
async function tabUntil(page: Page, predicate: (el: Element) => boolean, max = 60): Promise<void> {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab')
    const ok = await page.evaluate((src) => {
      const el = document.activeElement
      return !!el && (new Function('el', `return (${src})(el)`) as (e: Element) => boolean)(el)
    }, predicate.toString())
    if (ok) return
  }
  throw new Error(`Foco não chegou ao alvo após ${max} Tabs`)
}

test.describe('Acessibilidade — teclado', () => {
  test('skip link é o primeiro foco e leva ao conteúdo principal', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('nft-card').first()).toBeVisible()
    await page.keyboard.press('Tab')
    const skip = page.getByRole('link', { name: 'Pular para o conteúdo' })
    await expect(skip).toBeFocused()
    await expect(skip).toBeInViewport()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/#conteudo$/)
    await expect
      .poll(() => page.evaluate(() => !!document.activeElement && !!document.getElementById('conteudo')?.contains(document.activeElement)))
      .toBe(true)
    // O próximo Tab segue dentro do conteúdo (não volta ao header).
    await page.keyboard.press('Tab')
    expect(await page.evaluate(() => !!document.getElementById('conteudo')?.contains(document.activeElement))).toBe(true)
  })

  test('Tab até um card do catálogo e Enter abre o detalhe', async ({ page }) => {
    await page.goto('/mercado')
    await expect(page.getByTestId('catalog-grid').getByTestId('nft-card').first()).toBeVisible()
    await tabUntil(page, (el) => el.tagName === 'A' && !!el.closest('[data-testid="catalog-grid"] [data-testid="nft-card"]') && (el.getAttribute('href') ?? '').startsWith('/nft/'))
    const href = await page.evaluate(() => document.activeElement?.getAttribute('href'))
    // Foco visível (outline/ring) no elemento focado.
    const focusVisible = await page.evaluate(() => document.activeElement?.matches(':focus-visible'))
    expect(focusVisible).toBe(true)
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(new RegExp(`${href}$`))
    await expect(page.getByTestId('nft-detail')).toBeVisible()
  })

  test('diálogo de login prende o foco e fecha com ESC', async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) < 768, 'login é página cheia no mobile')
    await page.goto('/mercado')
    await expect(page.getByTestId('nft-card').first()).toBeVisible()
    const trigger = page.getByTestId('login-link')
    await trigger.focus()
    await page.keyboard.press('Enter')

    const dialog = page.getByTestId('auth-dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByTestId('login-email')).toBeFocused()
    // Foco preso: 25 Tabs (e Shift+Tab) nunca saem do diálogo.
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press(i % 5 === 4 ? 'Shift+Tab' : 'Tab')
      expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true)
    }
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(page).toHaveURL(/\/mercado$/)
    // O foco não fica perdido no <body> após fechar.
    await expect.poll(() => page.evaluate(() => document.activeElement !== document.body && document.activeElement !== null)).toBe(true)
  })

  test('fechar o diálogo de login devolve o foco ao gatilho "Entrar"', async ({ page }) => {
    // BUG DA APLICAÇÃO (conhecido): o diálogo é a rota /login; ao fechar (ESC) a navegação desmonta o
    // diálogo e o foco vai para o <body> (em "/") ou para a seção do catálogo (em "/mercado"), não
    // para o link "Entrar" que abriu o diálogo. Remover `test.fail` após corrigir.
    test.fail()
    test.skip((page.viewportSize()?.width ?? 0) < 768, 'login é página cheia no mobile')
    await page.goto('/')
    await expect(page.getByTestId('nft-card').first()).toBeVisible()
    const trigger = page.getByTestId('login-link')
    await trigger.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('auth-dialog')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('auth-dialog')).toBeHidden()
    await expect(trigger).toBeFocused({ timeout: 3_000 })
  })

  test('erros de formulário ficam associados aos campos (aria-invalid + aria-describedby) e o foco vai ao 1º inválido', async ({ page }) => {
    await page.goto('/login')
    const form = page.getByTestId('login-form')
    await form.getByTestId('login-submit').click()
    const email = form.getByTestId('login-email')
    await expect(email).toHaveAttribute('aria-invalid', 'true')
    await expect(email).toHaveAccessibleDescription('Informe seu e-mail.')
    await expect(form.getByTestId('login-password')).toHaveAccessibleDescription('Informe sua senha.')
    await expect(email).toBeFocused()
    const describedBy = await email.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    await expect(page.locator(`[id="${describedBy!.split(' ')[0]}"]`)).toHaveText('Informe seu e-mail.')

    // Corrigir remove o erro.
    await email.fill('ana@nft.dev')
    await expect(email).not.toHaveAttribute('aria-invalid', 'true')
  })

  test('drawer de filtros (mobile) prende o foco e fecha com ESC devolvendo o foco @mobile', async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) >= 768, 'drawer só existe no mobile')
    await page.goto('/mercado')
    await expect(page.getByTestId('nft-card').first()).toBeVisible()
    const button = page.getByTestId('mobile-filter-button')
    await button.click()
    const drawer = page.getByRole('dialog')
    await expect(drawer).toBeVisible()
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press('Tab')
      expect(await drawer.evaluate((d) => d.contains(document.activeElement))).toBe(true)
    }
    await page.keyboard.press('Escape')
    await expect(drawer).toBeHidden()
    await expect(button).toBeFocused()
  })
})
