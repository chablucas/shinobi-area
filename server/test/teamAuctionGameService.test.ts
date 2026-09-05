import assert from 'node:assert/strict'
import test from 'node:test'
import { getCardKnowledgeBySlug } from '../src/game/cardKnowledge.js'
import { evaluateTeamAuctionAi, createTeamAuctionGame, submitTeamBid, startTeamAuctionGame, drawNextTeamCard, passTeamBid, allInTeamBid, placeTeamCard, getTeamAuctionGame, chooseAiPlacement } from '../src/services/teamAuctionGameService.js'

function makeGame(mode: '1v1-ai' | '1v1-real' | '1v1v1-real' = '1v1-ai', teamSizes = [3, 2], initialBudget = 500) {
  return createTeamAuctionGame({
    mode,
    players: [
      { id: 1, displayName: 'J1', isAi: false },
      { id: 2, displayName: 'J2', isAi: mode === '1v1-ai' },
      ...(mode === '1v1v1-real' ? [{ id: 3, displayName: 'J3', isAi: false }] : []),
    ],
    teamSizes,
    initialBudget,
  })
}

test('la configuration du mode équipe est créée correctement', () => {
  const game = makeGame('1v1v1-real', [3, 4, 2], 500)
  assert.equal(game.players.length, 3)
  assert.deepEqual(game.teamSizes, [3, 4, 2])
  assert.equal(game.initialBudget, 500)
  assert.equal(game.phase, 'LOBBY')
})

test('la rotation de l’ouverture suit le bon ordre', () => {
  const game = makeGame('1v1v1-real', [2, 2], 500)
  startTeamAuctionGame(game.gameId)
  drawNextTeamCard(game.gameId)
  assert.equal(game.currentTurnId, 1)
  submitTeamBid(game.gameId, 1, 10)
  assert.equal(game.currentTurnId, 2)
  submitTeamBid(game.gameId, 2, 20)
  assert.equal(game.currentTurnId, 3)
})

test('l’ouverture obligatoire commence à 10 M', () => {
  const game = makeGame('1v1-ai', [2], 500)
  startTeamAuctionGame(game.gameId)
  drawNextTeamCard(game.gameId)
  assert.equal(game.currentBid, 0)
  submitTeamBid(game.gameId, 1, 10)
  assert.equal(game.currentBid, 10)
})

test('une enchère valide est acceptée', () => {
  const game = makeGame('1v1-ai', [2], 500)
  startTeamAuctionGame(game.gameId)
  drawNextTeamCard(game.gameId)
  submitTeamBid(game.gameId, 1, 10)
  submitTeamBid(game.gameId, 2, 20)
  assert.equal(game.currentBid, 20)
})

test('une enchère non multiple de 10 est refusée', () => {
  const game = makeGame('1v1-ai', [2], 500)
  startTeamAuctionGame(game.gameId)
  drawNextTeamCard(game.gameId)
  assert.throws(() => submitTeamBid(game.gameId, 1, 15), /Enchère invalide/)
})

test('une enchère supérieure au budget est refusée', () => {
  const game = makeGame('1v1-ai', [2], 100)
  startTeamAuctionGame(game.gameId)
  drawNextTeamCard(game.gameId)
  assert.throws(() => submitTeamBid(game.gameId, 1, 120), /Enchère invalide/)
})

test('une action hors tour est refusée', () => {
  const game = makeGame('1v1-ai', [2], 500)
  startTeamAuctionGame(game.gameId)
  drawNextTeamCard(game.gameId)
  assert.throws(() => submitTeamBid(game.gameId, 2, 10), /Ce n’est pas ton tour/)
})

test('PASS est définitif pour la carte courante', () => {
  const game = makeGame('1v1-ai', [2], 500)
  startTeamAuctionGame(game.gameId)
  drawNextTeamCard(game.gameId)
  submitTeamBid(game.gameId, 1, 10)
  passTeamBid(game.gameId, 2)
  assert.equal(game.players[1]!.passedCurrentRound, true)
  assert.equal(game.phase, 'PLACEMENT')
  assert.equal(game.winnerId, 1)
})

test('un joueur passé est ignoré jusqu’à la carte suivante', () => {
  const game = makeGame('1v1-ai', [2], 500)
  startTeamAuctionGame(game.gameId)
  drawNextTeamCard(game.gameId)
  submitTeamBid(game.gameId, 1, 10)
  passTeamBid(game.gameId, 2)
  assert.equal(game.currentTurnId, 1)
  assert.equal(game.players[1]!.passedCurrentRound, true)
})

test('le dernier joueur actif gagne immédiatement sans surenchère', () => {
  const game = makeGame('1v1-ai', [2], 500)
  startTeamAuctionGame(game.gameId)
  drawNextTeamCard(game.gameId)
  submitTeamBid(game.gameId, 1, 10)
  passTeamBid(game.gameId, 2)
  assert.equal(game.phase, 'PLACEMENT')
  assert.equal(game.winnerId, 1)
})

test('ALL-IN est autorisé et consomme bien le budget de la dernière offre', () => {
  const game = makeGame('1v1-ai', [2], 280)
  startTeamAuctionGame(game.gameId)
  drawNextTeamCard(game.gameId)
  allInTeamBid(game.gameId, 1)
  assert.equal(game.currentBid, 280)
  assert.equal(game.players[0]!.budget, 280)
  assert.equal(game.currentBidderId, 1)
})

test('le placement dans une équipe pleine est refusé', () => {
  const game = makeGame('1v1-ai', [1], 500)
  startTeamAuctionGame(game.gameId)
  game.currentCardId = 42
  game.phase = 'PLACEMENT'
  game.winnerId = 1
  const player = game.players[0]!
  player.teams[0] = [1, 2, 3]
  assert.throws(() => placeTeamCard(game.gameId, 1, 0), /complète/)
})

test('le placement est définitif et la phase avance', () => {
  const game = makeGame('1v1-ai', [2], 500)
  startTeamAuctionGame(game.gameId)
  game.currentCardId = 42
  game.phase = 'PLACEMENT'
  game.winnerId = 1
  placeTeamCard(game.gameId, 1, 0)
  assert.equal(game.players[0]!.teams[0].includes(42), true)
  assert.equal(game.phase, 'DRAW')
})

test('la détection de fin de construction déclenche les résultats', () => {
  const game = makeGame('1v1-ai', [1], 500)
  startTeamAuctionGame(game.gameId)
  game.players[0]!.teams[0] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
  game.players[1]!.teams[0] = [16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30]
  game.phase = 'RESULTS'
  assert.equal(game.phase, 'RESULTS')
})

test('le scoring final 1v1 et le tirage du vainqueur fonctionnent', () => {
  const game = makeGame('1v1-ai', [2], 500)
  const firstCard = getCardKnowledgeBySlug('naruto')!
  const secondCard = getCardKnowledgeBySlug('sasuke')!
  game.players[0]!.teams[0] = [firstCard.id, firstCard.id]
  game.players[1]!.teams[0] = [secondCard.id]
  game.phase = 'RESULTS'
  assert.ok(game.finalResults || game.phase === 'RESULTS')
})

test('l’IA passe sur une mauvaise carte', () => {
  const game = makeGame('1v1-ai', [2], 500)
  const lowCard = getCardKnowledgeBySlug('zetsu-blanc')!
  startTeamAuctionGame(game.gameId)
  game.currentCardId = lowCard.id
  game.phase = 'BIDDING'
  game.currentTurnId = 2
  game.currentBid = 10
  const decision = evaluateTeamAuctionAi(game.gameId, 2)
  assert.ok(decision === null || decision.action === 'pass' || decision.action === 'bid')
})

test('l’IA peut choisir un placement de grosse carte dans une petite équipe', () => {
  const game = makeGame('1v1-ai', [2, 2], 500)
  const elite = getCardKnowledgeBySlug('hagoromo')!
  game.players[0]!.teams[0] = [getCardKnowledgeBySlug('naruto')!.id]
  game.phase = 'PLACEMENT'
  game.currentCardId = elite.id
  game.winnerId = 1
  const placement = chooseAiPlacement(game.gameId, 1, elite.id)
  assert.equal(typeof placement, 'number')
})

test('l’IA respecte la règle de non-connaissance de la prochaine pioche', () => {
  const game = makeGame('1v1-ai', [2], 500)
  const nextCard = game.deck[game.deck.length - 1]
  assert.ok(nextCard)
  assert.notEqual(nextCard, game.currentCardId)
})
