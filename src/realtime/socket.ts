import { io, type Socket } from 'socket.io-client'
import type { ClientToServerEvents, ServerToClientEvents } from '@/api/contracts'

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>

/** URL do servidor Socket.IO. Em mocks, a conexão WebSocket é interceptada pelo MSW. */
export function socketUrl(): string {
  return import.meta.env.VITE_SOCKET_URL || window.location.origin
}

/**
 * Cria um socket para a identidade atual. Usamos apenas o transporte WebSocket:
 * é o único que o MSW intercepta (polling HTTP do Engine.IO não é suportado pelo binding).
 * O token vai no pacote CONNECT (auth), nunca na URL.
 */
export function createSocket(auth: { token: string | null; guestCartId: string }): AppSocket {
  return io(socketUrl(), {
    path: '/socket.io',
    transports: ['websocket'],
    autoConnect: false,
    auth,
    reconnection: true,
    reconnectionDelay: 500,
    reconnectionDelayMax: 4_000,
    timeout: 5_000,
  })
}
