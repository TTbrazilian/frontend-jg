import { Component, type ReactNode, useEffect, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import type { Session } from '@/api/contracts'
import { sessionStore } from '@/app/session-store'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { announce } from '@/components/layout/live-region'
import { cn } from '@/lib/utils'
import { HomePage } from '@/routes/home'
import { LoginForm } from './login-form'
import { RegisterForm } from './register-form'
import { SocialSignIn } from './social-sign-in'
import { isProtectedPath, safeRedirect } from './redirect'
import { DESKTOP_QUERY, useMediaQuery } from './use-media-query'

type AuthMode = 'login' | 'register'

const COPY: Record<AuthMode, { title: string; mobileTitle: string; description: string; submit: string; mobileSubmit: string }> = {
  login: {
    title: 'Entrar',
    mobileTitle: 'Entrar',
    description: 'Entre para gerenciar sua carteira, coleção e perfil de criador.',
    submit: 'Entrar',
    mobileSubmit: 'Entrar',
  },
  register: {
    title: 'Criar conta',
    mobileTitle: 'Criar perfil de colecionador',
    description: 'Crie seu perfil de colecionador e conecte uma carteira quando quiser.',
    submit: 'Criar conta',
    mobileSubmit: 'Criar perfil',
  },
}

/** A home ao fundo é decorativa: se falhar fora da própria rota, some sem derrubar o login. */
class BackgroundBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

/**
 * Login/Cadastro: modal do Figma sobre a home (desktop ≥ 768px) ou página cheia (mobile).
 * Fechar volta ao `redirect` quando é rota pública; senão para "/".
 */
export function AuthScreen({ mode, redirect }: { mode: AuthMode; redirect?: string }) {
  const navigate = useNavigate()
  const isDesktop = useMediaQuery(DESKTOP_QUERY)
  // Decidido na montagem: após um login bem-sucedido quem navega é o próprio formulário.
  const [alreadyAuthenticated] = useState(() => sessionStore.get().status === 'authenticated')
  const target = safeRedirect(redirect)
  const copy = COPY[mode]

  if (alreadyAuthenticated) return <RedirectTo href={target} />

  const finish = (session: Session) => {
    const msg = mode === 'login' ? `Bem-vindo(a), ${session.user.displayName}!` : `Conta criada! Bem-vindo(a), ${session.user.displayName}!`
    toast.success(msg)
    announce(msg)
    void navigate({ href: target, replace: true })
  }

  const close = () => {
    void navigate({ href: isProtectedPath(target) ? '/' : target })
  }

  const search = redirect ? { redirect } : {}
  const form =
    mode === 'login' ? (
      <LoginForm variant={isDesktop ? 'modal' : 'page'} idPrefix="login" submitLabel={copy.submit} onSuccess={finish} />
    ) : (
      <RegisterForm variant={isDesktop ? 'modal' : 'page'} submitLabel={isDesktop ? copy.submit : copy.mobileSubmit} onSuccess={finish} />
    )

  if (!isDesktop) {
    return (
      <div className="mx-auto flex w-full max-w-[414px] flex-col gap-10 px-7 pb-10 pt-8" data-testid="auth-page">
        <p aria-hidden className="flex h-[136px] items-center justify-center text-display-sm font-bold tracking-[0.1em] text-foreground">
          KURIO
        </p>
        <h1 className="text-center text-title font-bold leading-tight text-foreground">{copy.mobileTitle}</h1>
        {form}
        <SocialSignIn variant="page" />
        <p className="text-center text-body-md text-text-secondary">
          {mode === 'login' ? 'Novo na Kurio? ' : 'Já tem uma conta? '}
          <Link
            to={mode === 'login' ? '/cadastro' : '/login'}
            search={search}
            replace
            className="inline-flex min-h-10 items-center text-text-secondary underline underline-offset-4 hover:text-text-accent"
          >
            {mode === 'login' ? 'Crie uma conta' : 'Entre'}
          </Link>
        </p>
      </div>
    )
  }

  return (
    <>
      <div inert aria-hidden="true" className="pointer-events-none select-none">
        <BackgroundBoundary>
          <HomePage />
        </BackgroundBoundary>
      </div>
      <Dialog open onOpenChange={(open) => (open ? undefined : close())}>
        <DialogContent
          data-testid="auth-dialog"
          className="max-w-[500px] border-b-[10px] pb-16"
          onOpenAutoFocus={(e) => {
            e.preventDefault()
            const input = (e.currentTarget as HTMLElement | null)?.querySelector<HTMLInputElement>('input:not([type=hidden])')
            input?.focus()
          }}
        >
          <div className="flex flex-col items-center gap-10 px-6 pt-12 sm:px-12">
            <nav aria-label="Acesso à conta" className="flex items-center gap-2 text-[1.25rem] font-medium leading-none">
              <AuthTab to="/login" active={mode === 'login'} search={search}>
                Entrar
              </AuthTab>
              <span aria-hidden className="h-5 w-px bg-coral" />
              <AuthTab to="/cadastro" active={mode === 'register'} search={search}>
                Criar conta
              </AuthTab>
            </nav>
            <DialogTitle className="sr-only">{copy.title}</DialogTitle>
            <DialogDescription className="max-w-[404px] text-center text-body-sm leading-4 text-foreground">{copy.description}</DialogDescription>
          </div>
          <div className="px-6 pt-6 sm:px-20">{form}</div>
          <SocialSignIn variant="modal" />
        </DialogContent>
      </Dialog>
    </>
  )
}

function AuthTab({ to, active, search, children }: { to: '/login' | '/cadastro'; active: boolean; search: { redirect?: string }; children: ReactNode }) {
  return (
    <Link
      to={to}
      search={search}
      replace
      aria-current={active ? 'page' : undefined}
      className={cn(
        'rounded-sm py-1 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        active ? 'text-text-accent' : 'text-foreground hover:text-text-accent',
      )}
    >
      {children}
    </Link>
  )
}

/** Já autenticado em /login ou /cadastro: segue direto para o destino. */
function RedirectTo({ href }: { href: string }) {
  const navigate = useNavigate()
  useEffect(() => {
    void navigate({ href, replace: true })
  }, [href, navigate])
  return null
}
