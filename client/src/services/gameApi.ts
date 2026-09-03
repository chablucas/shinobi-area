import { API_BASE_URL } from './cardApi'
import type { CombatComposition, CombatResult } from '../types/combat'

export class CombatApiError extends Error {
  constructor(message: string, public readonly result?: CombatResult) { super(message); this.name = 'CombatApiError' }
}

export async function simulateFight(player1: CombatComposition, player2: CombatComposition): Promise<CombatResult> {
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}/game/simulate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ player1, player2 }) })
  } catch {
    throw new CombatApiError('Le serveur de combat est indisponible.')
  }
  const payload = await response.json().catch(() => null) as CombatResult | { error?: string } | null
  if (!response.ok) {
    const message = payload && 'error' in payload && payload.error ? payload.error : 'La simulation du combat a échoué.'
    throw new CombatApiError(message, payload && 'player1' in payload ? payload : undefined)
  }
  if (!payload || !('player1' in payload) || !('player2' in payload)) throw new CombatApiError('Réponse de combat invalide.')
  return { ...payload, resolutionMode: 'simulation' }
}