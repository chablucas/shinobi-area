import type { Request, Response } from 'express'
import { simulateFight, type ShinobiBuild } from '../game/gameEngine.js'

export function postSimulation(request: Request, response: Response) {
  const { player1, player2 } = request.body ?? {}
  if (!player1 || !player2 || typeof player1 !== 'object' || typeof player2 !== 'object') {
    response.status(400).json({ error: 'Les compositions des deux joueurs sont requises.' })
    return
  }

  const result = simulateFight(player1 as ShinobiBuild, player2 as ShinobiBuild)
  response.status(result.player1.validationErrors.length || result.player2.validationErrors.length ? 422 : 200).json({ ...result, resolutionMode: 'simulation' })
}