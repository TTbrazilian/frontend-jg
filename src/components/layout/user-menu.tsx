import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import type { User } from '@/api/contracts'
import { ChevronDownIcon, LogoutIcon } from '@/components/icons'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { useLogout } from '@/features/auth/hooks'
import { cn } from '@/lib/utils'

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '')).toUpperCase() || '?'
}

export function UserAvatar({ user, className }: { user: User; className?: string }) {
  return (
    <Avatar className={cn('size-8 border border-border-soft', className)}>
      {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" width={32} height={32} /> : null}
      <AvatarFallback className="text-caption font-bold">{initials(user.displayName)}</AvatarFallback>
    </Avatar>
  )
}

/** Gatilho do header desktop: avatar + nome + seta. */
export const UserMenuTrigger = forwardRef<HTMLButtonElement, ComponentPropsWithoutRef<'button'> & { user: User }>(
  ({ user, className, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      className={cn(
        'flex h-[35px] max-w-52 items-center gap-2 rounded-md border border-border-soft px-2 text-body-lg font-medium text-foreground transition-colors hover:border-primary data-[state=open]:border-primary',
        className,
      )}
      aria-label={`Menu da conta de ${user.displayName}`}
      data-testid="user-menu-trigger"
      {...props}
    >
      <UserAvatar user={user} className="size-6" />
      <span className="truncate">{user.displayName}</span>
      <ChevronDownIcon width={16} height={16} className="shrink-0 text-text-secondary" />
    </button>
  ),
)
UserMenuTrigger.displayName = 'UserMenuTrigger'

/** Itens do menu da conta (header desktop e aba "Perfil" da tab bar mobile). */
export function UserMenuContent({ user, side = 'bottom' }: { user: User; side?: 'top' | 'bottom' }) {
  const logout = useLogout()
  const navigate = useNavigate()
  const onLogout = () =>
    logout.mutate(undefined, {
      onSettled: () => {
        void navigate({ to: '/' })
        toast.success('Você saiu da conta.')
      },
    })
  const item = 'min-h-10 cursor-pointer'
  return (
    <DropdownMenuContent align="end" side={side} className="w-56">
      <DropdownMenuLabel className="truncate">
        Conectado como <span className="font-bold text-foreground">@{user.username}</span>
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem asChild className={item}>
        <Link to="/perfil">Meu perfil</Link>
      </DropdownMenuItem>
      <DropdownMenuItem asChild className={item}>
        <Link to="/perfil/carteiras">Carteiras</Link>
      </DropdownMenuItem>
      <DropdownMenuItem asChild className={item}>
        <Link to="/perfil/favoritos">Lista de interesse</Link>
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem className={item} onSelect={onLogout} disabled={logout.isPending} data-testid="logout">
        <LogoutIcon width={18} height={18} />
        Sair
      </DropdownMenuItem>
    </DropdownMenuContent>
  )
}
