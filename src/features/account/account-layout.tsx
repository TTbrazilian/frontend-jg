import type { ComponentType, ReactNode, SVGProps } from 'react'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { toast } from 'sonner'
import {
  ActivityIcon,
  DownloadIcon,
  HeartOutlineSmallIcon,
  LocationIcon,
  LogoutIcon,
  ShoppingBagIcon,
  UserIcon,
  WarningIcon,
} from '@/components/icons'
import { announce } from '@/components/layout/live-region'
import { comingSoon } from '@/lib/coming-soon'
import { cn } from '@/lib/utils'
import { useLogout } from '@/features/auth/hooks'

type Icon = ComponentType<SVGProps<SVGSVGElement>>
type NavEntry =
  | { kind: 'link'; label: string; to: '/perfil' | '/perfil/carteiras' | '/perfil/favoritos'; icon: Icon }
  | { kind: 'soon'; label: string; icon: Icon }

/** Itens do "Meu perfil" (ordem e ícones do Figma). */
const NAV: NavEntry[] = [
  { kind: 'link', label: 'Dados do perfil', to: '/perfil', icon: UserIcon },
  { kind: 'link', label: 'Carteiras', to: '/perfil/carteiras', icon: LocationIcon },
  { kind: 'soon', label: 'Atividade', icon: ShoppingBagIcon },
  { kind: 'link', label: 'Lista de interesse', to: '/perfil/favoritos', icon: HeartOutlineSmallIcon },
  { kind: 'soon', label: 'Ofertas', icon: ActivityIcon },
  { kind: 'soon', label: 'Arquivos baixados', icon: DownloadIcon },
  { kind: 'soon', label: 'Suporte', icon: WarningIcon },
]

const itemBase = cn(
  'relative flex shrink-0 items-center gap-3 whitespace-nowrap px-4 text-body-md text-text-accent transition-colors',
  'h-11 lg:h-[45px] lg:w-full',
  'hover:bg-surface-raised focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
)
/** Barra laranja: embaixo no menu horizontal (mobile), à esquerda na sidebar (desktop). */
const activeBar =
  'bg-surface-raised lg:bg-transparent before:absolute before:inset-x-0 before:bottom-0 before:h-[3px] before:bg-primary lg:before:inset-x-auto lg:before:left-0 lg:before:top-0 lg:before:h-full lg:before:w-1.5'

/**
 * Layout da conta: sidebar "Meu perfil" (desktop ≥ 1024px) que vira menu horizontal rolável
 * no topo em telas menores (não há frame mobile no Figma).
 */
export function AccountLayout({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname.replace(/\/+$/, '') || '/' })
  const navigate = useNavigate()
  const logout = useLogout()

  const signOut = async () => {
    await logout.mutateAsync()
    const msg = 'Você saiu da sua conta.'
    toast.info(msg)
    announce(msg)
    void navigate({ to: '/', replace: true })
  }

  return (
    <div className="page-container pb-16 pt-6 lg:pt-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-7">
        <nav
          aria-labelledby="account-nav-title"
          data-testid="account-nav"
          className="min-w-0 bg-card lg:w-[310px] lg:shrink-0 lg:py-2"
        >
          <p id="account-nav-title" className="px-4 pt-3 text-title-sm font-bold leading-4 text-foreground lg:px-2.5 lg:py-2.5">
            Meu perfil
          </p>
          <ul className="flex overflow-x-auto overscroll-x-contain lg:flex-col lg:overflow-visible [scrollbar-width:thin]">
            {NAV.map((item) => {
              const Icon = item.icon
              if (item.kind === 'link') {
                const active = pathname === item.to
                return (
                  <li key={item.label} className="shrink-0 lg:w-full">
                    <Link to={item.to} aria-current={active ? 'page' : undefined} className={cn(itemBase, active && activeBar)}>
                      <Icon aria-hidden width={18} height={18} className={cn('shrink-0', active ? 'text-primary' : 'text-sand')} />
                      {item.label}
                    </Link>
                  </li>
                )
              }
              return (
                <li key={item.label} className="shrink-0 lg:w-full">
                  <button type="button" onClick={() => comingSoon(item.label)} className={itemBase}>
                    <Icon aria-hidden width={18} height={18} className="shrink-0 text-sand" />
                    {item.label}
                    <span className="rounded-xs border border-border-soft px-1.5 py-px text-tiny uppercase leading-4 tracking-wide text-sand lg:ml-auto">
                      em breve
                    </span>
                  </button>
                </li>
              )
            })}
            <li className="shrink-0 border-l border-primary/30 lg:w-full lg:border-l-0 lg:border-t">
              <button
                type="button"
                onClick={() => void signOut()}
                disabled={logout.isPending}
                className={cn(itemBase, 'gap-2 font-bold lg:h-10')}
              >
                <LogoutIcon aria-hidden width={20} height={20} className="shrink-0" />
                Sair
              </button>
            </li>
          </ul>
        </nav>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  )
}

/** Título de página da conta ("Perfil do colecionador", "Lista de interesse"…). */
export function AccountPageTitle({ children, className, id }: { children: ReactNode; className?: string; id?: string }) {
  return (
    <h1 id={id} className={cn('text-body-lg font-bold leading-4 text-foreground', className)}>
      {children}
    </h1>
  )
}
