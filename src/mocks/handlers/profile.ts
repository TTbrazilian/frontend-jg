import { http } from 'msw'
import { api, AVATAR_MAX_BYTES, AVATAR_TYPES } from '../config'
import { db, persist } from '../db/store'
import { hashHex, randomId } from '../lib/hash'
import { hashPassword, verifyPassword } from '../lib/password'
import { apiError, guard, json, noContent, readBody, validationError } from '../lib/respond'
import {
  ENS_RE,
  isStrongPassword,
  normalizeEmail,
  passwordRuleMessage,
  str,
  validateEmail,
  validateLength,
  validateUsername,
} from '../lib/validation'
import { requireUser, revokeSessions, toUser } from '../services/auth'

async function fileToDataUrl(file: Blob): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  return `data:${file.type};base64,${btoa(binary)}`
}

export const profileHandlers = [
  http.get(api('/me/profile'), ({ request }) => guard(() => json(toUser(requireUser(request).user)))),

  http.patch(api('/me/profile'), ({ request }) =>
    guard(async () => {
      const { user } = requireUser(request)
      const body = await readBody(request)
      const fieldErrors: Record<string, string> = {}
      const has = (k: string) => body[k] !== undefined

      if (has('displayName')) {
        const e = validateLength(str(body, 'displayName'), 2, 40, 'O nome de exibição')
        if (e) fieldErrors.displayName = e
      }
      if (has('username')) {
        const e = validateUsername(str(body, 'username'))
        if (e) fieldErrors.username = e
      }
      if (has('email')) {
        const e = validateEmail(str(body, 'email'))
        if (e) fieldErrors.email = e
      }
      let ensName: string | null | undefined
      if (has('ensName')) {
        const raw = body.ensName
        if (raw === null || raw === '') ensName = null
        else if (typeof raw === 'string' && ENS_RE.test(raw)) ensName = raw
        else fieldErrors.ensName = 'Use 3 a 32 caracteres: letras minúsculas, números ou hífen (sem ".eth").'
      }
      if (has('walletNickname')) {
        const e = validateLength(str(body, 'walletNickname'), 2, 32, 'O apelido da carteira')
        if (e) fieldErrors.walletNickname = e
      }
      if (Object.keys(fieldErrors).length) return validationError(fieldErrors)

      const email = has('email') ? normalizeEmail(str(body, 'email') as string) : undefined
      const username = str(body, 'username')
      const conflicts: Record<string, string> = {}
      if (email && db().users.some((u) => u.id !== user.id && u.email === email)) conflicts.email = 'Este e-mail já está em uso.'
      if (username && db().users.some((u) => u.id !== user.id && u.username === username)) conflicts.username = 'Este nome de usuário já está em uso.'
      if (Object.keys(conflicts).length) return apiError('CONFLICT', 'Dados já usados por outra conta.', { fieldErrors: conflicts })

      if (has('displayName')) user.displayName = (str(body, 'displayName') as string).trim()
      if (username) user.username = username
      if (email) user.email = email
      if (ensName !== undefined) user.ensName = ensName
      if (has('walletNickname')) user.walletNickname = (str(body, 'walletNickname') as string).trim()
      persist()
      return json(toUser(user))
    }),
  ),

  http.put(api('/me/avatar'), ({ request }) =>
    guard(async () => {
      const { user } = requireUser(request)
      let file: FormDataEntryValue | null
      try {
        file = (await request.formData()).get('avatar')
      } catch {
        file = null
      }
      if (!file || typeof file === 'string') return validationError({ avatar: 'Selecione uma imagem.' })
      if (!(AVATAR_TYPES as readonly string[]).includes(file.type)) return validationError({ avatar: 'Use uma imagem PNG, JPEG ou WebP.' })
      if (file.size > AVATAR_MAX_BYTES) return validationError({ avatar: 'A imagem deve ter no máximo 1 MB.' })
      user.avatarUrl = await fileToDataUrl(file)
      persist()
      return json(toUser(user))
    }),
  ),

  http.delete(api('/me/avatar'), ({ request }) =>
    guard(() => {
      const { user } = requireUser(request)
      user.avatarUrl = null
      persist()
      return json(toUser(user))
    }),
  ),

  http.post(api('/me/password'), ({ request }) =>
    guard(async () => {
      const { user, session } = requireUser(request)
      const body = await readBody(request)
      const currentPassword = str(body, 'currentPassword') ?? ''
      const newPassword = str(body, 'newPassword') ?? ''
      if (!(await verifyPassword(currentPassword, user.passwordSalt, user.passwordHash))) {
        return validationError({ currentPassword: 'Senha atual incorreta.' })
      }
      if (!isStrongPassword(newPassword)) return validationError({ newPassword: passwordRuleMessage })
      if (newPassword === currentPassword) return validationError({ newPassword: 'A nova senha deve ser diferente da atual.' })
      user.passwordSalt = hashHex(`salt:${randomId()}`, 32)
      user.passwordHash = await hashPassword(newPassword, user.passwordSalt)
      persist()
      // Mantém a sessão atual e encerra as demais.
      revokeSessions({ userId: user.id, keepToken: session.token })
      return noContent()
    }),
  ),
]
