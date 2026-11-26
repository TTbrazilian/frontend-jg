import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * A escala tipográfica do Figma (`text-body`, `text-title-sm`…) é customizada: sem registrá-la,
 * o tailwind-merge a confunde com cores e descarta tamanho OU cor (ex.: `text-body-md text-foreground`).
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        { text: ['tiny', 'caption', 'body-sm', 'body', 'body-md', 'body-lg', 'title-sm', 'title', 'heading', 'heading-lg', 'display-sm', 'display'] },
      ],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

export function shortAddress(address: string, size = 4): string {
  if (address.length <= size * 2 + 2) return address
  return `${address.slice(0, size + 2)}…${address.slice(-size)}`
}

export function safeStorage(kind: 'local' | 'session' = 'local'): Storage | null {
  try {
    const s = kind === 'local' ? window.localStorage : window.sessionStorage
    const k = '__probe__'
    s.setItem(k, k)
    s.removeItem(k)
    return s
  } catch {
    return null
  }
}

export function readJson<T>(key: string, kind: 'local' | 'session' = 'local'): T | null {
  const s = safeStorage(kind)
  if (!s) return null
  try {
    const raw = s.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function writeJson(key: string, value: unknown, kind: 'local' | 'session' = 'local'): void {
  const s = safeStorage(kind)
  if (!s) return
  try {
    if (value === null || value === undefined) s.removeItem(key)
    else s.setItem(key, JSON.stringify(value))
  } catch {
    /* quota/privacidade: ignorar */
  }
}
