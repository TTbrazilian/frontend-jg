import { Controller, type UseFormReturn } from 'react-hook-form'
import { WALLET_PROVIDERS, WALLET_PROVIDER_LABELS, type WalletProvider } from '@/api/contracts'
import { WalletIcon } from '@/components/icons'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { cn } from '@/lib/utils'
import type { CollectorOutput } from '../checkout-form'
import type { CheckoutFormValues } from '../schema'

const ORDER: WalletProvider[] = ['walletconnect', 'metamask', 'coinbase']
const MARKS: Record<WalletProvider, string> = { walletconnect: 'W', metamask: 'M', coinbase: '' }

/**
 * Mobile ("Carteira e rede" do Figma): o "Tipo de carteira" como cards com radio.
 * Travado (somente leitura) enquanto a carteira cadastrada define o tipo.
 */
export function WalletTypeCards({ form, locked, labelledBy }: { form: UseFormReturn<CheckoutFormValues, unknown, CollectorOutput>; locked: boolean; labelledBy: string }) {
  const error = form.formState.errors.walletType?.message
  return (
    <Controller
      control={form.control}
      name="walletType"
      render={({ field }) => (
        <div className="flex flex-col gap-2">
          <RadioGroup
            ref={field.ref}
            value={field.value || ''}
            onValueChange={(v) => field.onChange(v as WalletProvider)}
            aria-labelledby={labelledBy}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'walletType-cards-error' : locked ? 'walletType-cards-hint' : undefined}
            disabled={locked}
            className="gap-4"
            data-testid="field-walletType"
          >
            {ORDER.filter((p) => WALLET_PROVIDERS.includes(p)).map((p) => {
              const checked = field.value === p
              return (
                <label
                  key={p}
                  htmlFor={`wallet-type-${p}`}
                  className={cn(
                    'flex h-[65px] items-center gap-3 rounded-[15px] bg-card pl-3.5 pr-4 shadow-overlay',
                    locked ? 'cursor-default' : 'cursor-pointer',
                    locked && !checked && 'opacity-60',
                  )}
                >
                  <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full border border-border bg-surface-raised text-body font-bold text-text-accent">
                    {MARKS[p] || <WalletIcon width={24} height={24} className="text-primary" />}
                  </span>
                  <span className="flex-1 text-body">{WALLET_PROVIDER_LABELS[p]}</span>
                  <RadioGroupItem id={`wallet-type-${p}`} value={p} className={cn(!checked && 'border-border-soft')} />
                </label>
              )
            })}
          </RadioGroup>
          {locked ? (
            <p id="walletType-cards-hint" className="text-caption text-muted-foreground">
              Definido pela carteira selecionada. Marque “Usar outra carteira?” nos dados do colecionador para trocar.
            </p>
          ) : null}
          {error ? (
            <p id="walletType-cards-error" role="alert" className="text-caption font-medium text-destructive">
              {error}
            </p>
          ) : null}
        </div>
      )}
    />
  )
}
