import { useId, useRef, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import type { Wallet, WalletRole } from '@/api/contracts'
import { toApiError } from '@/api/errors'
import { announce } from '@/components/layout/live-region'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { useUpdateWallet } from '@/features/wallets/hooks'
import { WalletForm } from './wallet-form'
import { WalletSummary } from './wallet-summary'

type Mode = 'view' | 'edit' | 'create'

const TITLE: Record<WalletRole, string> = { primary: 'Carteira principal', secondary: 'Carteira secundária' }

/** Ação de texto do cabeçalho ("Adicionar"/"Editar"): Medium 16 laranja, alvo de 40px sem alterar o ritmo. */
const textAction =
  'inline-flex min-h-10 items-center rounded-sm px-1 -mx-1 -my-3 text-body-lg font-medium text-text-accent hover:underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50'

interface WalletSectionProps {
  role: WalletRole
  wallet: Wallet | undefined
  /** Carteira principal salva (fonte do "Igual à carteira principal"). */
  primary?: Wallet
  onStale: () => void
}

/**
 * Seção "Carteira principal/secundária": resumo + "Editar" quando existe;
 * senão, formulário (principal) ou estado vazio com "Adicionar" e "Igual à carteira principal" (secundária).
 */
export function WalletSection({ role, wallet, primary, onStale }: WalletSectionProps) {
  const isPrimary = role === 'primary'
  // Sem carteira principal, o formulário é o próprio estado vazio (como no Figma).
  const [mode, setMode] = useState<Mode>(() => (!wallet && isPrimary ? 'create' : 'view'))
  const [sameAsPrimary, setSameAsPrimary] = useState(false)
  const actionRef = useRef<HTMLButtonElement>(null)
  const sameId = useId()
  const swap = useUpdateWallet()

  // Se a carteira deste papel mudar (troca de papéis, outra aba), a edição em curso não vale mais.
  const walletId = wallet?.id
  const [seenId, setSeenId] = useState(walletId)
  if (seenId !== walletId) {
    setSeenId(walletId)
    setMode(!walletId && isPrimary ? 'create' : 'view')
    setSameAsPrimary(false)
  }

  const focusAction = () => window.requestAnimationFrame(() => actionRef.current?.focus())

  const cancel = () => {
    setMode(!wallet && isPrimary ? 'create' : 'view')
    setSameAsPrimary(false)
    focusAction()
  }

  // Após salvar sempre existe carteira neste papel: volta ao resumo e foca o "Editar".
  const saved = () => {
    setMode('view')
    setSameAsPrimary(false)
    focusAction()
  }

  const onSameChange = (checked: boolean) => {
    setSameAsPrimary(checked)
    if (checked && mode === 'view') setMode(wallet ? 'edit' : 'create')
  }

  const makePrimary = () => {
    if (!wallet) return
    swap.mutate(
      { id: wallet.id, body: { role: 'primary' } },
      {
        onSuccess: (saved) => {
          const msg = `"${saved.nickname}" agora é a carteira principal.`
          toast.success(msg)
          announce(msg)
          // O botão some (a carteira mudou de seção): o foco vai para o título da principal.
          window.requestAnimationFrame(() => document.getElementById('wallet-primary-title')?.focus())
        },
        onError: (err) => {
          const msg = `Não foi possível trocar as carteiras. ${toApiError(err).message}`
          toast.error(msg)
          announce(msg, 'assertive')
        },
      },
    )
  }

  const editing = mode !== 'view'
  const showSame = !isPrimary && (editing || !wallet)
  const titleId = `wallet-${role}-title`

  let action: ReactNode = null
  if (!editing && wallet) {
    action = (
      <button ref={actionRef} type="button" className={textAction} onClick={() => setMode('edit')}>
        Editar<span className="sr-only"> {TITLE[role].toLowerCase()}</span>
      </button>
    )
  } else if (!editing && !wallet) {
    action = (
      <button ref={actionRef} type="button" className={textAction} onClick={() => setMode('create')}>
        Adicionar<span className="sr-only"> {TITLE[role].toLowerCase()}</span>
      </button>
    )
  }

  let description: string | null = null
  if (isPrimary) description = 'Estas carteiras ficam disponíveis no pagamento e para receber NFTs comprados.'
  else if (!wallet && !editing) description = 'Você ainda não adicionou uma carteira secundária.'

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-8" data-testid={`wallet-section-${role}`}>
      <div className={cn('flex flex-col', isPrimary ? 'gap-2' : 'gap-3')}>
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <h2 id={titleId} tabIndex={-1} className="text-[1.0625rem] font-bold leading-4 text-foreground">
            {TITLE[role]}
          </h2>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            {showSame ? (
              <div className="flex min-h-10 items-center gap-2 -my-3">
                <Checkbox
                  id={sameId}
                  checked={sameAsPrimary}
                  disabled={!primary}
                  onCheckedChange={(v) => onSameChange(v === true)}
                  data-testid="wallet-same-as-primary"
                  aria-describedby={primary ? undefined : `${sameId}-hint`}
                />
                <label htmlFor={sameId} className="cursor-pointer text-body text-foreground">
                  Igual à carteira principal
                </label>
                {primary ? null : (
                  <span id={`${sameId}-hint`} className="sr-only">
                    Indisponível: cadastre primeiro a carteira principal.
                  </span>
                )}
              </div>
            ) : null}
            {!isPrimary && wallet && !editing ? (
              <button type="button" className={cn(textAction, 'text-body font-normal')} disabled={swap.isPending} onClick={makePrimary}>
                {swap.isPending ? 'Trocando…' : 'Tornar principal'}
              </button>
            ) : null}
            {action}
          </div>
        </div>
        {description ? <p className="text-body leading-[15px] text-text-secondary">{description}</p> : null}
      </div>

      {editing ? (
        <WalletForm
          key={`${mode}-${wallet?.id ?? 'new'}`}
          role={role}
          wallet={mode === 'edit' ? wallet : undefined}
          copySource={sameAsPrimary ? (primary ?? null) : null}
          cancellable={!(isPrimary && !wallet)}
          onSaved={saved}
          onCancel={cancel}
          onStale={onStale}
        />
      ) : wallet ? (
        <WalletSummary wallet={wallet} />
      ) : null}
    </section>
  )
}

