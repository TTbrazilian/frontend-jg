import { useNavigate, useRouterState } from '@tanstack/react-router'
import { toast } from 'sonner'
import type { Session } from '@/api/contracts'
import { useSession } from '@/app/session-store'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { LogoutIcon } from '@/components/icons'
import { announce } from '@/components/layout/live-region'
import { useLogout } from './hooks'
import { LoginForm } from './components/login-form'
import { isAuthPath } from './components/redirect'

/**
 * Diálogo global de sessão expirada (montado no root).
 * - Mesmo usuário: reautentica e a página atual continua (o hook revalida as queries privadas).
 * - Outro usuário: o hook já limpou o cache privado do anterior; levamos para "/".
 * - "Sair": logout completo.
 * Não fecha por ESC/clique fora: a página não deve seguir operando com sessão inválida.
 */
export function SessionExpiredDialog() {
  const session = useSession()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const navigate = useNavigate()
  const logout = useLogout()
  const open = session.status === 'expired' && !isAuthPath(pathname)
  const previousUser = session.user

  const onSuccess = (next: Session) => {
    if (previousUser && next.user.id !== previousUser.id) {
      const msg = `Você entrou como ${next.user.displayName}. Os dados da conta anterior foram removidos deste dispositivo.`
      toast.info(msg)
      announce(msg)
      void navigate({ to: '/', replace: true })
      return
    }
    const msg = 'Sessão renovada. Você pode continuar de onde parou.'
    toast.success(msg)
    announce(msg)
  }

  const signOut = async () => {
    await logout.mutateAsync()
    toast.info('Você saiu da sua conta.')
    void navigate({ to: '/', replace: true })
  }

  return (
    <Dialog open={open}>
      <DialogContent
        data-testid="session-expired-dialog"
        hideClose
        className="max-w-[500px] border-b-[10px] pb-10"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          const root = e.currentTarget as HTMLElement | null
          root?.querySelector<HTMLInputElement>('[data-testid="login-password"]')?.focus()
        }}
      >
        <div className="flex flex-col items-center gap-4 px-6 pt-10 text-center sm:px-12">
          <DialogTitle className="text-[1.25rem] font-medium text-text-accent">Sessão expirada</DialogTitle>
          <DialogDescription className="text-body text-foreground">Sua sessão expirou. Entre novamente para continuar de onde parou.</DialogDescription>
          <p className="text-caption text-text-secondary">Para proteger sua conta, esta janela só fecha quando você entrar novamente ou sair.</p>
        </div>
        <div className="px-6 pt-6 sm:px-20">
          <LoginForm
            variant="inline"
            idPrefix="reauth"
            defaultEmail={previousUser?.email ?? ''}
            submitLabel="Entrar novamente"
            submitTestId="session-expired-submit"
            onSuccess={onSuccess}
          />
          <Button
            type="button"
            variant="ghost"
            loading={logout.isPending}
            onClick={() => void signOut()}
            data-testid="session-expired-logout"
            className="mt-3 h-[45px] w-full border border-border text-text-secondary"
          >
            <LogoutIcon width={18} height={18} />
            Sair
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
