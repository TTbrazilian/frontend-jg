import { AxiosError, isAxiosError, isCancel } from 'axios'
import type { ApiErrorBody, ApiErrorCode } from './contracts'

export class ApiError extends Error {
  readonly code: ApiErrorCode
  readonly status: number
  readonly fieldErrors: Record<string, string>
  readonly retryable: boolean
  readonly details: unknown

  constructor(params: {
    code: ApiErrorCode
    message: string
    status: number
    fieldErrors?: Record<string, string>
    retryable?: boolean
    details?: unknown
  }) {
    super(params.message)
    this.name = 'ApiError'
    this.code = params.code
    this.status = params.status
    this.fieldErrors = params.fieldErrors ?? {}
    this.retryable = params.retryable ?? false
    this.details = params.details
  }

  get isAuthError() {
    return this.code === 'SESSION_EXPIRED' || this.code === 'UNAUTHENTICATED'
  }
}

function isApiErrorBody(data: unknown): data is ApiErrorBody {
  return typeof data === 'object' && data !== null && 'error' in data && typeof (data as ApiErrorBody).error?.code === 'string'
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error
  if (isAxiosError(error)) {
    const axiosError = error as AxiosError<unknown>
    if (axiosError.code === AxiosError.ECONNABORTED || axiosError.code === AxiosError.ETIMEDOUT) {
      return new ApiError({ code: 'TIMEOUT', message: 'O servidor demorou para responder.', status: 0, retryable: true })
    }
    const res = axiosError.response
    if (!res) {
      return new ApiError({ code: 'NETWORK_ERROR', message: 'Sem conexão com o servidor.', status: 0, retryable: true })
    }
    if (isApiErrorBody(res.data)) {
      const e = res.data.error
      return new ApiError({ code: e.code, message: e.message, status: res.status, fieldErrors: e.fieldErrors, retryable: e.retryable, details: e.details })
    }
    return new ApiError({
      code: res.status >= 500 ? 'INTERNAL_ERROR' : 'VALIDATION_ERROR',
      message: 'Erro inesperado.',
      status: res.status,
      retryable: res.status >= 500,
    })
  }
  return new ApiError({ code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Erro inesperado.', status: 0 })
}

export function isCancelledRequest(error: unknown): boolean {
  return isCancel(error) || (error instanceof Error && error.name === 'CanceledError')
}

export function errorMessage(error: unknown): string {
  return toApiError(error).message
}
