import { readJson, writeJson } from '@/lib/utils'
import { EMPTY_VALUES, type CheckoutFormValues } from './schema'

/**
 * Rascunho do formulário de pagamento em sessionStorage (`nft.checkout.<userId>`):
 * sobrevive a refresh e à reautenticação, some ao fechar a aba. Só dados do colecionador
 * e a carteira escolhida — nunca senha, token ou chave.
 */
export interface CheckoutDraft {
  values: CheckoutFormValues
  walletId: string | null
}

const draftKey = (userId: string) => `nft.checkout.${userId}`

export function readCheckoutDraft(userId: string): CheckoutDraft | null {
  const raw = readJson<Partial<CheckoutDraft>>(draftKey(userId), 'session')
  if (!raw || typeof raw !== 'object' || !raw.values || typeof raw.values !== 'object') return null
  // Só chaves conhecidas, com o tipo esperado (o storage pode ter sido editado à mão).
  const values = { ...EMPTY_VALUES }
  for (const key of Object.keys(EMPTY_VALUES) as (keyof CheckoutFormValues)[]) {
    const v = (raw.values as unknown as Record<string, unknown>)[key]
    if (typeof v === typeof EMPTY_VALUES[key]) Object.assign(values, { [key]: v })
  }
  return { values, walletId: typeof raw.walletId === 'string' ? raw.walletId : null }
}

export function writeCheckoutDraft(userId: string, draft: CheckoutDraft): void {
  writeJson(draftKey(userId), draft, 'session')
}

export function clearCheckoutDraft(userId: string): void {
  writeJson(draftKey(userId), null, 'session')
}
