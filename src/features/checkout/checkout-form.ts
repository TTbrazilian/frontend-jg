import type { Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { z } from 'zod'
import { collectorSchema, FIELD_ORDER, type CheckoutFieldName, type CheckoutFormValues } from './schema'

export type CollectorOutput = z.output<typeof collectorSchema>

/**
 * O formulário guarda selects vazios ('') até a escolha; o schema rejeita '' com a mensagem
 * do campo. O cast alinha os tipos de entrada do RHF com os do zod.
 */
export const checkoutResolver = zodResolver(collectorSchema) as unknown as Resolver<CheckoutFormValues, unknown, CollectorOutput>

/** `collector.email` (API) → `email` (formulário). `network` do pedido também cai no campo Rede. */
export function formFieldFromApiKey(key: string): CheckoutFieldName | null {
  const name = key.startsWith('collector.') ? key.slice('collector.'.length) : key === 'network' ? 'network' : null
  return name && (FIELD_ORDER as string[]).includes(name) ? (name as CheckoutFieldName) : null
}

/** Primeiro campo com erro na ordem visual (foco). */
export function firstInvalidField(errors: Partial<Record<CheckoutFieldName, unknown>>): CheckoutFieldName | null {
  return FIELD_ORDER.find((f) => errors[f]) ?? null
}
