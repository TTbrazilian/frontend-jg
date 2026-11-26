import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { HomeIcon } from '@/components/icons'
import { DropdownMenu, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useSession } from '@/app/session-store'
import { useCartCount } from '@/features/cart/hooks'
import { cn } from '@/lib/utils'
import { HeartFilledIcon, ScanIcon, ShopFilledIcon, UserFilledIcon } from './extra-icons'
import { CartBadge, cartLabel } from './header'
import { UserMenuContent } from './user-menu'
import { isImmersiveMobilePath, useCurrentHref, usePathname } from './route-flags'
import { useIsDesktop } from './use-media-query'

const itemClass = (active: boolean) =>
  cn(
    'relative flex size-12 flex-col items-center justify-center gap-1 rounded-md transition-colors',
    active ? 'text-text-accent' : 'text-text-secondary hover:text-foreground',
  )

/** Ponto sob o ícone ativo: o estado não depende só da cor. */
function ActiveDot({ active }: { active: boolean }) {
  return <span aria-hidden className={cn('size-1 rounded-full', active ? 'bg-primary' : 'bg-transparent')} />
}

function TabLink({ to, label, active, children }: { to: string; label: string; active: boolean; children: ReactNode }) {
  return (
    <Link to={to} aria-label={label} aria-current={active ? 'page' : undefined} className={itemClass(active)}>
      {children}
      <ActiveDot active={active} />
    </Link>
  )
}

/** Tab bar inferior fixa do Figma mobile (Início, Favoritos, botão central, Carrinho, Perfil). */
export function MobileTabBar() {
  const pathname = usePathname()
  const href = useCurrentHref()
  const session = useSession()
  const count = useCartCount()
  const isDesktop = useIsDesktop()
  // Só existe no DOM < 768px: evita controles duplicados (menu da conta, badge) escondidos por CSS.
  if (isDesktop || isImmersiveMobilePath(pathname)) return null

  const profileActive = pathname === '/perfil' || pathname === '/perfil/carteiras'

  return (
    <nav
      aria-label="Navegação rápida"
      className="fixed inset-x-0 bottom-0 z-40 pb-[env(safe-area-inset-bottom)] md:hidden"
      data-testid="mobile-tab-bar"
    >
      <div className="relative mx-auto h-[95px] max-w-[480px] rounded-t-[30px] bg-card shadow-[0_-10px_30px_rgb(10_6_4/0.45)]">
        <ul className="grid h-full grid-cols-5 items-center px-4 pt-2">
          <li className="grid place-items-center">
            <TabLink to="/" label="Início" active={pathname === '/'}>
              <HomeIcon width={20} height={20} />
            </TabLink>
          </li>
          <li className="grid place-items-center">
            <TabLink to="/perfil/favoritos" label="Favoritos" active={pathname === '/perfil/favoritos'}>
              <HeartFilledIcon width={20} height={18} />
            </TabLink>
          </li>
          <li className="relative grid place-items-center">
            <Link
              to="/mercado"
              aria-label="Explorar o mercado"
              aria-current={pathname === '/mercado' ? 'page' : undefined}
              className="absolute -top-[68px] grid size-[65px] place-items-center rounded-full bg-linear-to-b from-primary/40 to-primary text-foreground shadow-overlay ring-8 ring-background"
            >
              <ScanIcon width={27} height={24} />
            </Link>
          </li>
          <li className="grid place-items-center">
            <Link to="/carrinho" aria-label={cartLabel(count)} aria-current={pathname === '/carrinho' ? 'page' : undefined} className={itemClass(pathname === '/carrinho')}>
              <span className="relative">
                <ShopFilledIcon width={22} height={22} />
                <CartBadge count={count} />
              </span>
              <ActiveDot active={pathname === '/carrinho'} />
            </Link>
          </li>
          <li className="grid place-items-center">
            {session.user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" aria-label={`Conta de ${session.user.displayName}`} className={itemClass(profileActive)} data-testid="user-menu-trigger">
                    <UserFilledIcon width={20} height={20} />
                    <ActiveDot active={profileActive} />
                  </button>
                </DropdownMenuTrigger>
                <UserMenuContent user={session.user} side="top" />
              </DropdownMenu>
            ) : (
              <Link to="/login" search={{ redirect: href }} aria-label="Entrar" className={itemClass(false)}>
                <UserFilledIcon width={20} height={20} />
                <ActiveDot active={false} />
              </Link>
            )}
          </li>
        </ul>
      </div>
    </nav>
  )
}
