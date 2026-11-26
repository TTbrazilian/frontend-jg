import { NETWORKS, WALLET_PROVIDERS, type NetworkId, type WalletProvider } from '@/api/contracts'

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
export const USERNAME_RE = /^[a-z0-9_]{3,20}$/
export const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/
export const SOLANA_ADDRESS_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
export const ENS_RE = /^[a-z0-9-]{3,32}$/
export const REFERRAL_RE = /^[A-Z0-9]{4,12}$/i
export const ETH_RE = /^\d+(\.\d{1,18})?$/

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isPositiveInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1
}

export function str(body: Record<string, unknown>, key: string): string | undefined {
  const value = body[key]
  return typeof value === 'string' ? value : undefined
}

export function isStrongPassword(password: string): boolean {
  return password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password)
}

export const passwordRuleMessage = 'A senha precisa ter pelo menos 8 caracteres, com letras e números.'

/** Texto obrigatório com tamanho entre min e max (após trim). */
export function validateLength(value: string | undefined, min: number, max: number, label: string): string | null {
  const v = value?.trim() ?? ''
  if (v.length < min) return `${label} precisa ter pelo menos ${min} caracteres.`
  if (v.length > max) return `${label} pode ter no máximo ${max} caracteres.`
  return null
}

export function validateEnsName(value: string | undefined): string | null {
  if (value === undefined || !ENS_RE.test(value)) return 'Use 3 a 32 caracteres: letras minúsculas, números ou hífen (sem ".eth").'
  return null
}

export function validateReferralCode(value: string | undefined): string | null {
  if (value === undefined || !REFERRAL_RE.test(value.trim())) return 'Use 4 a 12 letras ou números.'
  return null
}

/** Endereço conforme a rede: 0x + 40 hex (ethereum/polygon) ou base58 32–44 (solana). */
export function validateAddress(value: string | undefined, network: NetworkId): string | null {
  if (value === undefined) return 'Informe o endereço da carteira.'
  if (network === 'solana') return SOLANA_ADDRESS_RE.test(value.trim()) ? null : 'Endereço Solana inválido (base58, 32 a 44 caracteres).'
  return ADDRESS_RE.test(value.trim()) ? null : 'Endereço inválido: use 0x seguido de 40 caracteres hexadecimais.'
}

export function isNetwork(value: unknown): value is NetworkId {
  return typeof value === 'string' && (NETWORKS as readonly string[]).includes(value)
}

export function isWalletProvider(value: unknown): value is WalletProvider {
  return typeof value === 'string' && (WALLET_PROVIDERS as readonly string[]).includes(value)
}

export function validateUsername(username: string | undefined): string | null {
  if (username === undefined || !USERNAME_RE.test(username)) return 'Use 3 a 20 caracteres: letras minúsculas, números ou _.'
  return null
}

export function validateEmail(email: string | undefined): string | null {
  if (email === undefined || !EMAIL_RE.test(email.trim())) return 'Informe um e-mail válido.'
  return null
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/** Remove acentos e caixa para busca textual. */
export function normalizeText(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}
