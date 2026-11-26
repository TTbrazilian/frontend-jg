import type { NetworkId, NftListParams } from './contracts'

/**
 * Query keys centralizadas.
 * - Dados públicos (catálogo) não levam escopo.
 * - Dados privados levam `scope` (user:<id> | guest:<cartId>) para isolar usuários
 *   e permitir limpeza seletiva no logout/troca de usuário.
 */
export const qk = {
  nfts: {
    all: ['nfts'] as const,
    lists: () => ['nfts', 'list'] as const,
    list: (params: NftListParams) => ['nfts', 'list', params] as const,
    featured: () => ['nfts', 'featured'] as const,
    detail: (id: string) => ['nfts', 'detail', id] as const,
    related: (id: string) => ['nfts', 'related', id] as const,
  },
  private: (scope: string) => ['private', scope] as const,
  session: () => ['session'] as const,
  favorites: (scope: string) => ['private', scope, 'favorites'] as const,
  cart: (scope: string) => ['private', scope, 'cart'] as const,
  quote: (scope: string, cartVersion: number | undefined, network: NetworkId) =>
    ['private', scope, 'quote', cartVersion ?? 0, network] as const,
  quotes: (scope: string) => ['private', scope, 'quote'] as const,
  orders: (scope: string) => ['private', scope, 'orders'] as const,
  order: (scope: string, id: string) => ['private', scope, 'orders', id] as const,
  profile: (scope: string) => ['private', scope, 'profile'] as const,
  wallets: (scope: string) => ['private', scope, 'wallets'] as const,
}
