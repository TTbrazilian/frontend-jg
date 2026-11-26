/**
 * Contratos REST e de eventos compartilhados entre transporte (Axios),
 * estado (TanStack Query), interface e a camada de mocks (MSW).
 *
 * Regras gerais:
 * - Valores em ETH trafegam como string decimal (`EthAmount`), nunca number.
 * - Quantidades são inteiros.
 * - Datas em ISO-8601 (UTC).
 * - Todo recurso mutável carrega `version` (inteiro monotônico) para
 *   reconciliação entre REST e Socket.IO.
 */

/** String decimal com até 18 casas. Ex.: "0.125", "12". */
export type EthAmount = string
export type IsoDate = string

// ---------------------------------------------------------------------------
// Erros
// ---------------------------------------------------------------------------

export type ApiErrorCode =
  | 'VALIDATION_ERROR' // 422
  | 'INVALID_CREDENTIALS' // 401
  | 'UNAUTHENTICATED' // 401 (sem token)
  | 'SESSION_EXPIRED' // 401 (token expirado/revogado)
  | 'FORBIDDEN' // 403
  | 'WALLET_REJECTED' // 403 (usuário recusou conexão na carteira simulada)
  | 'NOT_FOUND' // 404
  | 'CONFLICT' // 409 (cadastro duplicado etc.)
  | 'AVAILABILITY_CONFLICT' // 409 (estoque insuficiente / esgotado)
  | 'QUOTE_STALE' // 409 (cotação desatualizada no checkout)
  | 'IDEMPOTENCY_CONFLICT' // 409 (mesma chave, conteúdo diferente)
  | 'COUPON_INVALID' // 422
  | 'COUPON_EXPIRED' // 422
  | 'RATE_LIMITED' // 429
  | 'SERVICE_UNAVAILABLE' // 503
  | 'INTERNAL_ERROR' // 500
  | 'NETWORK_ERROR' // cliente: sem conexão
  | 'TIMEOUT' // cliente: tempo excedido

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode
    message: string
    /** Erros por campo do formulário (chave = nome do campo). */
    fieldErrors?: Record<string, string>
    /** Indica se repetir a mesma requisição pode ter sucesso. */
    retryable: boolean
    details?: unknown
  }
}

// ---------------------------------------------------------------------------
// Sessão e conta
// ---------------------------------------------------------------------------

export interface User {
  id: string
  /** "Nome de exibição" */
  displayName: string
  /** "Nome de usuário" — /^[a-z0-9_]{3,20}$/ */
  username: string
  email: string
  /** "Nome ENS" — rótulo sem sufixo; o sufixo é sempre ".eth". */
  ensName: string | null
  /** "Apelido da carteira" exibido no perfil. */
  walletNickname: string
  avatarUrl: string | null
  createdAt: IsoDate
}

export interface Session {
  token: string
  expiresAt: IsoDate
  user: User
}

export interface RegisterRequest {
  username: string
  email: string
  password: string
}

export interface LoginRequest {
  email: string
  password: string
}

// ---------------------------------------------------------------------------
// Catálogo
// ---------------------------------------------------------------------------

export const CATEGORIES = [
  'digital-art',
  'photography',
  'music',
  '3d-art',
  'collectibles',
  'generative',
  'gaming',
  'subscriptions',
  'utility',
] as const
export type Category = (typeof CATEGORIES)[number]

export const CATEGORY_LABELS: Record<Category, string> = {
  'digital-art': 'Arte digital',
  photography: 'Fotografia',
  music: 'Música',
  '3d-art': 'Arte 3D',
  collectibles: 'Colecionáveis',
  generative: 'Generativa',
  gaming: 'Jogos',
  subscriptions: 'Assinaturas',
  utility: 'Utilidade',
}

export const NETWORKS = ['ethereum', 'polygon', 'solana'] as const
export type NetworkId = (typeof NETWORKS)[number]

export const NETWORK_LABELS: Record<NetworkId, string> = {
  ethereum: 'Ethereum',
  polygon: 'Polygon',
  solana: 'Solana',
}

/** Abas do catálogo: "Todos os NFTs", "Novos lançamentos" (últimos 30 dias), "Em alta" (trending). */
export const CATALOG_TABS = ['all', 'new', 'trending'] as const
export type CatalogTab = (typeof CATALOG_TABS)[number]

export const SORT_OPTIONS = ['recent', 'price_asc', 'price_desc', 'popular'] as const
export type SortOption = (typeof SORT_OPTIONS)[number]

export const SORT_LABELS: Record<SortOption, string> = {
  recent: 'Listados recentemente',
  price_asc: 'Menor preço',
  price_desc: 'Maior preço',
  popular: 'Mais favoritados',
}

export const AVAILABILITY_FILTERS = ['all', 'available', 'sold_out'] as const
export type AvailabilityFilter = (typeof AVAILABILITY_FILTERS)[number]

export interface Creator {
  id: string
  name: string
  avatarUrl: string
}

export interface Collection {
  id: string
  name: string
}

export interface NftImage {
  url: string
  alt: string
  width: number
  height: number
}

export type EditionStatus = 'available' | 'sold_out' | 'unavailable'

export interface NftEdition {
  id: string
  /** Rótulo exibido nos chips: "1/1", "1/10", "1/50", "ABERTA". */
  label: string
  priceEth: EthAmount
  supply: number
  available: number
  maxPerOrder: number
  status: EditionStatus
}

export interface NftRating {
  /** 0–5 com uma casa decimal. */
  average: number
  count: number
}

export interface NftSummary {
  id: string
  /** Ex.: "0042" (exibido como "ID do token: #0042"). */
  tokenId: string
  title: string
  creator: Creator
  collection: Collection
  category: Category
  network: NetworkId
  image: NftImage
  /** Menor preço entre as edições disponíveis (ou de todas, se esgotado). */
  minPriceEth: EthAmount
  /** Preço "de" riscado (promoção). */
  compareAtPriceEth: EthAmount | null
  /** Selo no card (ex.: "RARO"). */
  badge: 'rare' | null
  available: number
  soldOut: boolean
  featured: boolean
  trending: boolean
  favoritesCount: number
  rating: NftRating
  createdAt: IsoDate
  version: number
}

export interface NftReview {
  id: string
  author: string
  rating: number
  comment: string
  createdAt: IsoDate
}

export interface Nft extends Omit<NftSummary, 'image'> {
  description: string
  /** Texto longo da aba "Detalhes do NFT" (parágrafos separados por \n\n). */
  longDescription: string
  images: NftImage[]
  editions: NftEdition[]
  attributes: string[]
  reviews: NftReview[]
  contractAddress: string
  tokenStandard: 'ERC-721' | 'ERC-1155'
  royaltiesPercent: number
}

export interface NftListParams {
  q?: string
  tab?: CatalogTab
  category?: Category[]
  network?: NetworkId[]
  minPrice?: string
  maxPrice?: string
  availability?: AvailabilityFilter
  sort?: SortOption
  page?: number
  pageSize?: number
}

export interface Paginated<T> {
  items: T[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface CatalogFacets {
  /** Contagem por categoria considerando busca/aba/rede/preço, mas ignorando o filtro de categoria. */
  categories: Record<Category, number>
  /** Contagem por rede considerando busca/aba/categoria/preço, mas ignorando o filtro de rede. */
  networks: Record<NetworkId, number>
  /** Faixa de preço do catálogo inteiro (para o slider). */
  priceRange: { minEth: EthAmount; maxEth: EthAmount }
}

export interface NftListResponse extends Paginated<NftSummary> {
  facets: CatalogFacets
}

export interface FeaturedResponse {
  items: NftSummary[]
}

// ---------------------------------------------------------------------------
// Favoritos
// ---------------------------------------------------------------------------

export interface FavoritesResponse {
  nftIds: string[]
  items: NftSummary[]
}

// ---------------------------------------------------------------------------
// Carrinho e cotação
// ---------------------------------------------------------------------------

export type CartItemStatus = 'ok' | 'price_changed' | 'insufficient' | 'sold_out' | 'unavailable'

export interface CartItem {
  id: string
  nftId: string
  editionId: string
  tokenId: string
  title: string
  editionLabel: string
  image: NftImage
  creatorName: string
  quantity: number
  unitPriceEth: EthAmount
  /** Preço no momento em que o item foi adicionado/confirmado pela última vez. */
  acknowledgedPriceEth: EthAmount
  available: number
  maxPerOrder: number
  status: CartItemStatus
}

export interface AppliedCoupon {
  code: string
  description: string
  percentOff: number
}

export interface Cart {
  id: string
  owner: { type: 'guest' | 'user'; id: string }
  items: CartItem[]
  itemCount: number
  coupon: AppliedCoupon | null
  updatedAt: IsoDate
  version: number
}

export interface AddCartItemRequest {
  nftId: string
  editionId: string
  quantity: number
}

export interface UpdateCartItemRequest {
  quantity: number
}

export interface ApplyCouponRequest {
  code: string
}

export interface MergeCartRequest {
  guestCartId: string
}

export interface QuoteRequest {
  network: NetworkId
}

export interface QuoteLine {
  itemId: string
  nftId: string
  editionId: string
  tokenId: string
  title: string
  editionLabel: string
  image: NftImage
  quantity: number
  unitPriceEth: EthAmount
  lineTotalEth: EthAmount
}

export interface QuoteIssue {
  itemId: string
  type: 'price_changed' | 'insufficient' | 'sold_out' | 'unavailable'
  message: string
  previousPriceEth?: EthAmount
  currentPriceEth?: EthAmount
  available?: number
}

export interface Quote {
  id: string
  cartId: string
  cartVersion: number
  network: NetworkId
  lines: QuoteLine[]
  subtotalEth: EthAmount
  discountEth: EthAmount
  networkFeeEth: EthAmount
  totalEth: EthAmount
  coupon: AppliedCoupon | null
  issues: QuoteIssue[]
  /** true quando não há issues bloqueantes e há itens. */
  purchasable: boolean
  createdAt: IsoDate
  expiresAt: IsoDate
  /** Hash determinístico de preços/quantidades/cupom/taxa; muda quando algo relevante muda. */
  fingerprint: string
}

// ---------------------------------------------------------------------------
// Carteiras
// ---------------------------------------------------------------------------

export const WALLET_PROVIDERS = ['metamask', 'coinbase', 'walletconnect'] as const
export type WalletProvider = (typeof WALLET_PROVIDERS)[number]
export type WalletRole = 'primary' | 'secondary'

export const WALLET_PROVIDER_LABELS: Record<WalletProvider, string> = {
  metamask: 'MetaMask',
  coinbase: 'Coinbase Wallet',
  walletconnect: 'WalletConnect',
}

/** Campos do formulário "Carteira principal/secundária" do Figma. */
export interface Wallet {
  id: string
  role: WalletRole
  /** "Nome de exibição" */
  displayName: string
  /** "Apelido da carteira" (ex.: "Principal", "Reserva") */
  nickname: string
  /** "Rede" */
  network: NetworkId
  /** "Nome do perfil" */
  profileName: string
  /** "Endereço da carteira": 0x + 40 hex (ethereum/polygon) ou base58 32–44 (solana). */
  address: string
  /** "ENS ou carteira secundária (opcional)" */
  ensOrSecondary: string | null
  /** "Tipo de carteira" */
  provider: WalletProvider
  /** "Código de indicação" */
  referralCode: string
  /** "E-mail" */
  email: string
  /** "Nome ENS" — rótulo sem o sufixo ".eth". */
  ensName: string
  createdAt: IsoDate
  updatedAt: IsoDate
}

export interface CreateWalletRequest {
  role: WalletRole
  displayName: string
  nickname: string
  network: NetworkId
  profileName: string
  address: string
  ensOrSecondary: string | null
  provider: WalletProvider
  referralCode: string
  email: string
  ensName: string
}

export type UpdateWalletRequest = Partial<CreateWalletRequest>

export interface WalletConnectRequest {
  network: NetworkId
}

export interface WalletConnection {
  walletId: string
  network: NetworkId
  status: 'connected'
  connectedAt: IsoDate
}

// ---------------------------------------------------------------------------
// Pedidos
// ---------------------------------------------------------------------------

export type OrderStatus = 'pending' | 'confirmed' | 'declined'

/** "Perfil do colecionador" da tela de Pagamento. */
export interface CollectorInfo {
  displayName: string
  username: string
  network: NetworkId
  profileName: string
  walletAddress: string
  ensOrSecondary: string | null
  walletType: WalletProvider
  referralCode: string
  email: string
  ensName: string
  /** "Usar outra carteira?" — quando true, walletAddress/walletType vêm do formulário e não da carteira cadastrada. */
  useOtherWallet: boolean
  note: string | null
}

export interface CreateOrderRequest {
  quoteId: string
  /** fingerprint da cotação que o usuário revisou e confirmou. */
  quoteFingerprint: string
  /** Carteira cadastrada selecionada e conectada (simulação). */
  walletId: string
  network: NetworkId
  collector: CollectorInfo
}

export interface OrderLine {
  itemId: string
  nftId: string
  editionId: string
  tokenId: string
  title: string
  editionLabel: string
  image: NftImage
  quantity: number
  unitPriceEth: EthAmount
  lineTotalEth: EthAmount
}

export interface Order {
  id: string
  userId: string
  status: OrderStatus
  lines: OrderLine[]
  subtotalEth: EthAmount
  discountEth: EthAmount
  networkFeeEth: EthAmount
  totalEth: EthAmount
  coupon: AppliedCoupon | null
  network: NetworkId
  wallet: Pick<Wallet, 'id' | 'nickname' | 'address' | 'provider' | 'network'>
  collector: CollectorInfo
  txHash: string | null
  explorerUrl: string | null
  failureReason: string | null
  createdAt: IsoDate
  updatedAt: IsoDate
  version: number
}

export interface OrdersResponse {
  items: Order[]
}

/** Corpo do 409 QUOTE_STALE: traz a nova cotação para o usuário revisar. */
export interface QuoteStaleDetails {
  quote: Quote
}

// ---------------------------------------------------------------------------
// Perfil
// ---------------------------------------------------------------------------

export interface UpdateProfileRequest {
  displayName?: string
  username?: string
  email?: string
  ensName?: string | null
  walletNickname?: string
}

export interface ChangePasswordRequest {
  currentPassword: string
  newPassword: string
}

// ---------------------------------------------------------------------------
// Eventos em tempo real (Socket.IO)
// ---------------------------------------------------------------------------

export type RealtimeEventType = 'nft.updated' | 'order.updated'

export interface RealtimeEnvelope<TType extends RealtimeEventType, TData> {
  /** Identidade estável do evento (deduplicação). */
  eventId: string
  type: TType
  resource: { type: 'nft' | 'order'; id: string }
  /** Versão do recurso APÓS a mudança. */
  version: number
  occurredAt: IsoDate
  data: TData
}

export interface NftUpdatedData {
  nftId: string
  minPriceEth: EthAmount
  available: number
  soldOut: boolean
  editions: Array<Pick<NftEdition, 'id' | 'priceEth' | 'available' | 'status'>>
}

export interface OrderUpdatedData {
  order: Order
}

export type NftUpdatedEvent = RealtimeEnvelope<'nft.updated', NftUpdatedData>
export type OrderUpdatedEvent = RealtimeEnvelope<'order.updated', OrderUpdatedData>

export interface ServerToClientEvents {
  'nft.updated': (event: NftUpdatedEvent) => void
  'order.updated': (event: OrderUpdatedEvent) => void
  'session.ready': (payload: { userId: string | null }) => void
}

export interface ClientToServerEvents {
  'order.watch': (payload: { orderId: string }) => void
}

// ---------------------------------------------------------------------------
// Controle de mocks (somente camada MSW; usado pelo painel de simulação e testes)
// ---------------------------------------------------------------------------

export const MOCK_SCENARIOS = [
  'default',
  'empty-catalog',
  'slow-network',
  'variable-latency',
  'offline',
  'server-error',
  'session-expired',
  'unauthorized',
  'favorites-failure',
  'price-change-on-checkout',
  'sold-out-on-checkout',
  'order-timeout',
  'payment-declined',
  'wallet-rejected',
] as const
export type MockScenario = (typeof MOCK_SCENARIOS)[number]

export interface MockState {
  scenario: MockScenario
  latencyMs: number
  orderResolutionMs: number
}
