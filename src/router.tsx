import { createRootRouteWithContext, createRoute, createRouter, redirect, lazyRouteComponent, stringifySearchWith } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { sessionStore } from '@/app/session-store'
import { catalogSearchSchema } from '@/features/catalog/search'
import { RootLayout } from '@/routes/root'
import { HomePage } from '@/routes/home'
import { NotFoundPage } from '@/routes/not-found'
import { RouteErrorPage } from '@/routes/route-error'

export interface RouterContext {
  queryClient: QueryClient
}

/** Redireciona para /login preservando o destino (retorno ao fluxo anterior). */
function requireAuth({ location }: { location: { href: string } }) {
  const s = sessionStore.get()
  if (s.status === 'anonymous' || !s.user) {
    throw redirect({ to: '/login', search: { redirect: location.href } })
  }
  // status 'expired': a página carrega com o snapshot do cache e o diálogo de sessão expirada
  // pede reautenticação sem perder o contexto.
}

const redirectSearch = z.object({ redirect: z.string().optional().catch(undefined) })

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: NotFoundPage,
  errorComponent: RouteErrorPage,
})

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  validateSearch: catalogSearchSchema,
  component: HomePage,
})

/** "Mercado" do menu: mesmo catálogo, com âncora na grade. */
const marketRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/mercado',
  validateSearch: catalogSearchSchema,
  component: lazyRouteComponent(() => import('@/routes/market'), 'MarketPage'),
})

const nftRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/nft/$nftId',
  component: lazyRouteComponent(() => import('@/routes/nft-detail'), 'NftDetailPage'),
})

const cartRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/carrinho',
  component: lazyRouteComponent(() => import('@/routes/cart'), 'CartPage'),
})

const checkoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/pagamento',
  beforeLoad: requireAuth,
  component: lazyRouteComponent(() => import('@/routes/checkout'), 'CheckoutPage'),
})

const orderRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/pedido/$orderId',
  beforeLoad: requireAuth,
  component: lazyRouteComponent(() => import('@/routes/order'), 'OrderPage'),
})

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  validateSearch: redirectSearch,
  component: lazyRouteComponent(() => import('@/routes/login'), 'LoginPage'),
})

const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/cadastro',
  validateSearch: redirectSearch,
  component: lazyRouteComponent(() => import('@/routes/register'), 'RegisterPage'),
})

const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/perfil',
  beforeLoad: requireAuth,
  component: lazyRouteComponent(() => import('@/routes/profile'), 'ProfilePage'),
})

const walletsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/perfil/carteiras',
  beforeLoad: requireAuth,
  component: lazyRouteComponent(() => import('@/routes/wallets'), 'WalletsPage'),
})

const favoritesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/perfil/favoritos',
  beforeLoad: requireAuth,
  component: lazyRouteComponent(() => import('@/routes/favorites'), 'FavoritesPage'),
})

const routeTree = rootRoute.addChildren([
  homeRoute,
  marketRoute,
  nftRoute,
  cartRoute,
  checkoutRoute,
  orderRoute,
  loginRoute,
  registerRoute,
  profileRoute,
  walletsRoute,
  favoritesRoute,
])

export function createAppRouter(queryClient: QueryClient) {
  return createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    scrollRestoration: true,
    defaultNotFoundComponent: NotFoundPage,
    // Strings ficam cruas na URL (`maxPrice=5`, sem aspas JSON) e listas viram CSV (`category=arte,foto`);
    // demais objetos seguem em JSON. O schema do catálogo aceita CSV/array e descarta valores inválidos.
    stringifySearch: stringifySearchWith((value: unknown) => (Array.isArray(value) ? value.join(',') : JSON.stringify(value))),
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>
  }
}
