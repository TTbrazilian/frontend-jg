# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: a11y-keyboard.spec.ts >> Acessibilidade — teclado >> fechar o diálogo de login devolve o foco ao gatilho "Entrar"
- Location: e2e\a11y-keyboard.spec.ts:71:3

# Error details

```
Error: expect(locator).toBeFocused() failed

Locator:  getByTestId('login-link')
Expected: focused
Received: inactive
Timeout:  3000ms

Call log:
  - Expect "toBeFocused" getByTestId('login-link') with timeout 3000ms
  - waiting for getByTestId('login-link')
    9 × locator resolved to <a data-testid="login-link" href="/login?redirect=%2F" class="inline-flex h-[35px] w-[100px] items-center justify-center gap-1 rounded-md bg-primary text-body-lg font-medium text-primary-foreground transition-colors hover:bg-brand-light active:bg-brand-dark">…</a>
      - unexpected value "inactive"

```

```yaml
- link "Entrar":
  - /url: /login?redirect=%2F
```

# Test source

```ts
  1   | import { test, expect } from './fixtures'
  2   | import type { Page } from '@playwright/test'
  3   | 
  4   | /** Pressiona Tab até o foco satisfazer o predicado (falha após `max` teclas). */
  5   | async function tabUntil(page: Page, predicate: (el: Element) => boolean, max = 60): Promise<void> {
  6   |   for (let i = 0; i < max; i++) {
  7   |     await page.keyboard.press('Tab')
  8   |     const ok = await page.evaluate((src) => {
  9   |       const el = document.activeElement
  10  |       return !!el && (new Function('el', `return (${src})(el)`) as (e: Element) => boolean)(el)
  11  |     }, predicate.toString())
  12  |     if (ok) return
  13  |   }
  14  |   throw new Error(`Foco não chegou ao alvo após ${max} Tabs`)
  15  | }
  16  | 
  17  | test.describe('Acessibilidade — teclado', () => {
  18  |   test('skip link é o primeiro foco e leva ao conteúdo principal', async ({ page }) => {
  19  |     await page.goto('/')
  20  |     await expect(page.getByTestId('nft-card').first()).toBeVisible()
  21  |     await page.keyboard.press('Tab')
  22  |     const skip = page.getByRole('link', { name: 'Pular para o conteúdo' })
  23  |     await expect(skip).toBeFocused()
  24  |     await expect(skip).toBeInViewport()
  25  |     await page.keyboard.press('Enter')
  26  |     await expect(page).toHaveURL(/#conteudo$/)
  27  |     await expect
  28  |       .poll(() => page.evaluate(() => !!document.activeElement && !!document.getElementById('conteudo')?.contains(document.activeElement)))
  29  |       .toBe(true)
  30  |     // O próximo Tab segue dentro do conteúdo (não volta ao header).
  31  |     await page.keyboard.press('Tab')
  32  |     expect(await page.evaluate(() => !!document.getElementById('conteudo')?.contains(document.activeElement))).toBe(true)
  33  |   })
  34  | 
  35  |   test('Tab até um card do catálogo e Enter abre o detalhe', async ({ page }) => {
  36  |     await page.goto('/mercado')
  37  |     await expect(page.getByTestId('catalog-grid').getByTestId('nft-card').first()).toBeVisible()
  38  |     await tabUntil(page, (el) => el.tagName === 'A' && !!el.closest('[data-testid="catalog-grid"] [data-testid="nft-card"]') && (el.getAttribute('href') ?? '').startsWith('/nft/'))
  39  |     const href = await page.evaluate(() => document.activeElement?.getAttribute('href'))
  40  |     // Foco visível (outline/ring) no elemento focado.
  41  |     const focusVisible = await page.evaluate(() => document.activeElement?.matches(':focus-visible'))
  42  |     expect(focusVisible).toBe(true)
  43  |     await page.keyboard.press('Enter')
  44  |     await expect(page).toHaveURL(new RegExp(`${href}$`))
  45  |     await expect(page.getByTestId('nft-detail')).toBeVisible()
  46  |   })
  47  | 
  48  |   test('diálogo de login prende o foco e fecha com ESC', async ({ page }) => {
  49  |     test.skip((page.viewportSize()?.width ?? 0) < 768, 'login é página cheia no mobile')
  50  |     await page.goto('/mercado')
  51  |     await expect(page.getByTestId('nft-card').first()).toBeVisible()
  52  |     const trigger = page.getByTestId('login-link')
  53  |     await trigger.focus()
  54  |     await page.keyboard.press('Enter')
  55  | 
  56  |     const dialog = page.getByTestId('auth-dialog')
  57  |     await expect(dialog).toBeVisible()
  58  |     await expect(dialog.getByTestId('login-email')).toBeFocused()
  59  |     // Foco preso: 25 Tabs (e Shift+Tab) nunca saem do diálogo.
  60  |     for (let i = 0; i < 25; i++) {
  61  |       await page.keyboard.press(i % 5 === 4 ? 'Shift+Tab' : 'Tab')
  62  |       expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true)
  63  |     }
  64  |     await page.keyboard.press('Escape')
  65  |     await expect(dialog).toBeHidden()
  66  |     await expect(page).toHaveURL(/\/mercado$/)
  67  |     // O foco não fica perdido no <body> após fechar.
  68  |     await expect.poll(() => page.evaluate(() => document.activeElement !== document.body && document.activeElement !== null)).toBe(true)
  69  |   })
  70  | 
  71  |   test('fechar o diálogo de login devolve o foco ao gatilho "Entrar"', async ({ page }) => {
  72  |     // BUG DA APLICAÇÃO (conhecido): o diálogo é a rota /login; ao fechar (ESC) a navegação desmonta o
  73  |     // diálogo e o foco vai para o <body> (em "/") ou para a seção do catálogo (em "/mercado"), não
  74  |     // para o link "Entrar" que abriu o diálogo. Remover `test.fail` após corrigir.
  75  |     test.fail()
  76  |     test.skip((page.viewportSize()?.width ?? 0) < 768, 'login é página cheia no mobile')
  77  |     await page.goto('/')
  78  |     await expect(page.getByTestId('nft-card').first()).toBeVisible()
  79  |     const trigger = page.getByTestId('login-link')
  80  |     await trigger.focus()
  81  |     await page.keyboard.press('Enter')
  82  |     await expect(page.getByTestId('auth-dialog')).toBeVisible()
  83  |     await page.keyboard.press('Escape')
  84  |     await expect(page.getByTestId('auth-dialog')).toBeHidden()
> 85  |     await expect(trigger).toBeFocused({ timeout: 3_000 })
      |                           ^ Error: expect(locator).toBeFocused() failed
  86  |   })
  87  | 
  88  |   test('erros de formulário ficam associados aos campos (aria-invalid + aria-describedby) e o foco vai ao 1º inválido', async ({ page }) => {
  89  |     await page.goto('/login')
  90  |     const form = page.getByTestId('login-form')
  91  |     await form.getByTestId('login-submit').click()
  92  |     const email = form.getByTestId('login-email')
  93  |     await expect(email).toHaveAttribute('aria-invalid', 'true')
  94  |     await expect(email).toHaveAccessibleDescription('Informe seu e-mail.')
  95  |     await expect(form.getByTestId('login-password')).toHaveAccessibleDescription('Informe sua senha.')
  96  |     await expect(email).toBeFocused()
  97  |     const describedBy = await email.getAttribute('aria-describedby')
  98  |     expect(describedBy).toBeTruthy()
  99  |     await expect(page.locator(`[id="${describedBy!.split(' ')[0]}"]`)).toHaveText('Informe seu e-mail.')
  100 | 
  101 |     // Corrigir remove o erro.
  102 |     await email.fill('ana@nft.dev')
  103 |     await expect(email).not.toHaveAttribute('aria-invalid', 'true')
  104 |   })
  105 | 
  106 |   test('drawer de filtros (mobile) prende o foco e fecha com ESC devolvendo o foco @mobile', async ({ page }) => {
  107 |     test.skip((page.viewportSize()?.width ?? 0) >= 768, 'drawer só existe no mobile')
  108 |     await page.goto('/mercado')
  109 |     await expect(page.getByTestId('nft-card').first()).toBeVisible()
  110 |     const button = page.getByTestId('mobile-filter-button')
  111 |     await button.click()
  112 |     const drawer = page.getByRole('dialog')
  113 |     await expect(drawer).toBeVisible()
  114 |     for (let i = 0; i < 15; i++) {
  115 |       await page.keyboard.press('Tab')
  116 |       expect(await drawer.evaluate((d) => d.contains(document.activeElement))).toBe(true)
  117 |     }
  118 |     await page.keyboard.press('Escape')
  119 |     await expect(drawer).toBeHidden()
  120 |     await expect(button).toBeFocused()
  121 |   })
  122 | })
  123 | 
```