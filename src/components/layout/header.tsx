import { Link } from '@tanstack/react-router'
import { CartIcon, FilterIcon, LogoutIcon } from '@/components/icons'
import { DropdownMenu, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useSession } from '@/app/session-store'
import { useCartCount } from '@/features/cart/hooks'
import { useFilterSheetOpen } from '@/features/catalog/filter-sheet-store'
import { comingSoon } from '@/lib/coming-soon'
import { cn } from '@/lib/utils'
import { Container } from './container'
import { HeaderSearch, MobileSearchBar } from './search-box'
import { UserMenuContent, UserMenuTrigger } from './user-menu'
import { isCatalogPath, isImmersiveMobilePath, useCurrentHref, usePathname } from './route-flags'
import { useIsDesktop } from './use-media-query'

/** Wordmark KURIO do Figma (Roboto Mono Bold 14, tracking 10%). */
export function Wordmark({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn('inline-flex h-[34px] items-center rounded-xs text-body font-bold tracking-[0.1em] text-foreground', className)}>
      KURIO
      <span className="sr-only"> — página inicial</span>
    </Link>
  )
}

export function CartBadge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null
  return (
    <span
      aria-hidden
      className={cn(
        'absolute -right-2 -top-1 grid h-4 min-w-4 place-items-center rounded-full border-2 border-background bg-primary px-0.5 text-tiny font-medium leading-none text-primary-foreground',
        className,
      )}
      data-testid="cart-badge"
    >
      {count > 99 ? '99+' : count}
    </span>
  )
}

export const cartLabel = (count: number) => `Carrinho, ${count} ${count === 1 ? 'item' : 'itens'}`

function NavItem({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <li
      className={cn(
        'relative flex h-[45px] items-start',
        active && 'after:absolute after:inset-x-0 after:-bottom-px after:h-[3px] after:bg-primary after:content-[""]',
      )}
    >
      {children}
    </li>
  )
}

const navText = 'rounded-xs text-body-lg leading-[21px] transition-colors hover:text-text-accent'

function DesktopHeader() {
  const pathname = usePathname()
  const href = useCurrentHref()
  const session = useSession()
  const count = useCartCount()
  const homeActive = pathname === '/'
  const marketActive = pathname === '/mercado' || pathname.startsWith('/nft/')
  const onAuthPage = pathname === '/login' || pathname === '/cadastro'

  return (
    <header className="pt-6" data-testid="site-header">
      <Container>
        <div className="flex h-[45px] items-start justify-between gap-4 border-b border-primary/40">
          <div className="flex w-24 lg:w-40">
            <Wordmark />
          </div>
          <nav aria-label="Principal">
            <ul className="flex items-start gap-6 lg:gap-10">
              <NavItem active={homeActive}>
                <Link to="/" aria-current={homeActive ? 'page' : undefined} className={cn(navText, homeActive ? 'font-bold text-text-accent' : 'text-foreground')}>
                  Início
                </Link>
              </NavItem>
              <NavItem active={marketActive}>
                <Link
                  to="/mercado"
                  aria-current={pathname === '/mercado' ? 'page' : undefined}
                  className={cn(navText, marketActive ? 'font-bold text-text-accent' : 'text-foreground')}
                >
                  Mercado
                </Link>
              </NavItem>
              <NavItem active={false}>
                <button type="button" className={cn(navText, 'text-foreground')} onClick={() => comingSoon('Criadores')}>
                  Criadores
                </button>
              </NavItem>
              <NavItem active={false}>
                <button type="button" className={cn(navText, 'text-foreground')} onClick={() => comingSoon('Aprenda')}>
                  Aprenda
                </button>
              </NavItem>
            </ul>
          </nav>
          <div className="flex h-[35px] items-center gap-5 lg:gap-7">
            <HeaderSearch />
            <Link to="/carrinho" aria-label={cartLabel(count)} className="relative grid h-9 place-items-center rounded-md text-foreground hover:text-text-accent">
              <CartIcon width={24} height={24} />
              <CartBadge count={count} />
            </Link>
            {session.user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <UserMenuTrigger user={session.user} />
                </DropdownMenuTrigger>
                <UserMenuContent user={session.user} />
              </DropdownMenu>
            ) : (
              <Link
                to="/login"
                search={{ redirect: onAuthPage ? undefined : href }}
                className="inline-flex h-[35px] w-[100px] items-center justify-center gap-1 rounded-md bg-primary text-body-lg font-medium text-primary-foreground transition-colors hover:bg-brand-light active:bg-brand-dark"
                data-testid="login-link"
              >
                <LogoutIcon width={20} height={20} />
                Entrar
              </Link>
            )}
          </div>
        </div>
      </Container>
    </header>
  )
}

function MobileHeader() {
  const pathname = usePathname()
  const [, setFiltersOpen] = useFilterSheetOpen()
  if (isImmersiveMobilePath(pathname)) return null
  const onCatalog = isCatalogPath(pathname)
  return (
    <header className="px-6 pt-10" data-testid="site-header">
      <div className="flex items-center gap-2">
        <MobileSearchBar />
        {onCatalog ? (
          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            className="grid size-[45px] shrink-0 place-items-center rounded-[14px] bg-linear-to-b from-primary/45 to-primary text-ink"
            aria-label="Filtros"
            aria-haspopup="dialog"
            data-testid="mobile-filter-button"
          >
            <FilterIcon width={22} height={22} />
          </button>
        ) : null}
      </div>
    </header>
  )
}

/** Header global: desktop (≥768px) com nav e ações; mobile com a busca "Explorar coleções" + filtros. */
export function Header() {
  const isDesktop = useIsDesktop()
  return isDesktop ? <DesktopHeader /> : <MobileHeader />
}
