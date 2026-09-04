import { io, type Socket } from 'socket.io-client'
import { API_BASE_URL } from './cardApi'
import type { RealtimeGameState } from './socialApi'

function socketUrl() {
  if (API_BASE_URL.startsWith('http')) return new URL(API_BASE_URL).origin
  return window.location.origin
}

export function connectGameSocket(token: string): GameSocket {
  return io(socketUrl(), { auth: { token }, autoConnect: true })
}

export type GameSocket = Socket<
  { 'game:state': (state: RealtimeGameState) => void; 'game:error': (error: { message: string }) => void },
  { 'game:join': (gameId: string, acknowledge?: (response: { ok: boolean; message?: string }) => void) => void; 'game:request-state': () => void; 'game:draw': (gameId: string) => void; 'game:place-card': (payload: { gameId: string; category: string }) => void }
>
