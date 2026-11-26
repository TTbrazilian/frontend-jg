import { test, expect, USERS, apiRequest, generatePng, login, storedSession, toast } from './fixtures'
import type { Page } from '@playwright/test'

async function serverProfile(page: Page) {
  const res = await apiRequest<{ displayName: string; username: string; email: string; ensName: string | null; avatarUrl: string | null }>(
    page,
    'GET',
    '/me/profile',
  )
  expect(res.status).toBe(200)
  return res.body
}

test.describe('Conta — perfil', () => {
  test('editar perfil persiste no servidor e após refresh', async ({ page }) => {
    await login(page, USERS.ana, { redirect: '/perfil' })
    const form = page.getByTestId('profile-form')
    await expect(form.getByTestId('profile-displayName')).toHaveValue(USERS.ana.displayName)
    await expect(form.getByTestId('profile-save')).toBeDisabled()

    await form.getByLabel('Nome de exibição').fill('Ana Atualizada')
    await form.getByTestId('profile-ensName').fill('ana-nova')
    await form.getByTestId('profile-save').click()
    await expect(toast(page, /perfil atualizado/i)).toBeVisible()
    await expect(form.getByTestId('profile-save')).toBeDisabled()

    const saved = await serverProfile(page)
    expect(saved.displayName).toBe('Ana Atualizada')
    expect(saved.ensName).toBe('ana-nova')

    await page.reload()
    await expect(page.getByTestId('profile-displayName')).toHaveValue('Ana Atualizada')
    await expect(page.getByTestId('profile-ensName')).toHaveValue('ana-nova')
    // O nome novo também chega ao header (sessão atualizada).
    if ((page.viewportSize()?.width ?? 0) >= 768) await expect(page.getByTestId('user-menu-trigger').filter({ visible: true })).toContainText('Ana Atualizada')
  })

  test('validação do perfil: cliente e conflito do servidor no campo', async ({ page }) => {
    await login(page, USERS.ana, { redirect: '/perfil' })
    const form = page.getByTestId('profile-form')
    await expect(form.getByTestId('profile-username')).toHaveValue('ana')

    await form.getByTestId('profile-username').fill('Ana Com Espaço')
    await form.getByTestId('profile-email').fill('ana@')
    await form.getByTestId('profile-displayName').fill('A')
    await form.getByTestId('profile-save').click()
    await expect(form.getByTestId('profile-username')).toHaveAttribute('aria-invalid', 'true')
    await expect(form.getByTestId('profile-username')).toHaveAccessibleDescription(/3 a 20 caracteres/i)
    await expect(form.getByTestId('profile-email')).toHaveAccessibleDescription(/e-mail válido/i)
    await expect(form.getByTestId('profile-displayName')).toHaveAccessibleDescription(/pelo menos 2 caracteres/i)
    expect((await serverProfile(page)).username).toBe('ana')

    // Conflito: nome de usuário do Bruno.
    await form.getByTestId('profile-username').fill('bruno')
    await form.getByTestId('profile-email').fill(USERS.ana.email)
    await form.getByTestId('profile-displayName').fill(USERS.ana.displayName)
    await form.getByTestId('profile-save').click()
    await expect(form.getByTestId('profile-username')).toHaveAttribute('aria-invalid', 'true')
    await expect(form.getByTestId('profile-username')).toHaveAccessibleDescription(/(uso|já|outra conta)/i)
    expect((await serverProfile(page)).username).toBe('ana')
  })

  test('avatar: upload de PNG (buffer) com preview e remoção', async ({ page }) => {
    await login(page, USERS.bruno, { redirect: '/perfil' })
    await expect(page.getByTestId('profile-form')).toBeVisible()
    await expect(page.getByTestId('avatar-image')).toHaveCount(0)
    await expect(page.getByTestId('avatar-remove')).toBeDisabled()

    // Tipo inválido: erro associado, nada enviado.
    await page.getByTestId('avatar-input').setInputFiles({ name: 'notas.txt', mimeType: 'text/plain', buffer: Buffer.from('não é imagem') })
    await expect(page.getByTestId('avatar-input')).toHaveAccessibleDescription(/png, jpeg ou webp/i)
    await expect(page.getByTestId('profile-form').getByRole('alert').filter({ hasText: /use uma imagem png/i })).toBeVisible()

    await page.getByTestId('avatar-input').setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: generatePng(96, 96) })
    await expect(toast(page, /avatar atualizado/i)).toBeVisible()
    const img = page.getByTestId('avatar-image')
    await expect(img).toBeVisible()
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true)
    await expect.poll(async () => (await serverProfile(page)).avatarUrl).not.toBeNull()

    await page.reload()
    await expect(page.getByTestId('avatar-image')).toBeVisible()

    await page.getByTestId('avatar-remove').click()
    await expect(toast(page, /avatar removido/i)).toBeVisible()
    await expect(page.getByTestId('avatar-image')).toHaveCount(0)
    expect((await serverProfile(page)).avatarUrl).toBeNull()
  })

  test('alterar senha: atual incorreta mostra erro; sucesso permite login com a nova', async ({ page }) => {
    await login(page, USERS.bruno, { redirect: '/perfil' })
    const form = page.getByTestId('password-form')
    await form.getByTestId('password-current').fill('Errada123')
    await form.getByTestId('password-new').fill('NovaSenha456')
    await form.getByTestId('password-confirm').fill('NovaSenha456')
    await form.getByTestId('password-submit').click()
    await expect(form.getByTestId('password-current')).toHaveAttribute('aria-invalid', 'true')
    await expect(form.getByTestId('password-current')).toHaveAccessibleDescription(/senha atual incorreta/i)

    // Confirmação diferente (cliente)
    await form.getByTestId('password-current').fill(USERS.bruno.password)
    await form.getByTestId('password-confirm').fill('Outra789')
    await form.getByTestId('password-submit').click()
    await expect(form.getByTestId('password-confirm')).toHaveAccessibleDescription(/não coincidem/i)

    await form.getByTestId('password-confirm').fill('NovaSenha456')
    await form.getByTestId('password-submit').click()
    await expect(toast(page, /senha alterada/i)).toBeVisible()
    await expect(form.getByTestId('password-current')).toHaveValue('')
    // A sessão atual continua válida.
    expect((await apiRequest(page, 'GET', '/auth/session')).status).toBe(200)

    // A senha antiga deixa de funcionar e a nova funciona.
    const attempt = (password: string) =>
      page.evaluate(
        async ({ email, password }) => (await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })).status,
        { email: USERS.bruno.email, password },
      )
    expect(await attempt(USERS.bruno.password)).toBe(401)
    expect(await attempt('NovaSenha456')).toBe(200)
    expect(await storedSession(page)).not.toBeNull()
  })
})

interface WalletDto {
  id: string
  role: 'primary' | 'secondary'
  nickname: string
  address: string
  network: string
}

async function serverWallets(page: Page): Promise<WalletDto[]> {
  const res = await apiRequest<{ items: WalletDto[] }>(page, 'GET', '/me/wallets')
  expect(res.status).toBe(200)
  return res.body.items
}

test.describe('Conta — carteiras', () => {
  test('criar carteira secundária (validação, endereço repetido e sucesso)', async ({ page }) => {
    await login(page, USERS.bruno, { redirect: '/perfil/carteiras' })
    const primary = (await serverWallets(page)).find((w) => w.role === 'primary')!
    const section = page.getByTestId('wallet-section-secondary')
    await expect(section).toContainText(/ainda não adicionou/i)
    await section.getByRole('button', { name: /adicionar/i }).click()

    const form = page.getByTestId('wallet-form-secondary')
    await expect(form.getByTestId('wallet-displayName')).toBeFocused()
    // Envio vazio: erros no cliente, associados aos campos.
    await form.getByTestId('wallet-save').click()
    await expect(form.getByTestId('wallet-displayName')).toHaveAttribute('aria-invalid', 'true')
    await expect(form.getByTestId('wallet-address')).toHaveAccessibleDescription(/informe o endereço/i)

    await form.getByTestId('wallet-displayName').fill('Bruno Holder')
    await form.getByTestId('wallet-nickname').fill('Cofre')
    await form.getByTestId('wallet-network').selectOption('ethereum')
    await form.getByTestId('wallet-profileName').fill('Bruno Cofre')
    await form.getByTestId('wallet-address').fill('0x123')
    await form.getByTestId('wallet-provider').selectOption('metamask')
    await form.getByTestId('wallet-referralCode').fill('BRUNO2026')
    await form.getByTestId('wallet-email').fill('bruno.cofre@nft.dev')
    await form.getByTestId('wallet-ensName').fill('bruno-cofre')
    await form.getByTestId('wallet-save').click()
    await expect(form.getByTestId('wallet-address')).toHaveAccessibleDescription(/0x seguido de 40/i)

    // Endereço já cadastrado (o da principal) → conflito do servidor no campo.
    await form.getByTestId('wallet-address').fill(primary.address)
    await form.getByTestId('wallet-save').click()
    await expect(form.getByTestId('wallet-address')).toHaveAccessibleDescription(/já está cadastrado/i)
    expect(await serverWallets(page)).toHaveLength(1)

    const address = `0x${'ab12'.repeat(10)}`
    await form.getByTestId('wallet-address').fill(address)
    await form.getByTestId('wallet-save').click()
    await expect(toast(page, /carteira secundária adicionada/i)).toBeVisible()
    await expect(page.getByTestId('wallet-summary-secondary')).toContainText('Cofre')
    const wallets = await serverWallets(page)
    expect(wallets).toHaveLength(2)
    expect(wallets.find((w) => w.role === 'secondary')).toMatchObject({ nickname: 'Cofre', address })

    await page.reload()
    await expect(page.getByTestId('wallet-summary-secondary')).toContainText('Cofre')
  })

  test('editar carteira principal persiste; apelido inválido mostra erro', async ({ page }) => {
    await login(page, USERS.ana, { redirect: '/perfil/carteiras' })
    const section = page.getByTestId('wallet-section-primary')
    await expect(page.getByTestId('wallet-summary-primary')).toBeVisible()
    await section.getByRole('button', { name: /editar/i }).click()
    const form = page.getByTestId('wallet-form-primary')
    await expect(form.getByTestId('wallet-save')).toBeDisabled()

    await form.getByTestId('wallet-nickname').fill('A')
    await form.getByTestId('wallet-save').click()
    await expect(form.getByTestId('wallet-nickname')).toHaveAccessibleDescription(/pelo menos 2 caracteres/i)

    await form.getByTestId('wallet-nickname').fill('Principal Editada')
    await form.getByTestId('wallet-save').click()
    await expect(toast(page, /carteira principal atualizada/i)).toBeVisible()
    await expect(page.getByTestId('wallet-summary-primary')).toContainText('Principal Editada')
    expect((await serverWallets(page)).find((w) => w.role === 'primary')?.nickname).toBe('Principal Editada')
    // Foco volta ao "Editar" da seção.
    await expect(section.getByRole('button', { name: /editar/i })).toBeFocused()
  })

  test('editar principal com o endereço da secundária → erro de conflito no campo', async ({ page }) => {
    await login(page, USERS.ana, { redirect: '/perfil/carteiras' })
    const wallets = await serverWallets(page)
    const secondary = wallets.find((w) => w.role === 'secondary')!
    await page.getByTestId('wallet-section-primary').getByRole('button', { name: /editar/i }).click()
    const form = page.getByTestId('wallet-form-primary')
    await form.getByTestId('wallet-network').selectOption(secondary.network)
    await form.getByTestId('wallet-address').fill(secondary.address)
    await form.getByTestId('wallet-save').click()
    await expect(form.getByTestId('wallet-address')).toHaveAttribute('aria-invalid', 'true')
    await expect(form.getByTestId('wallet-address')).toHaveAccessibleDescription(/já está cadastrado/i)
    expect((await serverWallets(page)).find((w) => w.role === 'primary')?.address).toBe(wallets.find((w) => w.role === 'primary')?.address)
  })
})
