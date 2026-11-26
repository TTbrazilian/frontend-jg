import { ws, type WebSocketHandlerConnection } from 'msw'
import { toSocketIo } from '@mswjs/socket.io-binding'
import type { NftUpdatedEvent, Order, OrderUpdatedEvent, RealtimeEnvelope, RealtimeEventType } from '@/api/contracts'
import { SOCKET_PING_INTERVAL_MS } from './config'
import { db } from './db/store'
import { stableUuid } from './lib/hash'
import { isScenario } from './scenarios'

/**
 * Servidor Socket.IO simulado sobre o `ws` do MSW + @mswjs/socket.io-binding.
 *
 * - O MSW reescreve `/socket.io/` para `/` antes de casar a URL do handler, então
 *   `ws.link(/\/socket\.io\//)` NUNCA casa. Casamos a origem do socket (ws/wss) e, dentro
 *   da conexão, conferimos `client.url.pathname`; o que não for `/socket.io/*`
 *   (ex.: HMR do Vite) segue para o servidor real via `server.connect()`.
 * - Identidade: lida do pacote CONNECT bruto do cliente (`40{"token":…,"guestCartId":…}`).
 * - Heartbeat: o binding anuncia pingInterval 25s/pingTimeout 5s mas nunca envia ping;
 *   enviamos `2` (ping Engine.IO) a cada 20s para o cliente não derrubar a conexão.
 * - Limitações: só namespace "/", sem rooms, sem polling (cliente usa só websocket),
 *   sem ack. Reconexão é exercitada fechando a conexão do lado do servidor.
 */

type Client = WebSocketHandlerConnection['client']
type SocketIoConnection = ReturnType<typeof toSocketIo>

interface ConnectionEntry {
  id: string
  client: Client
  io: SocketIoConnection
  token: string | null
  guestCartId: string | null
  /** true depois que o pacote CONNECT do cliente foi recebido. */
  identified: boolean
  pingTimer: ReturnType<typeof setInterval> | null
}

const connections = new Map<string, ConnectionEntry>()
const recentNftEvents = new Map<string, NftUpdatedEvent>()
let lastNftEvent: NftUpdatedEvent | null = null
let staleCounter = 0

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function socketHostPattern(): RegExp {
  const configured = import.meta.env.VITE_SOCKET_URL
  const fallback = typeof window !== 'undefined' ? window.location.origin : 'http://localhost'
  let host: string
  try {
    host = new URL(configured || fallback).host
  } catch {
    host = new URL(fallback).host
  }
  return new RegExp(`^wss?://${escapeRegExp(host)}/?$`)
}

/** Sessão válida → userId; inválida/expirada/revogada → null. Reavaliado a cada emissão. */
function userIdForToken(token: string | null): string | null {
  if (!token) return null
  const session = db().sessions.find((s) => s.token === token)
  if (!session || session.revokedAt || Date.parse(session.expiresAt) <= Date.now()) return null
  return session.userId
}

function parseConnectPacket(raw: string): { token: string | null; guestCartId: string | null } {
  // Namespace padrão: "40" + JSON opcional. (Namespaces customizados não são suportados.)
  if (!raw) return { token: null, guestCartId: null }
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return { token: null, guestCartId: null }
    const p = parsed as Record<string, unknown>
    return {
      token: typeof p.token === 'string' && p.token ? p.token : null,
      guestCartId: typeof p.guestCartId === 'string' && p.guestCartId ? p.guestCartId : null,
    }
  } catch {
    return { token: null, guestCartId: null }
  }
}

export function envelope<TType extends RealtimeEventType, TData>(
  type: TType,
  resource: { type: 'nft' | 'order'; id: string },
  version: number,
  data: TData,
  eventIdSeed?: string,
): RealtimeEnvelope<TType, TData> {
  return {
    // Estável por (geração do DB, recurso, versão): reemissões do mesmo estado têm o mesmo id.
    eventId: stableUuid(eventIdSeed ?? `${db().epoch}:${type}:${resource.id}:v${version}`),
    type,
    resource,
    version,
    occurredAt: new Date().toISOString(),
    data,
  }
}

export function orderEvent(order: Order): OrderUpdatedEvent {
  return envelope('order.updated', { type: 'order', id: order.id }, order.version, { order })
}

export function nextStaleSeed(nftId: string): string {
  staleCounter += 1
  return `${db().epoch}:stale:${nftId}:${staleCounter}`
}

function rememberNftEvent(event: NftUpdatedEvent): void {
  lastNftEvent = event
  recentNftEvents.set(event.eventId, event)
  if (recentNftEvents.size > 100) {
    const oldest = recentNftEvents.keys().next().value
    if (oldest !== undefined) recentNftEvents.delete(oldest)
  }
}

/** Envia `nft.updated` para todas as conexões identificadas. */
export function broadcastNftUpdated(event: NftUpdatedEvent, { remember = true } = {}): void {
  if (remember) rememberNftEvent(event)
  for (const conn of connections.values()) {
    if (conn.identified) conn.io.client.emit('nft.updated', event)
  }
}

/** Envia um evento apenas para as conexões cujo token pertence ao usuário. */
export function emitToUser(userId: string, event: OrderUpdatedEvent): void {
  for (const conn of connections.values()) {
    if (conn.identified && userIdForToken(conn.token) === userId) conn.io.client.emit(event.type, event)
  }
}

export function getLastNftEvent(): NftUpdatedEvent | null {
  return lastNftEvent
}

export function findNftEvent(eventId: string): NftUpdatedEvent | null {
  return recentNftEvents.get(eventId) ?? null
}

export function clearRealtimeMemory(): void {
  lastNftEvent = null
  recentNftEvents.clear()
  staleCounter = 0
}

/** Fecha as conexões do lado do servidor; o socket.io-client reconecta e o MSW intercepta de novo. */
export function disconnectAllSockets(code = 1012, reason = 'server restart'): number {
  const all = [...connections.values()]
  all.forEach((conn) => conn.client.close(code, reason))
  return all.length
}

export function connectionCount(): number {
  return connections.size
}

function handleSocketIoConnection(connection: WebSocketHandlerConnection): void {
  const { client } = connection

  // Cenário offline: recusa a conexão (o cliente fica tentando reconectar com backoff).
  if (isScenario('offline')) {
    client.close(1013, 'offline')
    return
  }

  // Precisa ser chamado de forma síncrona: o binding envia o handshake num microtask.
  const io = toSocketIo(connection)
  const entry: ConnectionEntry = { id: client.id, client, io, token: null, guestCartId: null, identified: false, pingTimer: null }
  connections.set(client.id, entry)

  client.addEventListener('message', (event) => {
    const data: unknown = event.data
    if (typeof data !== 'string' || !data.startsWith('40')) return
    const { token, guestCartId } = parseConnectPacket(data.slice(2))
    entry.token = token
    entry.guestCartId = guestCartId
    entry.identified = true
    io.client.emit('session.ready', { userId: userIdForToken(token) })
  })

  io.client.on('order.watch', (_event, payload: unknown) => {
    const orderId = typeof payload === 'object' && payload !== null ? (payload as Record<string, unknown>).orderId : undefined
    if (typeof orderId !== 'string') return
    const userId = userIdForToken(entry.token)
    const record = db().orders.find((o) => o.order.id === orderId)
    // Não vaza existência de pedidos de outros usuários.
    if (!userId || !record || record.order.userId !== userId) return
    io.client.emit('order.updated', orderEvent(record.order))
  })

  entry.pingTimer = setInterval(() => client.send('2'), SOCKET_PING_INTERVAL_MS)

  client.addEventListener('close', () => {
    if (entry.pingTimer) clearInterval(entry.pingTimer)
    connections.delete(client.id)
  })
}

export function createSocketHandler() {
  return ws.link(socketHostPattern()).addEventListener('connection', (connection) => {
    if (!connection.client.url.pathname.startsWith('/socket.io')) {
      // Não é Socket.IO (ex.: HMR do Vite): deixa passar para o servidor real.
      connection.server.connect()
      return
    }
    handleSocketIoConnection(connection)
  })
}
