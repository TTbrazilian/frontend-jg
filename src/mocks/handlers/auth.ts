import { http } from 'msw'
import { api } from '../config'
import { db, persist } from '../db/store'
import type { DbUser } from '../db/types'
import { hashHex, randomId } from '../lib/hash'
import { hashPassword, verifyPassword } from '../lib/password'
import { guard, json, noContent, readBody, apiError, validationError } from '../lib/respond'
import {
  isStrongPassword,
  normalizeEmail,
  passwordRuleMessage,
  str,
  validateEmail,
  validateUsername,
} from '../lib/validation'
import { createSession, readBearer, requireUser, revokeSession, toSession } from '../services/auth'

export const authHandlers = [
  http.post(api('/auth/register'), ({ request }) =>
    guard(async () => {
      const body = await readBody(request)
      const username = str(body, 'username')
      const email = str(body, 'email')
      const password = str(body, 'password') ?? ''
      const fieldErrors: Record<string, string> = {}
      const usernameError = validateUsername(username)
      if (usernameError) fieldErrors.username = usernameError
      const emailError = validateEmail(email)
      if (emailError) fieldErrors.email = emailError
      if (!isStrongPassword(password)) fieldErrors.password = passwordRuleMessage
      if (Object.keys(fieldErrors).length) return validationError(fieldErrors)

      const normalizedEmail = normalizeEmail(email as string)
      const conflicts: Record<string, string> = {}
      if (db().users.some((u) => u.email === normalizedEmail)) conflicts.email = 'Este e-mail já está cadastrado.'
      if (db().users.some((u) => u.username === username)) conflicts.username = 'Este nome de usuário já está em uso.'
      if (Object.keys(conflicts).length) return apiError('CONFLICT', 'Já existe uma conta com esses dados.', { fieldErrors: conflicts })

      const passwordSalt = hashHex(`salt:${randomId()}`, 32)
      const user: DbUser = {
        id: `usr-${randomId()}`,
        displayName: username as string,
        username: username as string,
        email: normalizedEmail,
        ensName: null,
        walletNickname: 'Principal',
        avatarUrl: null,
        createdAt: new Date().toISOString(),
        passwordSalt,
        passwordHash: await hashPassword(password, passwordSalt),
      }
      db().users.push(user)
      db().favorites[user.id] = []
      persist()
      return json(toSession(createSession(user.id), user), 201)
    }),
  ),

  http.post(api('/auth/login'), ({ request }) =>
    guard(async () => {
      const body = await readBody(request)
      const email = str(body, 'email')
      const password = str(body, 'password')
      const fieldErrors: Record<string, string> = {}
      if (!email?.trim()) fieldErrors.email = 'Informe seu e-mail.'
      if (!password) fieldErrors.password = 'Informe sua senha.'
      if (Object.keys(fieldErrors).length) return validationError(fieldErrors)

      const user = db().users.find((u) => u.email === normalizeEmail(email as string))
      const valid = user ? await verifyPassword(password as string, user.passwordSalt, user.passwordHash) : false
      if (!user || !valid) return apiError('INVALID_CREDENTIALS', 'E-mail ou senha incorretos.')
      return json(toSession(createSession(user.id), user))
    }),
  ),

  http.get(api('/auth/session'), ({ request }) =>
    guard(() => {
      const { user, session } = requireUser(request)
      return json(toSession(session, user))
    }),
  ),

  http.post(api('/auth/logout'), ({ request }) =>
    guard(() => {
      const token = readBearer(request)
      if (token) revokeSession(token)
      return noContent()
    }),
  ),
]
