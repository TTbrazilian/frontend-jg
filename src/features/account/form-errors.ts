import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import { toApiError, type ApiError } from '@/api/errors'

/**
 * Aplica `fieldErrors` da API (409/422) nos campos conhecidos do formulário,
 * focando o primeiro. Erros de campos que o formulário não tem voltam em `rest`.
 */
export function applyApiFieldErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
): { apiError: ApiError; applied: boolean; rest: string[] } {
  const apiError = toApiError(error)
  const rest: string[] = []
  let applied = false
  // Ordem do formulário (não a da resposta): o foco vai para o primeiro campo com erro na tela.
  for (const field of fields) {
    const message = apiError.fieldErrors[field]
    if (message === undefined) continue
    setError(field, { type: 'server', message }, { shouldFocus: !applied })
    applied = true
  }
  for (const [key, message] of Object.entries(apiError.fieldErrors)) {
    if (!(fields as readonly string[]).includes(key)) rest.push(message)
  }
  return { apiError, applied, rest }
}

/** Classe para `FormField` cuja dica é só para leitor de tela: tira o `<p>` da dica do fluxo (sem espaço vazio). */
export const SR_ONLY_HINT = '[&>p[id$=-hint]]:sr-only'
