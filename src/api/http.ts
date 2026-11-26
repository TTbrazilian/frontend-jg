import axios, { type InternalAxiosRequestConfig } from 'axios'
import { getGuestCartId, sessionStore } from '@/app/session-store'
import { toApiError } from './errors'

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

export const http = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
})

http.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const { token } = sessionStore.get()
  if (token) config.headers.set('Authorization', `Bearer ${token}`)
  config.headers.set('X-Guest-Cart-Id', getGuestCartId())
  return config
})

http.interceptors.response.use(
  (response) => response,
  (error) => {
    const apiError = toApiError(error)
    // Token rejeitado: marcamos a sessão como expirada. Login (INVALID_CREDENTIALS) não entra aqui.
    if (apiError.code === 'SESSION_EXPIRED' || (apiError.code === 'UNAUTHENTICATED' && sessionStore.get().token)) {
      sessionStore.expire()
    }
    // Preserva cancelamento como está (TanStack Query ignora CanceledError).
    if (axios.isCancel(error)) return Promise.reject(error)
    return Promise.reject(apiError)
  },
)
