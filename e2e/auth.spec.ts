import { test, expect, USERS, apiRequest, getCart, listOrders, login, logout, mockControl, openUserMenu, seedCart, storedSession, toast } from './fixtures'
import { connectWallet, gotoCheckout, placeOrder } from './helpers/flows'

test.describe('Autenticação', () => {
  test('cadastro cria a conta, autentica e leva ao destino @mobile', async ({ page }) => {
    await page.goto('/cadastro')
    const form = page.getByTestId('register-form')
    await expect(form).toBeVisible()
    await form.getByTestId('register-username').fill('nova_colecionadora')
    await form.getByTestId('register-email').fill('nova@nft.dev')
    await form.getByTestId('register-password').fill('Segura123')
    await form.getByTestId('register-confirm').fill('Segura123')
    await form.getByTestId('register-submit').click()

    await expect(form).toBeHidden({ timeout: 10_000 })
    await expect(page).toHaveURL(/\/$/)
    await expect(toast(page, /conta criada/i)).toBeVisible()
    await expect.poll(async () => (await storedSession(page))?.user.email).toBe('nova@nft.dev')
    const me = await apiRequest<{ user: { username: string } }>(page, 'GET', '/auth/session')
    expect(me.status).toBe(200)
    expect(me.body.user.username).toBe('nova_colecionadora')
  })

  test('cadastro com e-mail já usado (bruno@nft.dev) mostra erro no campo', async ({ page }) => {
    await page.goto('/cadastro')
    const form = page.getByTestId('register-form')
    await form.getByTestId('register-username').fill('outro_bruno')
    await form.getByTestId('register-email').fill(USERS.bruno.email)
    await form.getByTestId('register-password').fill('Segura123')
    await form.getByTestId('register-confirm').fill('Segura123')
    await form.getByTestId('register-submit').click()

    const email = form.getByTestId('register-email')
    await expect(email).toHaveAttribute('aria-invalid', 'true')
    await expect(email).toHaveAccessibleDescription(/(já|em uso|cadastrad)/i)
    expect(await storedSession(page)).toBeNull()
    await expect(form).toBeVisible()
  })

  test('validação do cadastro no cliente (campos vazios, senha fraca, confirmação diferente)', async ({ page }) => {
    await page.goto('/cadastro')
    const form = page.getByTestId('register-form')
    const requests: string[] = []
    page.on('request', (r) => {
      if (r.url().includes('/api/auth/register')) requests.push(r.url())
    })

    await form.getByTestId('register-submit').click()
    await expect(form.getByTestId('register-username')).toHaveAccessibleDescription(/informe um nome de usuário/i)
    await expect(form.getByTestId('register-email')).toHaveAccessibleDescription(/informe seu e-mail/i)
    await expect(form.getByTestId('register-password')).toHaveAttribute('aria-invalid', 'true')

    await form.getByTestId('register-username').fill('Nome Com Espaço')
    await form.getByTestId('register-email').fill('nao-e-email')
    await form.getByTestId('register-password').fill('curta')
    await form.getByTestId('register-confirm').fill('outra')
    await form.getByTestId('register-submit').click()
    await expect(form.getByTestId('register-username')).toHaveAccessibleDescription(/3 a 20 caracteres/i)
    await expect(form.getByTestId('register-email')).toHaveAccessibleDescription(/e-mail válido/i)
    await expect(form.getByTestId('register-password')).toHaveAccessibleDescription(/pelo menos 8 caracteres/i)
    await expect(form.getByTestId('register-confirm')).toHaveAccessibleDescription(/não coincidem/i)
    expect(requests).toHaveLength(0)
  })

  test('login com credenciais inválidas mostra erro e não autentica @mobile', async ({ page }) => {
    await page.goto('/login')
    const form = page.getByTestId('login-form')
    await form.getByTestId('login-email').fill(USERS.ana.email)
    await form.getByTestId('login-password').fill('SenhaErrada1')
    await form.getByTestId('login-submit').click()
    await expect(form.getByTestId('login-error')).toContainText(/e-mail ou senha incorretos/i)
    await expect(form.getByTestId('login-password')).toBeFocused()
    expect(await storedSession(page)).toBeNull()
  })

  test('login com sucesso @mobile', async ({ page }) => {
    await login(page, USERS.ana)
    await expect(page).toHaveURL(/\/$/)
    await expect(toast(page, /bem-vindo\(a\), ana collector/i)).toBeVisible()
  })

  test('rota protegida leva ao login e volta ao fluxo via ?redirect', async ({ page }) => {
    await page.goto('/perfil/carteiras')
    await expect(page).toHaveURL(/\/login\?redirect=%2Fperfil%2Fcarteiras/)
    await login(page, USERS.ana, { navigate: false })
    await expect(page).toHaveURL(/\/perfil\/carteiras$/)
  })

  test('redirect externo é ignorado (vai para o início)', async ({ page }) => {
    await login(page, USERS.ana, { redirect: '//evil.example.com' })
    await expect(page).toHaveURL(/^http:\/\/localhost:\d+\/$/)
  })

  test('sessão expira durante a navegação: diálogo pede re-login e a página continua', async ({ page }) => {
    await login(page, USERS.ana, { redirect: '/perfil' })
    await expect(page.getByTestId('profile-form')).toBeVisible()

    await mockControl(page, 'sessions/expire')
    // Navegar para outra área privada dispara a requisição com o token revogado → 401 SESSION_EXPIRED.
    await page.getByRole('navigation', { name: /meu perfil/i }).getByRole('link', { name: 'Carteiras' }).click()
    const dialog = page.getByTestId('session-expired-dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByTestId('login-email')).toHaveValue(USERS.ana.email)
    await expect(dialog.getByTestId('login-password')).toBeFocused()

    await dialog.getByTestId('login-password').fill(USERS.ana.password)
    await dialog.getByTestId('session-expired-submit').click()
    await expect(dialog).toBeHidden()
    await expect(page).toHaveURL(/\/perfil\/carteiras$/)
    await expect(toast(page, /sessão renovada/i)).toBeVisible()
    await expect.poll(async () => (await apiRequest(page, 'GET', '/me/wallets')).status).toBe(200)
  })

  test('sessão expirada: "Sair" no diálogo encerra a sessão', async ({ page }) => {
    await login(page, USERS.ana, { redirect: '/perfil' })
    await expect(page.getByTestId('profile-form')).toBeVisible()
    await mockControl(page, 'sessions/expire')
    await page.reload()
    const dialog = page.getByTestId('session-expired-dialog')
    await expect(dialog).toBeVisible()
    // ESC não fecha (a página não segue com sessão inválida).
    await page.keyboard.press('Escape')
    await expect(dialog).toBeVisible()
    await dialog.getByTestId('session-expired-logout').click()
    await expect(dialog).toBeHidden()
    await expect(page).toHaveURL(/\/$/)
    expect(await storedSession(page)).toBeNull()
  })

  test('logout limpa a sessão e protege as rotas privadas @mobile', async ({ page }) => {
    await login(page, USERS.ana)
    await logout(page)
    await expect(page).toHaveURL(/\/$/)
    await page.goto('/perfil')
    await expect(page).toHaveURL(/\/login\?redirect=%2Fperfil/)
  })

  test('troca de usuário Ana → Bruno não vaza dados (favoritos, carrinho, perfil)', async ({ page }) => {
    await login(page, USERS.ana)
    await seedCart(page, [{ nftId: 'nft-001' }])
    await page.goto('/perfil/favoritos')
    await expect(page.getByTestId('nft-card')).toHaveCount(2)
    await logout(page)

    await login(page, USERS.bruno)
    await openUserMenu(page)
    await expect(page.getByRole('menu')).toContainText('@bruno')
    await expect(page.getByRole('menu')).not.toContainText('@ana')
    await page.keyboard.press('Escape')

    await page.goto('/perfil/favoritos')
    await expect(page.getByRole('heading', { name: /lista de interesse/i })).toBeVisible()
    await expect(page.getByTestId('nft-card')).toHaveCount(0)
    await page.goto('/carrinho')
    await expect(page.getByTestId('cart-empty')).toBeVisible()
    await page.goto('/perfil')
    await expect(page.getByTestId('profile-email')).toHaveValue(USERS.bruno.email)
    await expect(page.locator('body')).not.toContainText(USERS.ana.email)
    await expect(page.locator('body')).not.toContainText(USERS.ana.displayName)

    expect((await getCart(page)).items).toHaveLength(0)
    const favs = await apiRequest<{ nftIds: string[] }>(page, 'GET', '/me/favorites')
    expect(favs.body.nftIds).toEqual([])
    // Nada da sessão da Ana sobra no armazenamento local.
    const leftovers = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.includes('usr-ana')))
    expect(leftovers).toEqual([])
  })

  test('sessão expirada + re-login como outro usuário descarta os dados do anterior', async ({ page }) => {
    await login(page, USERS.ana, { redirect: '/perfil' })
    await expect(page.getByTestId('profile-email')).toHaveValue(USERS.ana.email)
    await mockControl(page, 'sessions/expire')
    await page.reload()
    const dialog = page.getByTestId('session-expired-dialog')
    await expect(dialog).toBeVisible()
    await dialog.getByTestId('login-email').fill(USERS.bruno.email)
    await dialog.getByTestId('login-password').fill(USERS.bruno.password)
    await dialog.getByTestId('session-expired-submit').click()
    await expect(dialog).toBeHidden()
    await expect(page).toHaveURL(/\/$/)
    await expect(toast(page, /entrou como bruno holder/i)).toBeVisible()
    await page.goto('/perfil')
    await expect(page.getByTestId('profile-email')).toHaveValue(USERS.bruno.email)
  })

  test('sessão expira no pagamento: re-login mantém a página e o formulário, e a compra continua', async ({ page }) => {
    await login(page, USERS.ana)
    await seedCart(page, [{ nftId: 'nft-001' }])
    await gotoCheckout(page)
    const note = page.getByTestId('field-note')
    await note.fill('Presente de aniversário')

    await mockControl(page, 'sessions/expire')
    // Próxima chamada autenticada (conectar carteira) recebe 401 SESSION_EXPIRED.
    await page.getByTestId('wallet-connect').filter({ visible: true }).first().click()
    const dialog = page.getByTestId('session-expired-dialog')
    await expect(dialog).toBeVisible()
    await expect(page.getByTestId('confirm-purchase-reason')).toContainText(/sessão expirou/i)

    await dialog.getByTestId('login-password').fill(USERS.ana.password)
    await dialog.getByTestId('session-expired-submit').click()
    await expect(dialog).toBeHidden()
    await expect(page).toHaveURL(/\/pagamento$/)
    await expect(note).toHaveValue('Presente de aniversário')
    await expect(page.getByTestId('checkout-line')).toHaveCount(1)

    await connectWallet(page)
    expect(await listOrders(page)).toHaveLength(0)
    const orderId = await placeOrder(page)
    expect((await listOrders(page)).map((o) => o.id)).toEqual([orderId])
  })
})
