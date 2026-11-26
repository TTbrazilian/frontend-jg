import { FacebookIcon, GoogleIcon } from '@/components/icons'
import { comingSoon } from '@/lib/coming-soon'
import { cn } from '@/lib/utils'

/**
 * "Ou continue com" + Google/Facebook. Login social está fora do escopo:
 * os botões informam que não estão disponíveis (nunca simulam sucesso).
 */
export function SocialSignIn({ variant }: { variant: 'modal' | 'page' }) {
  const modal = variant === 'modal'
  const button = cn(
    'flex h-10 w-full items-center justify-center gap-3 rounded-md border border-border text-body-sm font-medium text-text-secondary transition-colors',
    'hover:border-border-soft hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
  )
  return (
    <div className={cn('flex flex-col', modal ? 'gap-3 pt-6' : 'gap-3')}>
      <div className="flex items-center gap-3" role="presentation">
        <span aria-hidden className="h-px flex-1 bg-border" />
        <span className="text-body-sm text-foreground">Ou continue com</span>
        <span aria-hidden className="h-px flex-1 bg-border" />
      </div>
      <div className={cn('flex flex-col', modal ? 'gap-3 px-6 sm:px-20' : 'gap-4')}>
        <button type="button" className={button} onClick={() => comingSoon('Entrar com Google')}>
          <GoogleIcon width={20} height={20} />
          Continuar com Google
        </button>
        <button type="button" className={button} onClick={() => comingSoon('Entrar com Facebook')}>
          <FacebookIcon width={20} height={20} />
          Continuar com Facebook
        </button>
      </div>
    </div>
  )
}
