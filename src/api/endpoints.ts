import { http } from './http'
import type {
  AddCartItemRequest,
  ApplyCouponRequest,
  Cart,
  ChangePasswordRequest,
  CreateOrderRequest,
  CreateWalletRequest,
  FavoritesResponse,
  FeaturedResponse,
  NftSummary,
  LoginRequest,
  MergeCartRequest,
  MockScenario,
  MockState,
  Nft,
  NftListParams,
  NftListResponse,
  Order,
  OrdersResponse,
  Quote,
  QuoteRequest,
  RegisterRequest,
  Session,
  UpdateCartItemRequest,
  UpdateProfileRequest,
  UpdateWalletRequest,
  User,
  Wallet,
  WalletConnectRequest,
  WalletConnection,
} from './contracts'

type Opts = { signal?: AbortSignal }

/** Serializa filtros em query string estável (arrays como CSV). */
export function serializeNftParams(params: NftListParams): Record<string, string> {
  const out: Record<string, string> = {}
  if (params.q) out.q = params.q
  if (params.tab && params.tab !== 'all') out.tab = params.tab
  if (params.network?.length) out.network = [...params.network].sort().join(',')
  if (params.category?.length) out.category = [...params.category].sort().join(',')
  if (params.minPrice) out.minPrice = params.minPrice
  if (params.maxPrice) out.maxPrice = params.maxPrice
  if (params.availability && params.availability !== 'all') out.availability = params.availability
  if (params.sort) out.sort = params.sort
  if (params.page) out.page = String(params.page)
  if (params.pageSize) out.pageSize = String(params.pageSize)
  return out
}

export const api = {
  auth: {
    register: (body: RegisterRequest) => http.post<Session>('/auth/register', body).then((r) => r.data),
    login: (body: LoginRequest) => http.post<Session>('/auth/login', body).then((r) => r.data),
    session: ({ signal }: Opts = {}) => http.get<Session>('/auth/session', { signal }).then((r) => r.data),
    logout: () => http.post<void>('/auth/logout').then(() => undefined),
  },
  nfts: {
    list: (params: NftListParams, { signal }: Opts = {}) =>
      http.get<NftListResponse>('/nfts', { params: serializeNftParams(params), signal }).then((r) => r.data),
    featured: ({ signal }: Opts = {}) => http.get<FeaturedResponse>('/nfts/featured', { signal }).then((r) => r.data),
    detail: (id: string, { signal }: Opts = {}) => http.get<Nft>(`/nfts/${encodeURIComponent(id)}`, { signal }).then((r) => r.data),
    related: (id: string, { signal }: Opts = {}) =>
      http.get<{ items: NftSummary[] }>(`/nfts/${encodeURIComponent(id)}/related`, { signal }).then((r) => r.data),
  },
  favorites: {
    list: ({ signal }: Opts = {}) => http.get<FavoritesResponse>('/me/favorites', { signal }).then((r) => r.data),
    add: (nftId: string) => http.put<void>(`/me/favorites/${encodeURIComponent(nftId)}`).then(() => undefined),
    remove: (nftId: string) => http.delete<void>(`/me/favorites/${encodeURIComponent(nftId)}`).then(() => undefined),
  },
  cart: {
    get: ({ signal }: Opts = {}) => http.get<Cart>('/cart', { signal }).then((r) => r.data),
    addItem: (body: AddCartItemRequest) => http.post<Cart>('/cart/items', body).then((r) => r.data),
    updateItem: (itemId: string, body: UpdateCartItemRequest) => http.patch<Cart>(`/cart/items/${itemId}`, body).then((r) => r.data),
    removeItem: (itemId: string) => http.delete<Cart>(`/cart/items/${itemId}`).then((r) => r.data),
    applyCoupon: (body: ApplyCouponRequest) => http.put<Cart>('/cart/coupon', body).then((r) => r.data),
    removeCoupon: () => http.delete<Cart>('/cart/coupon').then((r) => r.data),
    merge: (body: MergeCartRequest) => http.post<Cart>('/cart/merge', body).then((r) => r.data),
    acknowledge: () => http.post<Cart>('/cart/acknowledge').then((r) => r.data),
  },
  quotes: {
    create: (body: QuoteRequest, { signal }: Opts = {}) => http.post<Quote>('/quotes', body, { signal }).then((r) => r.data),
  },
  orders: {
    create: (body: CreateOrderRequest, idempotencyKey: string) =>
      http.post<Order>('/orders', body, { headers: { 'Idempotency-Key': idempotencyKey }, timeout: 6_000 }).then((r) => r.data),
    get: (id: string, { signal }: Opts = {}) => http.get<Order>(`/orders/${encodeURIComponent(id)}`, { signal }).then((r) => r.data),
    list: ({ signal }: Opts = {}) => http.get<OrdersResponse>('/orders', { signal }).then((r) => r.data),
  },
  profile: {
    get: ({ signal }: Opts = {}) => http.get<User>('/me/profile', { signal }).then((r) => r.data),
    update: (body: UpdateProfileRequest) => http.patch<User>('/me/profile', body).then((r) => r.data),
    uploadAvatar: (file: File) => {
      const form = new FormData()
      form.append('avatar', file)
      return http.put<User>('/me/avatar', form, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data)
    },
    removeAvatar: () => http.delete<User>('/me/avatar').then((r) => r.data),
    changePassword: (body: ChangePasswordRequest) => http.post<void>('/me/password', body).then(() => undefined),
  },
  wallets: {
    list: ({ signal }: Opts = {}) => http.get<{ items: Wallet[] }>('/me/wallets', { signal }).then((r) => r.data),
    create: (body: CreateWalletRequest) => http.post<Wallet>('/me/wallets', body).then((r) => r.data),
    update: (id: string, body: UpdateWalletRequest) => http.patch<Wallet>(`/me/wallets/${id}`, body).then((r) => r.data),
    connect: (id: string, body: WalletConnectRequest) => http.post<WalletConnection>(`/me/wallets/${id}/connect`, body).then((r) => r.data),
    disconnect: (id: string) => http.post<void>(`/me/wallets/${id}/disconnect`).then(() => undefined),
  },
  /** Controle da simulação (existe apenas quando a camada MSW está ativa). */
  mock: {
    state: () => http.get<MockState>('/__mock/state').then((r) => r.data),
    setScenario: (scenario: MockScenario) => http.post<MockState>('/__mock/scenario', { scenario }).then((r) => r.data),
    reset: () => http.post<MockState>('/__mock/reset').then((r) => r.data),
  },
}
