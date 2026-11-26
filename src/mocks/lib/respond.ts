import type { ApiErrorBody, ApiErrorCode } from '@/api/contracts'

/** Status HTTP canônico de cada código (ver comentários em ApiErrorCode). */
const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  VALIDATION_ERROR: 422,
  INVALID_CREDENTIALS: 401,
  UNAUTHENTICATED: 401,
  SESSION_EXPIRED: 401,
  FORBIDDEN: 403,
  WALLET_REJECTED: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  AVAILABILITY_CONFLICT: 409,
  QUOTE_STALE: 409,
  IDEMPOTENCY_CONFLICT: 409,
  COUPON_INVALID: 422,
  COUPON_EXPIRED: 422,
  RATE_LIMITED: 429,
  SERVICE_UNAVAILABLE: 503,
  INTERNAL_ERROR: 500,
  NETWORK_ERROR: 0,
  TIMEOUT: 0,
}

export interface ApiErrorOptions {
  status?: number
  fieldErrors?: Record<string, string>
  retryable?: boolean
  details?: unknown
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
}

export function noContent(): Response {
  return new Response(null, { status: 204 })
}

export function errorBody(code: ApiErrorCode, message: string, opts: ApiErrorOptions = {}): { status: number; body: ApiErrorBody } {
  const status = opts.status ?? STATUS_BY_CODE[code]
  const retryable = opts.retryable ?? (status >= 500 || status === 429)
  const body: ApiErrorBody = { error: { code, message, retryable } }
  if (opts.fieldErrors && Object.keys(opts.fieldErrors).length > 0) body.error.fieldErrors = opts.fieldErrors
  if (opts.details !== undefined) body.error.details = opts.details
  return { status, body }
}

export function apiError(code: ApiErrorCode, message: string, opts: ApiErrorOptions = {}): Response {
  const { status, body } = errorBody(code, message, opts)
  return json(body, status)
}

export function validationError(fieldErrors: Record<string, string>, message = 'Verifique os campos destacados.'): Response {
  return apiError('VALIDATION_ERROR', message, { fieldErrors })
}

export const notFound = (message = 'Recurso não encontrado.'): Response => apiError('NOT_FOUND', message)

/** Erro de domínio lançado pelos serviços e convertido em resposta pelos handlers. */
export class MockHttpError extends Error {
  readonly code: ApiErrorCode
  readonly options: ApiErrorOptions

  constructor(code: ApiErrorCode, message: string, options: ApiErrorOptions = {}) {
    super(message)
    this.name = 'MockHttpError'
    this.code = code
    this.options = options
  }

  toResponse(): Response {
    return apiError(this.code, this.message, this.options)
  }
}

/** Executa um handler convertendo MockHttpError em resposta; outros erros viram 500. */
export async function guard(fn: () => Response | Promise<Response>): Promise<Response> {
  try {
    return await fn()
  } catch (error) {
    if (error instanceof MockHttpError) return error.toResponse()
    console.error('[mocks] erro inesperado no handler', error)
    return apiError('INTERNAL_ERROR', 'Erro interno no servidor simulado.')
  }
}

/** Lê o corpo JSON; corpo ausente/ inválido vira objeto vazio (validação decide). */
export async function readBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const text = await request.text()
    if (!text) return {}
    const parsed: unknown = JSON.parse(text)
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

export function param(params: Record<string, string | readonly string[] | undefined>, key: string): string {
  const value = params[key]
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return String(value[0] ?? '')
  return ''
}
