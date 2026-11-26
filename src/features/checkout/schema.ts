import { z } from 'zod'
import { NETWORKS, WALLET_PROVIDERS, type CollectorInfo, type NetworkId, type User, type Wallet } from '@/api/contracts'

/** Mesmas regras do servidor (src/mocks/lib/validation.ts), com mensagens em pt-BR. */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
export const USERNAME_RE = /^[a-z0-9_]{3,20}$/
export const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/
export const SOLANA_ADDRESS_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
export const ENS_RE = /^[a-z0-9-]{3,32}$/
export const REFERRAL_RE = /^[A-Za-z0-9]{4,12}$/

const name = (label: string) =>
  z
    .string()
    .trim()
    .min(2, `${label} precisa ter pelo menos 2 caracteres.`)
    .max(40, `${label} pode ter no máximo 40 caracteres.`)

export const collectorSchema = z
  .object({
    displayName: name('O nome de exibição'),
    username: z.string().regex(USERNAME_RE, 'Use 3 a 20 caracteres: letras minúsculas, números ou _.'),
    network: z.enum(NETWORKS, { error: 'Selecione uma rede.' }),
    profileName: name('O nome do perfil'),
    walletAddress: z.string().trim().min(1, 'Informe o endereço da carteira.'),
    ensOrSecondary: z.string().max(64, 'Use até 64 caracteres.'),
    walletType: z.enum(WALLET_PROVIDERS, { error: 'Selecione o tipo de carteira.' }),
    referralCode: z.string().trim().regex(REFERRAL_RE, 'Use 4 a 12 letras ou números.'),
    email: z.string().trim().regex(EMAIL_RE, 'Informe um e-mail válido.'),
    ensName: z.string().regex(ENS_RE, 'Use 3 a 32 caracteres: letras minúsculas, números ou hífen (sem ".eth").'),
    useOtherWallet: z.boolean(),
    note: z.string().max(500, 'Use até 500 caracteres.'),
  })
  .superRefine((v, ctx) => {
    const address = v.walletAddress.trim()
    if (!address) return
    if (v.network === 'solana') {
      if (!SOLANA_ADDRESS_RE.test(address)) {
        ctx.addIssue({ code: 'custom', path: ['walletAddress'], message: 'Endereço Solana inválido (base58, 32 a 44 caracteres).' })
      }
    } else if (!EVM_ADDRESS_RE.test(address)) {
      ctx.addIssue({ code: 'custom', path: ['walletAddress'], message: 'Endereço inválido: use 0x seguido de 40 caracteres hexadecimais.' })
    }
  })

/** Valores do formulário: selects começam vazios ('') até o usuário escolher. */
export interface CheckoutFormValues {
  displayName: string
  username: string
  network: NetworkId | ''
  profileName: string
  walletAddress: string
  ensOrSecondary: string
  walletType: Wallet['provider'] | ''
  referralCode: string
  email: string
  ensName: string
  useOtherWallet: boolean
  note: string
}

export type CheckoutFieldName = keyof CheckoutFormValues

/** Ordem visual (e de foco) dos campos. */
export const FIELD_ORDER: CheckoutFieldName[] = [
  'displayName',
  'username',
  'network',
  'profileName',
  'walletAddress',
  'ensOrSecondary',
  'walletType',
  'referralCode',
  'email',
  'ensName',
  'useOtherWallet',
  'note',
]

export const EMPTY_VALUES: CheckoutFormValues = {
  displayName: '',
  username: '',
  network: '',
  profileName: '',
  walletAddress: '',
  ensOrSecondary: '',
  walletType: '',
  referralCode: '',
  email: '',
  ensName: '',
  useOtherWallet: false,
  note: '',
}

/** Campos que vêm da carteira cadastrada (travados quando "Usar outra carteira?" está desmarcado). */
export const LOCKED_WALLET_FIELDS = ['network', 'walletAddress', 'walletType'] as const

export function walletFields(wallet: Wallet): Partial<CheckoutFormValues> {
  return {
    network: wallet.network,
    walletAddress: wallet.address,
    walletType: wallet.provider,
    ensOrSecondary: wallet.ensOrSecondary ?? '',
    ensName: wallet.ensName,
    referralCode: wallet.referralCode,
    email: wallet.email,
    profileName: wallet.profileName,
  }
}

export function prefillValues(profile: User | undefined, wallet: Wallet | undefined): CheckoutFormValues {
  return {
    ...EMPTY_VALUES,
    displayName: profile?.displayName ?? wallet?.displayName ?? '',
    username: profile?.username ?? '',
    email: profile?.email ?? '',
    ensName: profile?.ensName ?? '',
    ...(wallet ? walletFields(wallet) : {}),
  }
}

export function toCollector(values: z.output<typeof collectorSchema>): CollectorInfo {
  const optional = (v: string) => (v.trim() ? v.trim() : null)
  return {
    displayName: values.displayName.trim(),
    username: values.username,
    network: values.network,
    profileName: values.profileName.trim(),
    walletAddress: values.walletAddress.trim(),
    ensOrSecondary: optional(values.ensOrSecondary),
    walletType: values.walletType,
    referralCode: values.referralCode.trim().toUpperCase(),
    email: values.email.trim().toLowerCase(),
    ensName: values.ensName,
    useOtherWallet: values.useOtherWallet,
    note: optional(values.note),
  }
}
