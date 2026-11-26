import { deflateSync } from 'node:zlib'
import { test as base, expect, type Locator, type Page } from '@playwright/test'

/**
 * Fixtures E2E da KURIO.
 *
 * Estado isolado por teste:
 * 1. contexto/página novos (padrão do Playwright);
 * 2. `addInitScript` limpa localStorage/sessionStorage do app UMA vez por aba (marcador em
 *    sessionStorage, para que `page.reload()` preserve o estado do próprio teste) e grava o
 *    cenário em `localStorage['nft-mock-scenario']`, que é o que `initScenario()` lê no boot;
 * 3. navega para uma rota leve, espera `window.__mock` e chama `POST /api/__mock/reset`
 *    DE DENTRO da página (o MSW roda na página; `request` do Playwright não passaria por ele);
 * 4. reaplica cenário/latência pedidos pelo teste (o reset volta ao default).
 *
 * Também instala uma sonda passiva de tempo real (`window.__e2eRealtime`): observa os eventos
 * despachados no WebSocket simulado do Socket.IO (CONNECT, `nft.updated`, `order.updated`) para
 * sabermos quando o cliente está conectado e quando um evento chegou. Não altera o app.
 */

export type MockScenario =
  | 'default'
  | 'empty-catalog'
  | 'slow-network'
  | 'variable-latency'
  | 'offline'
  | 'server-error'
  | 'session-expired'
  | 'unauthorized'
  | 'favorites-failure'
  | 'price-change-on-checkout'
  | 'sold-out-on-checkout'
  | 'order-timeout'
  | 'payment-declined'
  | 'wallet-rejected'

export interface SeedUser {
  email: string
  password: string
  displayName: string
  username: string
  id: string
}

/** Credenciais fictícias do seed do mock (públicas no README). */
export const USERS = {
  ana: { id: 'usr-ana', email: 'ana@nft.dev', password: 'Password123!', displayName: 'Ana Collector', username: 'ana' },
  bruno: { id: 'usr-bruno', email: 'bruno@nft.dev', password: 'Password123!', displayName: 'Bruno Holder', username: 'bruno' },
} satisfies Record<string, SeedUser>

export interface RealtimeProbe {
  connected: number
  connects: number
  nftEvents: number
  orderEvents: number
}

export interface ClockOption {
  /** Instante inicial do relógio falso (o tempo continua correndo, salvo `pauseAt`). */
  time?: string | number | Date
}

interface Options {
  scenario: MockScenario
  latencyMs: number | undefined
  /** Instala `page.clock` ANTES da primeira navegação. */
  clock: ClockOption | false
  /** Congela `Date.now()` (timers continuam reais) — usado nas capturas visuais. */
  fixedTime: string | false
}

const SCENARIO_KEY = 'nft-mock-scenario'
const ISOLATION_MARKER = '__e2e_isolated'

function initScript({ scenario, latencyMs, scenarioKey, marker }: { scenario: string; latencyMs: number | null; scenarioKey: string; marker: string }) {
  try {
    if (!window.sessionStorage.getItem(marker)) {
      window.localStorage.clear()
      window.sessionStorage.clear()
      window.localStorage.setItem(
        scenarioKey,
        JSON.stringify({ scenario, latencyMs: latencyMs ?? 300, orderResolutionMs: 1500, checkoutTriggered: [] }),
      )
      window.sessionStorage.setItem(marker, '1')
    }
  } catch {
    /* origem opaca (about:blank etc.) */
  }

  const w = window as unknown as { __e2eRealtime?: RealtimeProbe }
  if (w.__e2eRealtime) return
  const probe: RealtimeProbe = { connected: 0, connects: 0, nftEvents: 0, orderEvents: 0 }
  w.__e2eRealtime = probe
  const live = new WeakSet<object>()
  const original = EventTarget.prototype.dispatchEvent
  EventTarget.prototype.dispatchEvent = function patched(this: EventTarget, event: Event) {
    try {
      const self = this as unknown as { url?: unknown; readyState?: unknown }
      if (typeof self.readyState === 'number' && self.url && String(self.url).includes('/socket.io')) {
        if (event.type === 'message') {
          const data = (event as MessageEvent).data
          if (typeof data === 'string') {
            if (data.startsWith('40') && !live.has(this)) {
              live.add(this)
              probe.connected += 1
              probe.connects += 1
            } else if (data.startsWith('42["nft.updated"')) probe.nftEvents += 1
            else if (data.startsWith('42["order.updated"')) probe.orderEvents += 1
          }
        } else if (event.type === 'close' && live.has(this)) {
          live.delete(this)
          probe.connected -= 1
        }
      }
    } catch {
      /* sonda nunca quebra o app */
    }
    return original.call(this, event)
  }
}

export const test = base.extend<Options>({
  scenario: ['default', { option: true }],
  latencyMs: [undefined, { option: true }],
  clock: [false, { option: true }],
  fixedTime: [false, { option: true }],

  page: async ({ page, scenario, latencyMs, clock, fixedTime }, use) => {
    await page.addInitScript(initScript, { scenario, latencyMs: latencyMs ?? null, scenarioKey: SCENARIO_KEY, marker: ISOLATION_MARKER })
    if (clock) await page.clock.install(clock.time !== undefined ? { time: clock.time } : undefined)
    if (fixedTime) await page.clock.setFixedTime(fixedTime)
    // Rota leve (404 do app): sobe o MSW sem disparar a carga do catálogo.
    await page.goto('/__e2e-boot')
    await waitForMock(page)
    await mockControl(page, 'reset')
    if (scenario !== 'default') await setScenario(page, scenario)
    if (latencyMs !== undefined) await mockControl(page, 'latency', { latencyMs })
    // eslint-disable-next-line react-hooks/rules-of-hooks -- `use` é a API de fixtures do Playwright, não um hook React
    await use(page)
  },
})

export { expect }

// ---------------------------------------------------------------------------
// Controle do mock (sempre via página)
// ---------------------------------------------------------------------------

export async function waitForMock(page: Page): Promise<void> {
  await page.waitForFunction(() => !!(window as unknown as { __mock?: unknown }).__mock, undefined, { timeout: 20_000 })
}

/** `POST /api/__mock/<path>` (ou GET para `state`) executado dentro da página. */
export async function mockControl<T = unknown>(page: Page, path: string, body?: unknown): Promise<T> {
  await waitForMock(page)
  const result = await page.evaluate(
    async ({ path, body }) => {
      const method = path === 'state' ? 'GET' : 'POST'
      const res = await fetch(`/api/__mock/${path.replace(/^\/+/, '')}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: method === 'GET' ? undefined : JSON.stringify(body ?? {}),
      })
      const text = await res.text()
      return { status: res.status, text }
    },
    { path, body },
  )
  if (result.status >= 400) throw new Error(`mockControl ${path} → ${result.status}: ${result.text}`)
  return (result.text ? JSON.parse(result.text) : undefined) as T
}

export async function setScenario(page: Page, scenario: MockScenario): Promise<void> {
  await mockControl(page, 'scenario', { scenario })
}

export interface ApiResult<T> {
  status: number
  body: T
}

/**
 * Chamada à API simulada feita DENTRO da página com a identidade atual do app
 * (Bearer de `nft.session` e `X-Guest-Cart-Id`), como o próprio cliente faria.
 * Usada para preparar dados (seedCart) e para verificar resultados (ex.: nº de pedidos).
 */
export async function apiRequest<T = unknown>(page: Page, method: string, path: string, body?: unknown): Promise<ApiResult<T>> {
  // Após uma navegação o Service Worker do MSW só intercepta depois do boot do app.
  await waitForMock(page)
  return page.evaluate(
    async ({ method, path, body }) => {
      const read = (k: string) => {
        try {
          const raw = localStorage.getItem(k)
          return raw ? JSON.parse(raw) : null
        } catch {
          return null
        }
      }
      let guest = read('nft.guestCartId') as string | null
      if (!guest) {
        guest = `guest_${crypto.randomUUID()}`
        localStorage.setItem('nft.guestCartId', JSON.stringify(guest))
      }
      const session = read('nft.session') as { token?: string } | null
      const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Guest-Cart-Id': guest }
      if (session?.token) headers.Authorization = `Bearer ${session.token}`
      const res = await fetch(`/api${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
      const text = await res.text()
      return { status: res.status, body: text ? JSON.parse(text) : null }
    },
    { method, path, body },
  ) as Promise<ApiResult<T>>
}

// ---------------------------------------------------------------------------
// Dados do catálogo (lidos da API simulada)
// ---------------------------------------------------------------------------

export interface EditionInfo {
  id: string
  label: string
  priceEth: string
  supply: number
  available: number
  maxPerOrder: number
  status: 'available' | 'sold_out' | 'unavailable'
}

export interface NftInfo {
  id: string
  title: string
  minPriceEth: string
  network: string
  category: string
  editions: EditionInfo[]
  version: number
}

export async function getNft(page: Page, nftId: string): Promise<NftInfo> {
  const res = await apiRequest<NftInfo>(page, 'GET', `/nfts/${nftId}`)
  if (res.status !== 200) throw new Error(`GET /nfts/${nftId} → ${res.status}`)
  return res.body
}

/** Primeira edição vendável com pelo menos `minAvailable` unidades. */
export function buyableEdition(nft: NftInfo, minAvailable = 1): EditionInfo {
  const ed = nft.editions.find((e) => e.status === 'available' && e.available >= minAvailable)
  if (!ed) throw new Error(`${nft.id} não tem edição com ${minAvailable}+ unidades`)
  return ed
}

/** Procura no seed um NFT que satisfaça o predicado (varre nft-001…nft-048). */
export async function findNft(page: Page, predicate: (nft: NftInfo) => boolean, ids = seedIds()): Promise<NftInfo> {
  for (const id of ids) {
    const nft = await getNft(page, id)
    if (predicate(nft)) return nft
  }
  throw new Error('Nenhum NFT do seed satisfaz o predicado')
}

export function seedIds(): string[] {
  return Array.from({ length: 48 }, (_, i) => `nft-${String(i + 1).padStart(3, '0')}`)
}

export interface SeedCartItem {
  nftId: string
  editionId?: string
  quantity?: number
}

/**
 * Prepara o carrinho no servidor simulado (visitante ou usuário logado, conforme a identidade
 * atual da página). Navegue/recarregue depois para o app buscar o carrinho.
 */
export async function seedCart(page: Page, items: SeedCartItem[]): Promise<void> {
  for (const item of items) {
    const quantity = item.quantity ?? 1
    const editionId = item.editionId ?? buyableEdition(await getNft(page, item.nftId), quantity).id
    const res = await apiRequest(page, 'POST', '/cart/items', { nftId: item.nftId, editionId, quantity })
    if (res.status >= 400) throw new Error(`seedCart ${item.nftId} → ${res.status}: ${JSON.stringify(res.body)}`)
  }
}

export async function listOrders(page: Page): Promise<Array<{ id: string; status: string; totalEth: string; txHash: string | null }>> {
  const res = await apiRequest<{ items: Array<{ id: string; status: string; totalEth: string; txHash: string | null }> }>(page, 'GET', '/orders')
  if (res.status !== 200) throw new Error(`GET /orders → ${res.status}`)
  return res.body.items
}

// ---------------------------------------------------------------------------
// Tempo real
// ---------------------------------------------------------------------------

export async function realtimeProbe(page: Page): Promise<RealtimeProbe> {
  return page.evaluate(() => ({ ...(window as unknown as { __e2eRealtime: RealtimeProbe }).__e2eRealtime }))
}

/** Espera o cliente Socket.IO concluir o CONNECT (opcionalmente, uma N-ésima conexão). */
export async function waitForSocketConnected(page: Page, { minConnects = 1 }: { minConnects?: number } = {}): Promise<void> {
  await page.waitForFunction(
    (min) => {
      const p = (window as unknown as { __e2eRealtime?: RealtimeProbe }).__e2eRealtime
      return !!p && p.connected > 0 && p.connects >= min
    },
    minConnects,
    { timeout: 15_000 },
  )
}

/** Espera o cliente receber mais eventos `nft.updated` do que `before`. */
export async function waitForNftEvents(page: Page, before: number, count = 1): Promise<void> {
  await page.waitForFunction(
    ({ target }) => ((window as unknown as { __e2eRealtime?: RealtimeProbe }).__e2eRealtime?.nftEvents ?? 0) >= target,
    { target: before + count },
    { timeout: 10_000 },
  )
}

// ---------------------------------------------------------------------------
// Fluxos de UI
// ---------------------------------------------------------------------------

/** Login pela UI (página /login). Se `redirect` for dado, usa `/login?redirect=`. */
export async function login(page: Page, user: SeedUser, { redirect, navigate = true }: { redirect?: string; navigate?: boolean } = {}): Promise<void> {
  if (navigate) await page.goto(redirect ? `/login?redirect=${encodeURIComponent(redirect)}` : '/login')
  const form = page.getByTestId('login-form')
  await expect(form).toBeVisible()
  await form.getByTestId('login-email').fill(user.email)
  await form.getByTestId('login-password').fill(user.password)
  await form.getByTestId('login-submit').click()
  await expect(form).toBeHidden({ timeout: 10_000 })
  await expect.poll(async () => (await storedSession(page))?.user.email).toBe(user.email)
}

export async function logout(page: Page): Promise<void> {
  await openUserMenu(page)
  await page.getByRole('menuitem', { name: /sair/i }).click()
  await expect(page.getByTestId('user-menu-trigger')).toHaveCount(0)
  await expect.poll(() => storedSession(page)).toBeNull()
}

export function cartBadge(page: Page): Locator {
  return page.getByTestId('cart-badge')
}

/** Viewport < 768px (layout mobile do app). */
export function isMobile(page: Page): boolean {
  return (page.viewportSize()?.width ?? 1440) < 768
}

/** Toast visual (sonner) com o texto dado. */
export function toast(page: Page, text: string | RegExp): Locator {
  return page.locator('[data-sonner-toast]').filter({ hasText: text }).first()
}

/** Abre o menu da conta (header desktop ou aba "Perfil" da tab bar mobile). */
export async function openUserMenu(page: Page): Promise<void> {
  await page.getByTestId('user-menu-trigger').filter({ visible: true }).first().click()
  await expect(page.getByRole('menu')).toBeVisible()
}

/** Carrinho atual (identidade da página) lido da API simulada. */
export async function getCart(page: Page): Promise<{ id: string; itemCount: number; coupon: { code: string } | null; items: Array<{ id: string; nftId: string; editionId: string; quantity: number; unitPriceEth: string; status: string }> }> {
  const res = await apiRequest<Awaited<ReturnType<typeof getCart>>>(page, 'GET', '/cart')
  if (res.status !== 200) throw new Error(`GET /cart → ${res.status}`)
  return res.body
}

/** Sessão persistida pelo app (null quando anônimo). */
export async function storedSession(page: Page): Promise<{ token: string; user: { id: string; email: string } } | null> {
  return page.evaluate(() => {
    try {
      return JSON.parse(localStorage.getItem('nft.session') ?? 'null')
    } catch {
      return null
    }
  })
}

/**
 * Espera fontes prontas e TODAS as imagens decodificadas (screenshots de página inteira estáveis).
 * Imagens `loading="lazy"` fora da viewport nunca carregariam numa captura fullPage; por isso são
 * promovidas a `eager` (apenas atributo de carregamento — não altera dados nem estado do app).
 */
export async function waitForImagesAndFonts(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready
    const imgs = Array.from(document.images)
    for (const img of imgs) if (img.loading === 'lazy') img.loading = 'eager'
    await Promise.all(
      imgs.map(
        (img) =>
          new Promise<void>((resolve) => {
            const done = () => void img.decode().catch(() => undefined).finally(() => resolve())
            if (img.complete) return done()
            img.addEventListener('load', done, { once: true })
            img.addEventListener('error', () => resolve(), { once: true })
          }),
      ),
    )
  })
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(buf: Buffer): number {
  let c = 0xffffffff
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

/**
 * Gera em memória um PNG RGB válido (gradiente simples) — usado no upload de avatar via
 * `setInputFiles({ name, mimeType, buffer })`, sem arquivos no disco.
 */
export function generatePng(width = 64, height = 64): Buffer {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8 // profundidade
  header[9] = 2 // RGB
  const raw = Buffer.alloc((width * 3 + 1) * height)
  for (let y = 0; y < height; y++) {
    const row = y * (width * 3 + 1)
    raw[row] = 0 // filtro "none"
    for (let x = 0; x < width; x++) {
      const o = row + 1 + x * 3
      raw[o] = 255
      raw[o + 1] = Math.round((x / width) * 160)
      raw[o + 2] = Math.round((y / height) * 120)
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

/** Converte "1,234.5 ETH" / "0.0055 ETH" em number (apenas para comparações nos testes). */
export function parseEth(text: string | null): number {
  const m = (text ?? '').replace(/,/g, '').match(/(\d+(?:\.\d+)?)/)
  return m ? Number(m[1]) : NaN
}
