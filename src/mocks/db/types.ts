import type {
  Category,
  Collection,
  Creator,
  EthAmount,
  IsoDate,
  NetworkId,
  NftImage,
  NftRating,
  NftReview,
  Order,
  Quote,
  Wallet,
} from '@/api/contracts'

/** Formato interno do "banco" simulado. Campos derivados (status, mínimos etc.) são calculados na leitura. */

export interface DbUser {
  id: string
  displayName: string
  username: string
  email: string
  ensName: string | null
  walletNickname: string
  avatarUrl: string | null
  createdAt: IsoDate
  /** Salt por usuário; hash = SHA-256(salt + ":" + senha). */
  passwordSalt: string
  passwordHash: string
}

export interface DbSession {
  token: string
  userId: string
  createdAt: IsoDate
  expiresAt: IsoDate
  revokedAt: IsoDate | null
}

export interface DbEdition {
  id: string
  label: string
  priceEth: EthAmount
  supply: number
  available: number
  maxPerOrder: number
  /** Edição retirada de venda (status "unavailable"). */
  disabled: boolean
}

export interface DbNft {
  id: string
  tokenId: string
  title: string
  description: string
  longDescription: string
  creator: Creator
  collection: Collection
  category: Category
  network: NetworkId
  images: NftImage[]
  editions: DbEdition[]
  attributes: string[]
  reviews: NftReview[]
  rating: NftRating
  /** Preço "de" fixo do seed; só é exibido enquanto for maior que o preço mínimo atual. */
  compareAtPriceEth: EthAmount | null
  badge: 'rare' | null
  contractAddress: string
  tokenStandard: 'ERC-721' | 'ERC-1155'
  royaltiesPercent: number
  featured: boolean
  trending: boolean
  /** Popularidade base do seed; favoritesCount = base + usuários que favoritaram. */
  baseFavorites: number
  createdAt: IsoDate
  version: number
}

export interface DbCartItem {
  id: string
  nftId: string
  editionId: string
  quantity: number
  acknowledgedPriceEth: EthAmount
  addedAt: IsoDate
}

export interface DbCart {
  id: string
  owner: { type: 'guest' | 'user'; id: string }
  items: DbCartItem[]
  couponCode: string | null
  updatedAt: IsoDate
  version: number
}

export interface DbCoupon {
  code: string
  description: string
  percentOff: number
  expiresAt: IsoDate | null
}

export interface DbQuote {
  quote: Quote
  /** "user:<id>" ou "guest:<guestCartId>". */
  ownerKey: string
}

export interface DbOrder {
  order: Order
  /** Desfecho decidido na criação (cenário payment-declined → declined). */
  plannedStatus: 'confirmed' | 'declined'
  /** Epoch ms em que o pedido deve ser resolvido (reagendado no boot). */
  resolveAt: number
  cartId: string
}

export interface DbIdempotencyRecord {
  key: string
  userId: string
  bodyHash: string
  orderId: string
  createdAt: IsoDate
}

export interface DbWallet extends Wallet {
  userId: string
}

export interface DbWalletConnection {
  walletId: string
  network: NetworkId
  connectedAt: IsoDate
}

export interface DbState {
  schema: 1
  /** Identifica a "geração" do banco (muda a cada reset) — entra no eventId dos eventos. */
  epoch: string
  users: DbUser[]
  sessions: DbSession[]
  nfts: DbNft[]
  /** userId → nftIds (ordem de inserção, mais recente por último). */
  favorites: Record<string, string[]>
  carts: DbCart[]
  coupons: DbCoupon[]
  quotes: DbQuote[]
  orders: DbOrder[]
  idempotency: DbIdempotencyRecord[]
  wallets: DbWallet[]
  walletConnections: DbWalletConnection[]
}
