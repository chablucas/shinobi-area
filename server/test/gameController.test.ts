import assert from 'node:assert/strict'
import test from 'node:test'
import { postSimulation } from '../src/controllers/gameController.js'
import { gameRoutes } from '../src/routes/gameRoutes.js'

function request(body: unknown) { return { body } };
function response() {
  const result: { statusCode: number; body: unknown } = { statusCode: 200, body: undefined }
  return { result, status(code: number) { result.statusCode = code; return this }, json(body: unknown) { result.body = body; return this } }
}
function composition(slots: Record<string, string>) { return { slots } }

test('la route de simulation est montée en POST /simulate', () => {
  const layer = (gameRoutes as unknown as { stack: Array<{ route?: { path: string; methods: Record<string, boolean> } }> }).stack.find((entry) => entry.route?.path === '/simulate')
  assert.equal(layer?.route?.methods.post, true)
})

test('la simulation accepte deux compositions valides et appelle le moteur', () => {
  const output = response()
  postSimulation(request({ player1: composition({ chakra: 'hagoromo' }), player2: composition({ chakra: 'dan' }) }) as never, output as never)
  const body = output.result.body as { resolutionMode: string; winner: string; player1: { total: number }; player2: { total: number } }
  assert.equal(output.result.statusCode, 200)
  assert.equal(body.resolutionMode, 'simulation')
  assert.equal(body.winner, 'player1')
  assert.equal(body.player1.total, 100)
  assert.equal(body.player2.total, 43)
})

test('la réponse contient les totaux, appliedRules et validationErrors des deux joueurs', () => {
  const output = response()
  postSimulation(request({ player1: composition({ clan: 'hagoromo' }), player2: composition({ chakra: 'dan' }) }) as never, output as never)
  const body = output.result.body as { player1: { total: number; appliedRules: unknown[]; validationErrors: unknown[] }; player2: { total: number; appliedRules: unknown[]; validationErrors: unknown[] } }
  assert.equal(typeof body.player1.total, 'number')
  assert.ok(Array.isArray(body.player1.appliedRules) && Array.isArray(body.player1.validationErrors))
  assert.ok(Array.isArray(body.player2.appliedRules) && Array.isArray(body.player2.validationErrors))
})

test('Kekkei Genkai et Kekkei Môra restent séparés et le Clan est exclu du total', () => {
  const output = response()
  postSimulation(request({ player1: composition({ 'kekkei-genkai': 'hamura', 'kekkei-mora': 'hamura', clan: 'hagoromo' }), player2: composition({ chakra: 'dan' }) }) as never, output as never)
  const body = output.result.body as { player1: { baseStats: { kekkeiGenkai: number; ninjutsuAttack: number; clan: number }; finalStats: { kekkeiGenkai: number; ninjutsuAttack: number; clan: number }; total: number } }
  assert.equal(body.player1.baseStats.kekkeiGenkai, 99)
  assert.equal(body.player1.baseStats.ninjutsuAttack, 0)
  assert.equal(body.player1.finalStats.clan, 0)
  assert.equal(body.player1.total, body.player1.finalStats.kekkeiGenkai)
})

test('une composition invalide renvoie 422 et aucun vainqueur exploitable', () => {
  const output = response()
  postSimulation(request({ player1: composition({ chakra: 'unknown-card' }), player2: composition({ chakra: 'dan' }) }) as never, output as never)
  const body = output.result.body as { winner: string; player1: { validationErrors: unknown[] }; player2: { validationErrors: unknown[] } }
  assert.equal(output.result.statusCode, 422)
  assert.equal(body.winner, 'draw')
  assert.ok(body.player1.validationErrors.length > 0)
  assert.equal(body.player2.validationErrors.length, 0)
})

test('une requête sans deux compositions est rejetée proprement', () => {
  const output = response()
  postSimulation(request({ player1: composition({ chakra: 'dan' }) }) as never, output as never)
  assert.equal(output.result.statusCode, 400)
  assert.deepEqual(output.result.body, { error: 'Les compositions des deux joueurs sont requises.' })
})
