import { http } from 'msw'
import type { NetworkId, Wallet, WalletConnection, WalletProvider, WalletRole } from '@/api/contracts'
import { api } from '../config'
import { db, nowIso, persist } from '../db/store'
import type { DbWallet } from '../db/types'
import { randomId } from '../lib/hash'
import { apiError, guard, json, MockHttpError, noContent, param, readBody, validationError } from '../lib/respond'
import {
  isNetwork,
  isWalletProvider,
  normalizeEmail,
  str,
  validateAddress,
  validateEmail,
  validateEnsName,
  validateLength,
  validateReferralCode,
} from '../lib/validation'
import { isScenario } from '../scenarios'
import { requireUser } from '../services/auth'

const ROLE_LABEL: Record<WalletRole, string> = { primary: 'principal', secondary: 'secundária' }

const toWallet = ({ userId: _userId, ...wallet }: DbWallet): Wallet => wallet

function userWallets(userId: string): DbWallet[] {
  return db()
    .wallets.filter((w) => w.userId === userId)
    .sort((a, b) => (a.role === b.role ? a.createdAt.localeCompare(b.createdAt) : a.role === 'primary' ? -1 : 1))
}

function requireWallet(userId: string, id: string): DbWallet {
  const wallet = db().wallets.find((w) => w.id === id && w.userId === userId)
  if (!wallet) throw new MockHttpError('NOT_FOUND', 'Carteira não encontrada.')
  return wallet
}

const sameAddress = (a: string, b: string, network: NetworkId) => (network === 'solana' ? a === b : a.toLowerCase() === b.toLowerCase())

/** Valida os campos presentes (todos obrigatórios quando `partial` é false). */
function validateWallet(body: Record<string, unknown>, partial: boolean, existing?: DbWallet): Record<string, string> {
  const errors: Record<string, string> = {}
  const check = (key: string, fn: () => string | null) => {
    if (partial && body[key] === undefined) return
    const e = fn()
    if (e) errors[key] = e
  }
  check('role', () => (body.role === 'primary' || body.role === 'secondary' ? null : 'Selecione principal ou secundária.'))
  check('displayName', () => validateLength(str(body, 'displayName'), 2, 40, 'O nome de exibição'))
  check('nickname', () => validateLength(str(body, 'nickname'), 2, 40, 'O apelido'))
  check('profileName', () => validateLength(str(body, 'profileName'), 2, 40, 'O nome do perfil'))
  check('network', () => (isNetwork(body.network) ? null : 'Selecione uma rede válida.'))
  check('provider', () => (isWalletProvider(body.provider) ? null : 'Selecione o tipo de carteira.'))
  check('referralCode', () => validateReferralCode(str(body, 'referralCode')))
  check('email', () => validateEmail(str(body, 'email')))
  check('ensName', () => validateEnsName(str(body, 'ensName')))
  check('ensOrSecondary', () => {
    const v = body.ensOrSecondary
    return v === null || v === undefined || (typeof v === 'string' && v.length <= 64) ? null : 'Use até 64 caracteres.'
  })
  // Endereço depende da rede (nova ou atual): revalida quando qualquer um dos dois muda.
  const network = isNetwork(body.network) ? body.network : existing?.network
  if (!partial || body.address !== undefined || body.network !== undefined) {
    const address = str(body, 'address') ?? existing?.address
    if (network) {
      const e = validateAddress(address, network)
      if (e) errors.address = e
    }
  }
  return errors
}

export const walletHandlers = [
  http.get(api('/me/wallets'), ({ request }) =>
    guard(() => {
      const { user } = requireUser(request)
      return json({ items: userWallets(user.id).map(toWallet) })
    }),
  ),

  http.post(api('/me/wallets'), ({ request }) =>
    guard(async () => {
      const { user } = requireUser(request)
      const body = await readBody(request)
      const errors = validateWallet(body, false)
      if (Object.keys(errors).length) return validationError(errors)

      const role = body.role as WalletRole
      const network = body.network as NetworkId
      const address = (str(body, 'address') as string).trim()
      const mine = userWallets(user.id)
      const conflicts: Record<string, string> = {}
      // Regra: no máximo 1 principal e 1 secundária (logo, no máximo 2 carteiras).
      if (mine.some((w) => w.role === role)) conflicts.role = `Você já tem uma carteira ${ROLE_LABEL[role]}.`
      if (mine.some((w) => sameAddress(w.address, address, network))) conflicts.address = 'Este endereço já está cadastrado.'
      if (Object.keys(conflicts).length) return apiError('CONFLICT', 'Não foi possível adicionar a carteira.', { fieldErrors: conflicts })

      const now = nowIso()
      const ensOrSecondary = str(body, 'ensOrSecondary')?.trim()
      const wallet: DbWallet = {
        id: `wal_${randomId()}`,
        userId: user.id,
        role,
        displayName: (str(body, 'displayName') as string).trim(),
        nickname: (str(body, 'nickname') as string).trim(),
        network,
        profileName: (str(body, 'profileName') as string).trim(),
        address,
        ensOrSecondary: ensOrSecondary ? ensOrSecondary : null,
        provider: body.provider as WalletProvider,
        referralCode: (str(body, 'referralCode') as string).trim().toUpperCase(),
        email: normalizeEmail(str(body, 'email') as string),
        ensName: str(body, 'ensName') as string,
        createdAt: now,
        updatedAt: now,
      }
      db().wallets.push(wallet)
      persist()
      return json(toWallet(wallet), 201)
    }),
  ),

  /**
   * PATCH parcial. Trocar `role` para um papel ocupado faz SWAP: a outra carteira
   * assume o papel antigo desta (ex.: "tornar principal").
   */
  http.patch(api('/me/wallets/:id'), ({ request, params }) =>
    guard(async () => {
      const { user } = requireUser(request)
      const wallet = requireWallet(user.id, param(params, 'id'))
      const body = await readBody(request)
      const errors = validateWallet(body, true, wallet)
      if (Object.keys(errors).length) return validationError(errors)

      const network = isNetwork(body.network) ? body.network : wallet.network
      const address = str(body, 'address')?.trim() ?? wallet.address
      const others = userWallets(user.id).filter((w) => w.id !== wallet.id)
      if (others.some((w) => sameAddress(w.address, address, network))) {
        return apiError('CONFLICT', 'Este endereço já está cadastrado.', { fieldErrors: { address: 'Este endereço já está cadastrado.' } })
      }

      const now = nowIso()
      if ((body.role === 'primary' || body.role === 'secondary') && body.role !== wallet.role) {
        const holder = others.find((w) => w.role === body.role)
        if (holder) {
          holder.role = wallet.role
          holder.updatedAt = now
        }
        wallet.role = body.role
      }
      const text = (k: string) => str(body, k)?.trim()
      if (text('displayName') !== undefined) wallet.displayName = text('displayName') as string
      if (text('nickname') !== undefined) wallet.nickname = text('nickname') as string
      if (text('profileName') !== undefined) wallet.profileName = text('profileName') as string
      if (body.ensOrSecondary !== undefined) wallet.ensOrSecondary = text('ensOrSecondary') || null
      if (isWalletProvider(body.provider)) wallet.provider = body.provider
      if (text('referralCode') !== undefined) wallet.referralCode = (text('referralCode') as string).toUpperCase()
      if (text('email') !== undefined) wallet.email = normalizeEmail(text('email') as string)
      if (str(body, 'ensName') !== undefined) wallet.ensName = str(body, 'ensName') as string
      if (network !== wallet.network) {
        wallet.network = network
        // Conexões em outra rede deixam de valer.
        db().walletConnections = db().walletConnections.filter((c) => c.walletId !== wallet.id)
      }
      wallet.address = address
      wallet.updatedAt = now
      persist()
      return json(toWallet(wallet))
    }),
  ),

  http.post(api('/me/wallets/:id/connect'), ({ request, params }) =>
    guard(async () => {
      const { user } = requireUser(request)
      const wallet = requireWallet(user.id, param(params, 'id'))
      const body = await readBody(request)
      if (!isNetwork(body.network)) return validationError({ network: 'Selecione uma rede válida.' })
      if (body.network !== wallet.network) {
        return validationError({ network: `A carteira "${wallet.nickname}" só opera na rede ${wallet.network}.` })
      }
      if (isScenario('wallet-rejected')) return apiError('WALLET_REJECTED', 'A conexão foi recusada na carteira.')
      const connectedAt = nowIso()
      db().walletConnections = db().walletConnections.filter((c) => c.walletId !== wallet.id)
      db().walletConnections.push({ walletId: wallet.id, network: body.network, connectedAt })
      persist()
      const connection: WalletConnection = { walletId: wallet.id, network: body.network, status: 'connected', connectedAt }
      return json(connection)
    }),
  ),

  http.post(api('/me/wallets/:id/disconnect'), ({ request, params }) =>
    guard(() => {
      const { user } = requireUser(request)
      const wallet = requireWallet(user.id, param(params, 'id'))
      db().walletConnections = db().walletConnections.filter((c) => c.walletId !== wallet.id)
      persist()
      return noContent()
    }),
  ),
]
