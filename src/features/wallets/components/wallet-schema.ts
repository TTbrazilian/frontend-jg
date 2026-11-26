import { z } from 'zod'
import type { CreateWalletRequest, NetworkId, Wallet, WalletProvider, WalletRole } from '@/api/contracts'
import {
  addressError,
  emailField,
  ensField,
  isNetwork,
  isWalletProvider,
  lengthField,
  REFERRAL_RE,
  REFERRAL_RULE,
} from '@/features/account/validation'

/**
 * Formulário de carteira — mesmas regras e mensagens do servidor (src/mocks/handlers/wallets.ts):
 * nomes 2–40, rede/tipo da lista, endereço conforme a rede, código 4–12 alfanumérico,
 * e-mail válido, ENS 3–32 [a-z0-9-] e "ENS ou carteira secundária" opcional até 64.
 */
export const walletSchema = z
  .object({
    displayName: lengthField('O nome de exibição', 2, 40),
    nickname: lengthField('O apelido', 2, 40),
    network: z.string().refine(isNetwork, 'Selecione uma rede válida.'),
    profileName: lengthField('O nome do perfil', 2, 40),
    address: z.string().trim(),
    ensOrSecondary: z.string().trim().max(64, 'Use até 64 caracteres.'),
    provider: z.string().refine(isWalletProvider, 'Selecione o tipo de carteira.'),
    referralCode: z.string().trim().regex(REFERRAL_RE, REFERRAL_RULE),
    email: emailField,
    ensName: ensField,
  })
  // Endereço depende da rede: roda mesmo com outros campos inválidos (zod 4), com a mensagem da rede.
  .superRefine((v, ctx) => {
    if (!isNetwork(v.network)) {
      if (!v.address) ctx.addIssue({ code: 'custom', path: ['address'], message: 'Informe o endereço da carteira.' })
      return
    }
    const message = addressError(v.address, v.network)
    if (message) ctx.addIssue({ code: 'custom', path: ['address'], message })
  })

export type WalletFormInput = z.input<typeof walletSchema>
export type WalletFormValues = z.output<typeof walletSchema>
export type WalletField = keyof WalletFormInput

export const WALLET_FIELDS = [
  'displayName',
  'nickname',
  'network',
  'profileName',
  'address',
  'ensOrSecondary',
  'provider',
  'referralCode',
  'email',
  'ensName',
] as const satisfies readonly WalletField[]

/** "Igual à carteira principal" copia tudo, menos o que identifica a carteira. */
export const SAME_AS_PRIMARY_FIELDS = WALLET_FIELDS.filter((f) => f !== 'nickname' && f !== 'address')

export const EMPTY_WALLET: WalletFormInput = {
  displayName: '',
  nickname: '',
  network: '',
  profileName: '',
  address: '',
  ensOrSecondary: '',
  provider: '',
  referralCode: '',
  email: '',
  ensName: '',
}

export function walletToInput(wallet: Wallet): WalletFormInput {
  return {
    displayName: wallet.displayName,
    nickname: wallet.nickname,
    network: wallet.network,
    profileName: wallet.profileName,
    address: wallet.address,
    ensOrSecondary: wallet.ensOrSecondary ?? '',
    provider: wallet.provider,
    referralCode: wallet.referralCode,
    email: wallet.email,
    ensName: wallet.ensName,
  }
}

/** Valores validados → corpo da API (rede/tipo já garantidos pelo schema). */
export function toWalletRequest(values: WalletFormValues, role: WalletRole): CreateWalletRequest {
  return {
    role,
    displayName: values.displayName,
    nickname: values.nickname,
    network: values.network as NetworkId,
    profileName: values.profileName,
    address: values.address,
    ensOrSecondary: values.ensOrSecondary ? values.ensOrSecondary : null,
    provider: values.provider as WalletProvider,
    referralCode: values.referralCode,
    email: values.email,
    ensName: values.ensName,
  }
}
