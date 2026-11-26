import { z } from 'zod'
import { NETWORKS, WALLET_PROVIDERS, type NetworkId, type WalletProvider } from '@/api/contracts'

/**
 * Regras de validação do cliente — espelham as do servidor (mesmas mensagens),
 * para que o usuário veja o erro antes do envio e o servidor continue sendo a fonte da verdade.
 */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
export const USERNAME_RE = /^[a-z0-9_]{3,20}$/
export const ENS_RE = /^[a-z0-9-]{3,32}$/
export const REFERRAL_RE = /^[A-Za-z0-9]{4,12}$/
export const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/
export const SOLANA_ADDRESS_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/

export const PASSWORD_RULE = 'A senha precisa ter pelo menos 8 caracteres, com letras e números.'
export const USERNAME_RULE = 'Use 3 a 20 caracteres: letras minúsculas, números ou _ (sem espaços).'
export const ENS_RULE = 'Use 3 a 32 caracteres: letras minúsculas, números ou hífen (sem ".eth").'

export function isStrongPassword(value: string): boolean {
  return value.length >= 8 && /[A-Za-z]/.test(value) && /\d/.test(value)
}

export const emailField = z.string().trim().min(1, 'Informe seu e-mail.').regex(EMAIL_RE, 'Informe um e-mail válido.')

export const usernameField = z.string().trim().min(1, 'Informe um nome de usuário.').regex(USERNAME_RE, USERNAME_RULE)

/** Nome ENS sem sufixo: aceita "nome.eth" e remove o sufixo antes de validar. */
export const ensField = z
  .string()
  .trim()
  .min(1, 'Informe o nome ENS.')
  .transform((v) => v.replace(/\.eth$/i, ''))
  .pipe(z.string().regex(ENS_RE, ENS_RULE))

/** Nome ENS opcional (perfil: o servidor aceita vazio → null). */
export const optionalEnsField = z
  .string()
  .trim()
  .transform((v) => v.replace(/\.eth$/i, ''))
  .pipe(z.union([z.literal(''), z.string().regex(ENS_RE, ENS_RULE)]))
  .transform((v) => (v === '' ? null : v))

export const REFERRAL_RULE = 'Use 4 a 12 letras ou números.'

export function lengthField(label: string, min: number, max: number) {
  return z
    .string()
    .trim()
    .min(min, `${label} precisa ter pelo menos ${min} caracteres.`)
    .max(max, `${label} pode ter no máximo ${max} caracteres.`)
}

export function isNetwork(value: unknown): value is NetworkId {
  return typeof value === 'string' && (NETWORKS as readonly string[]).includes(value)
}

export function isWalletProvider(value: unknown): value is WalletProvider {
  return typeof value === 'string' && (WALLET_PROVIDERS as readonly string[]).includes(value)
}

/** Endereço conforme a rede: 0x + 40 hex (ethereum/polygon) ou base58 32–44 (solana). */
export function addressError(address: string, network: NetworkId): string | null {
  const value = address.trim()
  if (!value) return 'Informe o endereço da carteira.'
  if (network === 'solana') return SOLANA_ADDRESS_RE.test(value) ? null : 'Endereço Solana inválido (base58, 32 a 44 caracteres).'
  return EVM_ADDRESS_RE.test(value) ? null : 'Endereço inválido: use 0x seguido de 40 caracteres hexadecimais.'
}

export function addressPlaceholder(network: string): string {
  return network === 'solana' ? 'Endereço base58 da carteira' : 'Endereço 0x da carteira'
}
