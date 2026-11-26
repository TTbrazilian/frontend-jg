import { useEffect, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { NETWORK_LABELS, NETWORKS, WALLET_PROVIDER_LABELS, WALLET_PROVIDERS, type UpdateWalletRequest, type Wallet, type WalletRole } from '@/api/contracts'
import { announce } from '@/components/layout/live-region'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { EnsInput, EnsLabel } from '@/features/account/ens-input'
import { FormAlert } from '@/features/account/form-alert'
import { applyApiFieldErrors, SR_ONLY_HINT } from '@/features/account/form-errors'
import { addressPlaceholder } from '@/features/account/validation'
import { useCreateWallet, useUpdateWallet } from '@/features/wallets/hooks'
import { NativeSelect } from './native-select'
import {
  EMPTY_WALLET,
  SAME_AS_PRIMARY_FIELDS,
  toWalletRequest,
  WALLET_FIELDS,
  walletSchema,
  walletToInput,
  type WalletFormInput,
  type WalletFormValues,
} from './wallet-schema'

const NETWORK_OPTIONS = NETWORKS.map((value) => ({ value, label: NETWORK_LABELS[value] }))
const PROVIDER_OPTIONS = WALLET_PROVIDERS.map((value) => ({ value, label: WALLET_PROVIDER_LABELS[value] }))
const ROLE_LABEL: Record<WalletRole, string> = { primary: 'principal', secondary: 'secundária' }

const inputCls = 'rounded-xs'

interface WalletFormProps {
  role: WalletRole
  /** Carteira em edição; ausente = nova carteira. */
  wallet?: Wallet
  /** Carteira de onde copiar ("Igual à carteira principal"); null = sem cópia. */
  copySource?: Wallet | null
  /** Sem botão "Cancelar" (ex.: não há carteira principal e o formulário é o estado vazio). */
  cancellable?: boolean
  onSaved: (wallet: Wallet) => void
  onCancel: () => void
  /** 409 de papel ocupado: a lista de carteiras está desatualizada. */
  onStale: () => void
}

function withCopy(base: WalletFormInput, source: Wallet | null | undefined): WalletFormInput {
  if (!source) return base
  const copy = walletToInput(source)
  const next = { ...base }
  for (const key of SAME_AS_PRIMARY_FIELDS) next[key] = copy[key]
  return next
}

/** Formulário "Carteira principal/secundária" do Figma (10 campos, 2 colunas no desktop). */
export function WalletForm({ role, wallet, copySource = null, cancellable = true, onSaved, onCancel, onStale }: WalletFormProps) {
  const create = useCreateWallet()
  const update = useUpdateWallet()
  const [formError, setFormError] = useState<string | null>(null)
  const base = wallet ? walletToInput(wallet) : EMPTY_WALLET
  const [initial] = useState(() => withCopy(base, copySource))
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    setFocus,
    control,
    formState: { errors, isDirty, dirtyFields, isSubmitting },
  } = useForm<WalletFormInput, unknown, WalletFormValues>({
    resolver: zodResolver(walletSchema),
    defaultValues: initial,
    reValidateMode: 'onChange',
  })
  const network = useWatch({ control, name: 'network' })
  const prefix = `wallet-${role}`

  // Foco no primeiro campo ao abrir (Adicionar/Editar).
  useEffect(() => {
    setFocus('displayName')
  }, [setFocus])

  // "Igual à carteira principal" marcado/desmarcado com o formulário aberto.
  const lastSource = useRef(copySource)
  useEffect(() => {
    if (lastSource.current === copySource) return
    lastSource.current = copySource
    const values = withCopy(base, copySource)
    for (const key of SAME_AS_PRIMARY_FIELDS) setValue(key, values[key], { shouldDirty: true, shouldValidate: false })
    // `base` muda a cada render; só a fonte da cópia dispara a troca.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [copySource, setValue])

  const onSubmit = async (values: WalletFormValues) => {
    setFormError(null)
    let saved: Wallet
    try {
      if (wallet) {
        const full = toWalletRequest(values, role)
        const body: UpdateWalletRequest = {}
        for (const key of WALLET_FIELDS) if (dirtyFields[key]) Object.assign(body, { [key]: full[key] })
        // O servidor valida o endereço contra a rede: mandamos os dois juntos.
        if (body.network !== undefined || body.address !== undefined) Object.assign(body, { network: full.network, address: full.address })
        saved = await update.mutateAsync({ id: wallet.id, body })
      } else {
        saved = await create.mutateAsync(toWalletRequest(values, role))
      }
    } catch (err) {
      const { apiError, applied, rest } = applyApiFieldErrors(err, setError, WALLET_FIELDS)
      if (apiError.fieldErrors.role) onStale()
      if (applied && rest.length === 0) return
      setFormError(rest[0] ?? apiError.message ?? 'Não foi possível salvar a carteira agora.')
      return
    }
    const msg = wallet ? `Carteira ${ROLE_LABEL[role]} atualizada.` : `Carteira ${ROLE_LABEL[role]} adicionada.`
    toast.success(msg)
    announce(msg)
    onSaved(saved)
  }

  return (
    <form
      noValidate
      onSubmit={handleSubmit(onSubmit)}
      data-testid={`wallet-form-${role}`}
      aria-labelledby={`wallet-${role}-title`}
      aria-busy={isSubmitting || undefined}
      className="flex flex-col gap-8"
    >
      <div className="grid gap-x-7 gap-y-6 md:grid-cols-2">
        <FormField id={`${prefix}-displayName`} label="Nome de exibição" required error={errors.displayName?.message}>
          {(aria) => <Input {...aria} {...register('displayName')} autoComplete="name" data-testid="wallet-displayName" className={inputCls} />}
        </FormField>
        <FormField id={`${prefix}-nickname`} label="Apelido da carteira" required error={errors.nickname?.message}>
          {(aria) => (
            <Input
              {...aria}
              {...register('nickname')}
              autoComplete="off"
              placeholder={role === 'primary' ? 'Ex.: Principal' : 'Ex.: Reserva'}
              data-testid="wallet-nickname"
              className={inputCls}
            />
          )}
        </FormField>
        <FormField id={`${prefix}-network`} label="Rede" required error={errors.network?.message}>
          {(aria) => (
            <NativeSelect
              {...aria}
              {...register('network', { deps: ['address'] })}
              placeholder="Selecione uma rede"
              options={NETWORK_OPTIONS}
              data-testid="wallet-network"
            />
          )}
        </FormField>
        <FormField id={`${prefix}-profileName`} label="Nome do perfil" required error={errors.profileName?.message}>
          {(aria) => <Input {...aria} {...register('profileName')} autoComplete="nickname" data-testid="wallet-profileName" className={inputCls} />}
        </FormField>
        <FormField
          id={`${prefix}-address`}
          label="Endereço da carteira"
          required
          className={SR_ONLY_HINT}
          error={errors.address?.message}
          hint={<span className="sr-only">{network === 'solana' ? 'Base58, de 32 a 44 caracteres.' : '0x seguido de 40 caracteres hexadecimais.'}</span>}
        >
          {(aria) => (
            <Input
              {...aria}
              {...register('address')}
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder={addressPlaceholder(network)}
              data-testid="wallet-address"
              className={inputCls}
            />
          )}
        </FormField>
        {/* No Figma este campo não tem rótulo visível (o placeholder diz o que é). */}
        <FormField
          id={`${prefix}-ensOrSecondary`}
          label="ENS ou carteira secundária (opcional)"
          srOnlyLabel
          error={errors.ensOrSecondary?.message}
          className="md:pt-[23px]"
        >
          {(aria) => (
            <Input
              {...aria}
              {...register('ensOrSecondary')}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="ENS ou carteira secundária (opcional)"
              data-testid="wallet-ensOrSecondary"
              className={inputCls}
            />
          )}
        </FormField>
        <FormField id={`${prefix}-provider`} label="Tipo de carteira" required error={errors.provider?.message}>
          {(aria) => (
            <NativeSelect {...aria} {...register('provider')} placeholder="Selecione uma carteira" options={PROVIDER_OPTIONS} data-testid="wallet-provider" />
          )}
        </FormField>
        <FormField
          id={`${prefix}-referralCode`}
          label="Código de indicação"
          required
          className={SR_ONLY_HINT}
          error={errors.referralCode?.message}
          hint={<span className="sr-only">4 a 12 letras ou números.</span>}
        >
          {(aria) => (
            <Input
              {...aria}
              {...register('referralCode')}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              data-testid="wallet-referralCode"
              className={inputCls}
            />
          )}
        </FormField>
        <FormField id={`${prefix}-email`} label="E-mail" required error={errors.email?.message}>
          {(aria) => (
            <Input
              {...aria}
              {...register('email')}
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              data-testid="wallet-email"
              className={inputCls}
            />
          )}
        </FormField>
        <FormField id={`${prefix}-ensName`} label={<EnsLabel />} required error={errors.ensName?.message}>
          {(aria) => <EnsInput {...aria} {...register('ensName')} autoComplete="off" data-testid="wallet-ensName" />}
        </FormField>
      </div>

      {formError ? <FormAlert data-testid={`wallet-error-${role}`}>{formError}</FormAlert> : null}

      <div className="flex flex-wrap items-center gap-4">
        <Button
          type="submit"
          loading={isSubmitting}
          disabled={!!wallet && !isDirty}
          data-testid="wallet-save"
          className="h-10 min-w-[131px] rounded-xs px-3"
        >
          Salvar carteira
        </Button>
        {cancellable ? (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting} className="h-10 rounded-xs font-normal">
            Cancelar
          </Button>
        ) : null}
        {wallet && !isDirty ? <span className="text-caption text-sand">Nenhuma alteração para salvar.</span> : null}
      </div>
    </form>
  )
}
