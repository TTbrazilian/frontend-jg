import { Link } from '@tanstack/react-router'
import type { Wallet } from '@/api/contracts'
import { NETWORK_LABELS, WALLET_PROVIDER_LABELS } from '@/api/contracts'
import { WalletIcon, WarningIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { cn, shortAddress } from '@/lib/utils'

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'rejected' | 'error'

export interface WalletConnectionState {
  walletId: string | null
  status: ConnectionStatus
  message?: string
}

interface WalletSelectorProps {
  wallets: Wallet[]
  selectedId: string | null
  onSelect: (id: string) => void
  connection: WalletConnectionState
  onConnect: () => void
  onDisconnect: () => void
  disconnecting: boolean
  /** `desktop`: linhas com borda (Figma desktop); `mobile`: cards arredondados (Figma mobile). */
  variant: 'desktop' | 'mobile'
  labelledBy: string
  disabled?: boolean
}

/** Rótulo da rede como no Figma mobile ("Rede principal Ethereum", "Rede Polygon"). */
function networkLine(w: Wallet) {
  return w.network === 'ethereum' ? 'Rede principal Ethereum' : `Rede ${NETWORK_LABELS[w.network]}`
}

/**
 * "Carteira e rede": escolha da carteira cadastrada (RadioGroup) + conexão simulada
 * (Conectando → Conectada/Desconectar | Recusada → Tentar de novo). A compra só é liberada
 * com a carteira selecionada conectada.
 */
export function WalletSelector({
  wallets,
  selectedId,
  onSelect,
  connection,
  onConnect,
  onDisconnect,
  disconnecting,
  variant,
  labelledBy,
  disabled,
}: WalletSelectorProps) {
  const selected = wallets.find((w) => w.id === selectedId)
  const status: ConnectionStatus = connection.walletId === selectedId ? connection.status : 'idle'

  return (
    <div className="flex flex-col gap-4">
      <RadioGroup
        value={selectedId ?? ''}
        onValueChange={onSelect}
        aria-labelledby={labelledBy}
        disabled={disabled}
        className={variant === 'mobile' ? 'gap-5' : 'gap-4'}
      >
        {wallets.map((w) => {
          const checked = w.id === selectedId
          const id = `wallet-option-${w.id}`
          const secondary = w.ensName ? `${w.ensName}.eth` : shortAddress(w.address, 4)
          return (
            <label
              key={w.id}
              htmlFor={id}
              className={cn(
                'relative flex cursor-pointer items-center transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/60',
                variant === 'desktop'
                  ? cn('min-h-[45px] gap-3 rounded-xs border px-3 py-2.5', checked ? 'border-primary' : 'border-border hover:border-border-soft')
                  : cn('min-h-[93px] gap-5 rounded-[14px] bg-card px-[19px] py-[15px]', checked && 'shadow-overlay'),
              )}
            >
              <RadioGroupItem
                id={id}
                value={w.id}
                data-testid={`wallet-option-${w.id}`}
                className={cn(!checked && variant === 'mobile' && 'border-border-soft')}
              />
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className={cn('flex flex-wrap items-baseline gap-x-2', variant === 'mobile' ? 'text-body-lg font-bold' : 'text-body-md')}>
                  {w.nickname}
                  {variant === 'desktop' ? <span className="text-caption text-text-secondary">· {WALLET_PROVIDER_LABELS[w.provider]}</span> : null}
                </span>
                <span className={cn('text-text-secondary', variant === 'mobile' ? 'text-body leading-[22px]' : 'text-caption')}>
                  <span title={w.address}>{secondary}</span>
                  {variant === 'mobile' ? <br /> : ' · '}
                  {networkLine(w)}
                </span>
              </span>
            </label>
          )
        })}
      </RadioGroup>

      {selected ? (
        <div
          className={cn(
            'flex flex-col gap-3 rounded-xs border p-3',
            status === 'connected' ? 'border-success/50 bg-success/5' : status === 'rejected' || status === 'error' ? 'border-destructive/50 bg-destructive/5' : 'border-border',
            variant === 'mobile' && 'rounded-[14px] bg-card px-4',
          )}
        >
          <div
            role={status === 'rejected' || status === 'error' ? 'alert' : 'status'}
            className="flex items-start gap-2 text-body"
            data-testid="wallet-status"
            data-status={status}
          >
            {status === 'connecting' ? (
              <span aria-hidden className="mt-0.5 size-4 shrink-0 animate-spin rounded-full border-2 border-primary border-t-transparent motion-reduce:animate-none" />
            ) : status === 'rejected' || status === 'error' ? (
              <WarningIcon width={16} height={16} className="mt-0.5 shrink-0 text-destructive" />
            ) : (
              <WalletIcon width={16} height={16} className={cn('mt-0.5 shrink-0', status === 'connected' ? 'text-success' : 'text-sand')} />
            )}
            <span className="min-w-0">
              {status === 'idle' && (
                <>
                  <span className="font-bold">Não conectada.</span> Conecte {selected.nickname} ({WALLET_PROVIDER_LABELS[selected.provider]}) para confirmar a compra.
                </>
              )}
              {status === 'connecting' && <>Conectando à {WALLET_PROVIDER_LABELS[selected.provider]}… Aprove a conexão na carteira.</>}
              {status === 'connected' && (
                <>
                  <span className="font-bold text-success">Conectada:</span> {selected.nickname} · {shortAddress(selected.address, 4)} ·{' '}
                  {NETWORK_LABELS[selected.network]}
                </>
              )}
              {status === 'rejected' && (
                <>
                  <span className="font-bold text-destructive">Conexão recusada.</span> {connection.message ?? 'A carteira recusou a conexão.'}
                </>
              )}
              {status === 'error' && <>{connection.message ?? 'Não foi possível conectar a carteira.'}</>}
            </span>
          </div>
          {status === 'connected' ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onDisconnect}
              loading={disconnecting}
              className="self-start"
              data-testid="wallet-disconnect"
            >
              Desconectar
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={onConnect}
              loading={status === 'connecting'}
              disabled={disabled}
              className="self-start"
              data-testid="wallet-connect"
            >
              {status === 'rejected' || status === 'error' ? 'Tentar de novo' : 'Conectar carteira'}
            </Button>
          )}
        </div>
      ) : null}
    </div>
  )
}

/** Sem carteiras cadastradas: a compra fica bloqueada até cadastrar uma. */
export function NoWalletsNotice() {
  return (
    <div role="alert" className="flex flex-col gap-2 rounded-xs border border-amber/50 bg-amber/10 p-4 text-body" data-testid="no-wallets">
      <p className="flex items-start gap-2 font-bold">
        <WarningIcon width={16} height={16} className="mt-0.5 shrink-0 text-amber" />
        Você ainda não tem carteiras cadastradas.
      </p>
      <p className="text-text-secondary">
        Cadastre uma carteira para concluir a compra.{' '}
        <Link to="/perfil/carteiras" className="font-bold text-text-accent underline-offset-4 hover:underline">
          Cadastrar carteira
        </Link>
      </p>
    </div>
  )
}
