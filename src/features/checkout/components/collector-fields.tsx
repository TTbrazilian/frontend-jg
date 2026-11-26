import { Controller, type UseFormReturn } from 'react-hook-form'
import { NETWORKS, NETWORK_LABELS, WALLET_PROVIDERS, WALLET_PROVIDER_LABELS, type WalletProvider } from '@/api/contracts'
import { Checkbox } from '@/components/ui/checkbox'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { EnsInput, EnsLabel } from '@/features/account/ens-input'
import { cn } from '@/lib/utils'
import type { CollectorOutput } from '../checkout-form'
import type { CheckoutFormValues } from '../schema'

const inputCls = 'rounded-xs'
const LOCK_HINT = 'Definido pela carteira selecionada.'

interface CollectorFieldsProps {
  form: UseFormReturn<CheckoutFormValues, unknown, CollectorOutput>
  /** Campos da carteira travados (vêm da carteira cadastrada selecionada). */
  locked: boolean
  /** No mobile o "Tipo de carteira" é escolhido nos cards de "Carteira e rede". */
  showWalletType: boolean
}

/** "Perfil do colecionador" — grade de 2 colunas do Figma desktop (370px + 24 + 370px). */
export function CollectorFields({ form, locked, showWalletType }: CollectorFieldsProps) {
  const {
    register,
    control,
    formState: { errors },
  } = form

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-x-6 gap-y-3 md:grid-cols-2">
        <FormField id="checkout-displayName" label="Nome de exibição" required error={errors.displayName?.message}>
          {(aria) => <Input {...aria} {...register('displayName')} autoComplete="name" className={inputCls} data-testid="field-displayName" />}
        </FormField>
        <FormField id="checkout-username" label="Nome de usuário" required error={errors.username?.message}>
          {(aria) => (
            <Input
              {...aria}
              {...register('username')}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              className={inputCls}
              data-testid="field-username"
            />
          )}
        </FormField>

        <FormField id="checkout-network" label="Rede" required error={errors.network?.message} hint={locked ? LOCK_HINT : undefined}>
          {(aria) => (
            <Controller
              control={control}
              name="network"
              render={({ field }) => (
                <Select value={field.value || undefined} onValueChange={field.onChange} disabled={locked}>
                  <SelectTrigger ref={field.ref} onBlur={field.onBlur} {...aria} className={inputCls} data-testid="field-network">
                    <SelectValue placeholder="Selecione uma rede" />
                  </SelectTrigger>
                  <SelectContent>
                    {NETWORKS.map((n) => (
                      <SelectItem key={n} value={n}>
                        {NETWORK_LABELS[n]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          )}
        </FormField>
        <FormField id="checkout-profileName" label="Nome do perfil" required error={errors.profileName?.message}>
          {(aria) => <Input {...aria} {...register('profileName')} className={inputCls} data-testid="field-profileName" />}
        </FormField>

        <FormField id="checkout-walletAddress" label="Endereço da carteira" required error={errors.walletAddress?.message}>
          {(aria) => (
            <Input
              {...aria}
              {...register('walletAddress')}
              readOnly={locked}
              placeholder="Endereço 0x da carteira"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className={cn(inputCls, 'font-mono', locked && 'cursor-default text-text-secondary')}
              data-testid="field-walletAddress"
            />
          )}
        </FormField>
        <FormField
          id="checkout-ensOrSecondary"
          label="ENS ou carteira secundária (opcional)"
          srOnlyLabel
          error={errors.ensOrSecondary?.message}
          className="md:pt-[29px]"
        >
          {(aria) => (
            <Input
              {...aria}
              {...register('ensOrSecondary')}
              placeholder="ENS ou carteira secundária (opcional)"
              autoCapitalize="none"
              spellCheck={false}
              className={inputCls}
              data-testid="field-ensOrSecondary"
            />
          )}
        </FormField>

        {showWalletType ? (
          <FormField id="checkout-walletType" label="Tipo de carteira" required error={errors.walletType?.message} hint={locked ? LOCK_HINT : undefined}>
            {(aria) => (
              <Controller
                control={control}
                name="walletType"
                render={({ field }) => (
                  <Select value={field.value || undefined} onValueChange={(v) => field.onChange(v as WalletProvider)} disabled={locked}>
                    <SelectTrigger ref={field.ref} onBlur={field.onBlur} {...aria} className={inputCls} data-testid="field-walletType">
                      <SelectValue placeholder="Selecione uma carteira" />
                    </SelectTrigger>
                    <SelectContent>
                      {WALLET_PROVIDERS.map((p) => (
                        <SelectItem key={p} value={p}>
                          {WALLET_PROVIDER_LABELS[p]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
          </FormField>
        ) : null}
        <FormField id="checkout-referralCode" label="Código de indicação" required error={errors.referralCode?.message}>
          {(aria) => (
            <Input
              {...aria}
              {...register('referralCode')}
              autoCapitalize="characters"
              spellCheck={false}
              className={inputCls}
              data-testid="field-referralCode"
            />
          )}
        </FormField>

        <FormField id="checkout-email" label="E-mail" required error={errors.email?.message}>
          {(aria) => (
            <Input {...aria} {...register('email')} type="email" autoComplete="email" inputMode="email" className={inputCls} data-testid="field-email" />
          )}
        </FormField>
        <FormField id="checkout-ensName" label={<EnsLabel />} required error={errors.ensName?.message}>
          {(aria) => <EnsInput {...aria} {...register('ensName')} placeholder="seunome" data-testid="field-ensName" />}
        </FormField>
      </div>

      <Controller
        control={control}
        name="useOtherWallet"
        render={({ field }) => (
          <div className="flex items-center gap-2">
            <Checkbox
              id="checkout-useOtherWallet"
              ref={field.ref}
              checked={field.value}
              onCheckedChange={(v) => field.onChange(v === true)}
              onBlur={field.onBlur}
              aria-describedby="checkout-useOtherWallet-hint"
              data-testid="field-useOtherWallet"
            />
            <label htmlFor="checkout-useOtherWallet" className="cursor-pointer text-body-md">
              Usar outra carteira?
            </label>
            <span id="checkout-useOtherWallet-hint" className="sr-only">
              Permite informar rede, endereço e tipo de outra carteira.
            </span>
          </div>
        )}
      />

      <FormField id="checkout-note" label="Observação do colecionador (opcional)" error={errors.note?.message} className="max-w-[350px] gap-3">
        {(aria) => <Textarea {...aria} {...register('note')} rows={6} className="h-[152px] resize-none rounded-xs" data-testid="field-note" />}
      </FormField>
    </div>
  )
}
