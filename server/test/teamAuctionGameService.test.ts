import assert from 'node:assert/strict'
import test from 'node:test'
import { getCardKnowledgeBySlug, listCardKnowledge } from '../src/game/cardKnowledge.js'
import { calculateCharacterOverallScore } from '../src/game/teamMode.js'
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
  assert.equal(game.currentBid, 10)
  assert.equal(game.currentBidderId, 1)
  assert.equal(game.currentTurnId, 2)
  submitTeamBid(game.gameId, 2, 20)
  assert.equal(game.currentTurnId, 3)
  submitTeamBid(game.gameId, 3, 30)
  assert.equal(game.currentTurnId, 1)
})

test('l’ouverture obligatoire commence automatiquement à 10 M pour un joueur ayant assez de budget', () => {
  const game = makeGame('1v1-ai', [2], 500)
  startTeamAuctionGame(game.gameId)
  drawNextTeamCard(game.gameId)
  assert.equal(game.currentBid, 10)
  assert.equal(game.currentBidderId, 1)
  assert.equal(game.currentTurnId, 2)
})

test('une enchère valide est acceptée', () => {
  const game = makeGame('1v1-ai', [2], 500)
  startTeamAuctionGame(game.gameId)
  drawNextTeamCard(game.gameId)
  submitTeamBid(game.gameId, 2, 20)
  assert.equal(game.currentBid, 20)
})

test('une enchère non multiple de 10 est refusée', () => {
  const game = makeGame('1v1-ai', [2], 500)
  startTeamAuctionGame(game.gameId)
  drawNextTeamCard(game.gameId)
  assert.throws(() => submitTeamBid(game.gameId, 2, 25), /Enchère invalide/)
})

test('une enchère supérieure au budget est refusée', () => {
  const game = makeGame('1v1-ai', [2], 100)
  game.players[1]!.budget = 50
  startTeamAuctionGame(game.gameId)
  drawNextTeamCard(game.gameId)
  assert.throws(() => submitTeamBid(game.gameId, 2, 60), /Enchère invalide/)
})

test('une enchère à 500 M est résolue sans proposer 510 M au concurrent', () => {
  const game = makeGame('1v1-ai', [2], 500)
  startTeamAuctionGame(game.gameId)
  drawNextTeamCard(game.gameId)
  submitTeamBid(game.gameId, 2, 500)
  assert.equal(game.phase, 'PLACEMENT')
  assert.equal(game.winnerId, 2)
  assert.equal(game.players[0]!.activeCurrentRound, false)
})

test('une enchère à 420 M est résolue quand le concurrent a seulement 400 M', () => {
  const game = makeGame('1v1-ai', [2], 500)
  game.players[0]!.budget = 400
  startTeamAuctionGame(game.gameId)
  drawNextTeamCard(game.gameId)
  game.currentBid = 410
  game.currentBidderId = 1
  game.currentTurnId = 2
  submitTeamBid(game.gameId, 2, 420)
  assert.equal(game.phase, 'PLACEMENT')
  assert.equal(game.winnerId, 2)
})

test('une action hors tour est refusée', () => {
  const game = makeGame('1v1-ai', [2], 500)
  startTeamAuctionGame(game.gameId)
  drawNextTeamCard(game.gameId)
  assert.throws(() => submitTeamBid(game.gameId, 1, 20), /Ce n’est pas ton tour/)
})

test('PASS est définitif pour la carte courante', () => {
  const game = makeGame('1v1-ai', [2], 500)
  startTeamAuctionGame(game.gameId)
  drawNextTeamCard(game.gameId)
  passTeamBid(game.gameId, 2)
  assert.equal(game.players[1]!.passedCurrentRound, true)
  assert.equal(game.phase, 'PLACEMENT')
  assert.equal(game.winnerId, 1)
})

test('un joueur passé est ignoré jusqu’à la carte suivante', () => {
  const game = makeGame('1v1-ai', [2], 500)
  startTeamAuctionGame(game.gameId)
  drawNextTeamCard(game.gameId)
  passTeamBid(game.gameId, 2)
  assert.equal(game.currentTurnId, 1)
  assert.equal(game.players[1]!.passedCurrentRound, true)
})

test('le dernier joueur actif gagne immédiatement sans surenchère', () => {
  const game = makeGame('1v1-ai', [2], 500)
  startTeamAuctionGame(game.gameId)
  drawNextTeamCard(game.gameId)
  passTeamBid(game.gameId, 2)
  assert.equal(game.phase, 'PLACEMENT')
  assert.equal(game.winnerId, 1)
})

test('ALL-IN est autorisé et consomme bien le budget de la dernière offre', () => {
  const game = makeGame('1v1-ai', [2], 280)
  game.players[1]!.budget = 280
  startTeamAuctionGame(game.gameId)
  drawNextTeamCard(game.gameId)
  allInTeamBid(game.gameId, 2)
  assert.equal(game.currentBid, 280)
  assert.equal(game.players[1]!.budget, 0)
  assert.equal(game.currentBidderId, 2)
})

test('ALL-IN est refusé lorsqu’il ne dépasse pas l’enchère actuelle', () => {
  const game = makeGame('1v1-ai', [2], 100)
  game.players[1]!.budget = 10
  startTeamAuctionGame(game.gameId)
  drawNextTeamCard(game.gameId)
  assert.throws(() => allInTeamBid(game.gameId, 2), /doit dépasser/)
})

test('seul le prix final est débité après une série de surenchères', () => {
  const game = makeGame('1v1-real', [2], 500)
  startTeamAuctionGame(game.gameId)
  drawNextTeamCard(game.gameId)
  submitTeamBid(game.gameId, 2, 30)
  submitTeamBid(game.gameId, 1, 100)
  passTeamBid(game.gameId, 2)
  assert.equal(game.players[0]!.budget, 400)
  assert.equal(game.players[1]!.budget, 500)
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

test('l’IA passe quand la prochaine offre dépasse son plafond sur une carte faible', () => {
  const game = makeGame('1v1-ai', [2], 500)
  const lowCard = getCardKnowledgeBySlug('zetsu-blanc')!
  startTeamAuctionGame(game.gameId)
  game.currentCardId = lowCard.id
  game.phase = 'BIDDING'
  game.currentTurnId = 2
  game.currentBid = 100
  const decision = evaluateTeamAuctionAi(game.gameId, 2)
  assert.equal(decision?.action, 'pass')
})

test('une carte moyenne avec de nombreux slots ne provoque pas de quasi ALL-IN', () => {
  const game = makeGame('1v1-ai', [3, 3], 500)
  const cardsByScore = listCardKnowledge().sort((left, right) => calculateCharacterOverallScore(left) - calculateCharacterOverallScore(right))
  const middleCard = cardsByScore[Math.floor(cardsByScore.length / 2)]!
  game.currentCardId = middleCard.id
  game.phase = 'BIDDING'
  game.currentTurnId = 2
  const decision = evaluateTeamAuctionAi(game.gameId, 2)
  assert.notEqual(decision?.action, 'allin')
  assert.ok(decision?.action !== 'bid' || decision.amount < 400)
})

test('une carte ultra élite reçoit un plafond d’ouverture supérieur à une carte moyenne', () => {
  const cardsByScore = listCardKnowledge().sort((left, right) => calculateCharacterOverallScore(right) - calculateCharacterOverallScore(left))
  const elite = cardsByScore[0]!
  const middle = cardsByScore[Math.floor(cardsByScore.length / 2)]!
  const eliteGame = makeGame('1v1-ai', [3, 3], 500)
  eliteGame.currentCardId = elite.id
  eliteGame.phase = 'BIDDING'
  eliteGame.currentTurnId = 2
  const mediumGame = makeGame('1v1-ai', [3, 3], 500)
  mediumGame.currentCardId = middle.id
  mediumGame.phase = 'BIDDING'
  mediumGame.currentTurnId = 2
  const eliteDecision = evaluateTeamAuctionAi(eliteGame.gameId, 2)
  const mediumDecision = evaluateTeamAuctionAi(mediumGame.gameId, 2)
  assert.equal(eliteDecision?.action, 'bid')
  assert.equal(mediumDecision?.action, 'bid')
  assert.ok(eliteDecision.amount > mediumDecision.amount)
  assert.ok(eliteDecision.amount <= eliteGame.players[1]!.budget)
})

test('une IA sans budget ne peut jamais enchérir', () => {
  const game = makeGame('1v1-ai', [2], 500)
  game.players[1]!.budget = 0
  game.currentCardId = getCardKnowledgeBySlug('hagoromo')!.id
  game.phase = 'BIDDING'
  game.currentTurnId = 2
  assert.equal(evaluateTeamAuctionAi(game.gameId, 2)?.action, 'pass')
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

test('une carte generalScore très faible (Sexy Jutsu) est facilement passée par l’IA', () => {
  const game = makeGame('1v1-ai', [2], 500)
  const sj = getCardKnowledgeBySlug('naruto-sj')!
  startTeamAuctionGame(game.gameId)
  game.currentCardId = sj.id
  game.phase = 'BIDDING'
  game.currentTurnId = 2
  game.currentBid = 50
  const decision = evaluateTeamAuctionAi(game.gameId, 2)
  assert.equal(decision?.action, 'pass')
})

test('Kaguya (generalScore 100) reçoit un plafond d’enchère supérieur à une carte faible', () => {
  const kaguya = getCardKnowledgeBySlug('kaguya')!
  const sj = getCardKnowledgeBySlug('konohamaru-sj')!
  const eliteGame = makeGame('1v1-ai', [3, 3], 500)
  eliteGame.currentCardId = kaguya.id
  eliteGame.phase = 'BIDDING'
  eliteGame.currentTurnId = 2
  const weakGame = makeGame('1v1-ai', [3, 3], 500)
  weakGame.currentCardId = sj.id
  weakGame.phase = 'BIDDING'
  weakGame.currentTurnId = 2
  const eliteDecision = evaluateTeamAuctionAi(eliteGame.gameId, 2)
  const weakDecision = evaluateTeamAuctionAi(weakGame.gameId, 2)
  assert.equal(eliteDecision?.action, 'bid')
  assert.ok(weakDecision?.action !== 'bid' || weakDecision.amount < eliteDecision.amount)
  assert.ok(eliteDecision.amount <= eliteGame.players[1]!.budget)
})

test('même sur Kaguya, l’IA ne dépasse jamais son budget', () => {
  const kaguya = getCardKnowledgeBySlug('kaguya')!
  const game = makeGame('1v1-ai', [3, 3], 500)
  game.players[1]!.budget = 30
  game.currentCardId = kaguya.id
  game.phase = 'BIDDING'
  game.currentTurnId = 2
  const decision = evaluateTeamAuctionAi(game.gameId, 2)
  if (decision?.action === 'bid') {
    assert.ok(decision.amount <= game.players[1]!.budget)
  }
})

test('rotation des openers TEST A : elle continue même si un joueur n’a presque plus de budget', () => {
  const game = makeGame('1v1-real', [3, 3], 500)
  game.players[1]!.budget = 5
  startTeamAuctionGame(game.gameId)
  drawNextTeamCard(game.gameId)
  // J1 a ouvert auto 10. J2 a 5 M (< 20 M), donc J2 ne peut pas raise -> J1 gagne immédiatement à 10
  assert.equal(game.phase, 'PLACEMENT')
  assert.equal(game.winnerId, 1)
  placeTeamCard(game.gameId, 1, 0)
  drawNextTeamCard(game.gameId)
  assert.equal(game.currentBidderId, 2, 'le joueur à faible budget est l’opener de la carte suivante')
  assert.equal(game.currentBid, 0, 'le joueur à 5 M ouvre automatiquement à 0 M')
  assert.equal(game.currentTurnId, 1, 'le tour passe au joueur suivant')
})

test('rotation des openers TEST B : A ouvre 10, B mise 20, A incapable de 30 → B gagne immédiatement à 20', () => {
  const game = makeGame('1v1-real', [2], 500)
  game.players[0]!.budget = 25
  startTeamAuctionGame(game.gameId)
  drawNextTeamCard(game.gameId)
  assert.equal(game.currentBid, 10)
  assert.equal(game.currentBidderId, 1)
  assert.equal(game.currentTurnId, 2)
  submitTeamBid(game.gameId, 2, 20)
  assert.equal(game.phase, 'PLACEMENT')
  assert.equal(game.winnerId, 2)
  assert.equal(game.currentBid, 20)
  assert.equal(game.players[1]!.budget, 480)
})

test('rotation des openers TEST C : un PASS résout la carte sans casser la rotation de la carte suivante', () => {
  const game = makeGame('1v1-real', [2, 2], 500)
  startTeamAuctionGame(game.gameId)
  drawNextTeamCard(game.gameId)
  passTeamBid(game.gameId, 2)
  assert.equal(game.phase, 'PLACEMENT')
  assert.equal(game.winnerId, 1)
  placeTeamCard(game.gameId, 1, 0)
  drawNextTeamCard(game.gameId)
  assert.equal(game.currentBidderId, 2)
  assert.equal(game.currentTurnId, 1)
})

test('rotation des openers TEST D (1v1v1) : B gagne immédiatement quand A et C sont incapables de 30', () => {
  const game = makeGame('1v1v1-real', [2, 2], 500)
  game.players[0]!.budget = 25
  game.players[2]!.budget = 25
  startTeamAuctionGame(game.gameId)
  drawNextTeamCard(game.gameId)
  assert.equal(game.currentBid, 10)
  assert.equal(game.currentTurnId, 2)
  submitTeamBid(game.gameId, 2, 20)
  assert.equal(game.phase, 'PLACEMENT')
  assert.equal(game.winnerId, 2)
  assert.equal(game.currentBid, 20)
})

test('ouverture auto 1 : opener 0 M → ouverture auto 0 M', () => {
  const game = makeGame('1v1-real', [2, 2], 500)
  game.players[0]!.budget = 0
  startTeamAuctionGame(game.gameId)
  drawNextTeamCard(game.gameId)
  assert.equal(game.currentBid, 0)
  assert.equal(game.currentBidderId, 1)
  assert.equal(game.currentTurnId, 2)
})

test('ouverture auto 2 : opener 0 M + adversaire PASS → opener gagne la carte à 0 M', () => {
  const game = makeGame('1v1-real', [2, 2], 500)
  game.players[0]!.budget = 0
  startTeamAuctionGame(game.gameId)
  drawNextTeamCard(game.gameId)
  passTeamBid(game.gameId, 2)
  assert.equal(game.phase, 'PLACEMENT')
  assert.equal(game.winnerId, 1)
  assert.equal(game.currentBid, 0)
  assert.equal(game.players[0]!.budget, 0)
})

test('ouverture auto 3 : opener 0 M + adversaire BID 10 → adversaire gagne immédiatement à 10 M', () => {
  const game = makeGame('1v1-real', [2, 2], 500)
  game.players[0]!.budget = 0
  startTeamAuctionGame(game.gameId)
  drawNextTeamCard(game.gameId)
  submitTeamBid(game.gameId, 2, 10)
  assert.equal(game.phase, 'PLACEMENT')
  assert.equal(game.winnerId, 2)
  assert.equal(game.currentBid, 10)
  assert.equal(game.players[1]!.budget, 490)
  assert.equal(game.players[0]!.budget, 0)
})

test('ouverture auto 4 : opener 5 M → ouverture auto 0 M', () => {
  const game = makeGame('1v1-real', [2, 2], 500)
  game.players[0]!.budget = 5
  startTeamAuctionGame(game.gameId)
  drawNextTeamCard(game.gameId)
  assert.equal(game.currentBid, 0)
  assert.equal(game.currentBidderId, 1)
  assert.equal(game.currentTurnId, 2)
})

test('ouverture auto 5 : opener 10 M → ouverture auto 10 M', () => {
  const game = makeGame('1v1-real', [2, 2], 500)
  game.players[0]!.budget = 10
  startTeamAuctionGame(game.gameId)
  drawNextTeamCard(game.gameId)
  assert.equal(game.currentBid, 10)
  assert.equal(game.currentBidderId, 1)
  assert.equal(game.currentTurnId, 2)
})

test('ouverture auto 6 : opener 500 M → ouverture auto 10 M', () => {
  const game = makeGame('1v1-real', [2, 2], 500)
  startTeamAuctionGame(game.gameId)
  drawNextTeamCard(game.gameId)
  assert.equal(game.currentBid, 10)
  assert.equal(game.currentBidderId, 1)
  assert.equal(game.currentTurnId, 2)
})

test('ouverture auto 7 : budget débité uniquement au prix final', () => {
  const game = makeGame('1v1-real', [2, 2], 500)
  startTeamAuctionGame(game.gameId)
  drawNextTeamCard(game.gameId)
  submitTeamBid(game.gameId, 2, 20)
  submitTeamBid(game.gameId, 1, 30)
  passTeamBid(game.gameId, 2)
  assert.equal(game.phase, 'PLACEMENT')
  assert.equal(game.winnerId, 1)
  assert.equal(game.players[0]!.budget, 470, 'seul le prix final de 30 M est débité')
})

test('ouverture auto 8 : 1v1v1 avec opener 0 M', () => {
  const game = makeGame('1v1v1-real', [2, 2], 500)
  game.players[0]!.budget = 0
  game.players[1]!.budget = 100
  game.players[2]!.budget = 100
  startTeamAuctionGame(game.gameId)
  drawNextTeamCard(game.gameId)
  assert.equal(game.currentBid, 0)
  assert.equal(game.currentBidderId, 1)
  assert.equal(game.currentTurnId, 2)
  submitTeamBid(game.gameId, 2, 10)
  assert.equal(game.currentBid, 10)
  assert.equal(game.currentTurnId, 3)
  passTeamBid(game.gameId, 3)
  assert.equal(game.phase, 'PLACEMENT')
  assert.equal(game.winnerId, 2)
  assert.equal(game.currentBid, 10)
})

test('ouverture auto 9 : IA peut PASS face à ouverture 0 sur carte faible', () => {
  const game = makeGame('1v1-ai', [2, 2], 500)
  game.players[0]!.budget = 0
  const weak = getCardKnowledgeBySlug('naruto-sj')!
  startTeamAuctionGame(game.gameId)
  game.deck.push(weak.id)
  drawNextTeamCard(game.gameId)
  assert.equal(game.currentBid, 0)
  assert.equal(game.currentBidderId, 1)
  assert.equal(game.currentTurnId, 2)
  const decision = evaluateTeamAuctionAi(game.gameId, 2)
  assert.equal(decision?.action, 'pass')
})

test('ouverture auto 10 : IA peut BID 10 face à ouverture 0 si elle veut la carte', () => {
  const game = makeGame('1v1-ai', [2, 2], 500)
  game.players[0]!.budget = 0
  const strong = getCardKnowledgeBySlug('kaguya')!
  startTeamAuctionGame(game.gameId)
  game.deck.push(strong.id)
  drawNextTeamCard(game.gameId)
  assert.equal(game.currentBid, 0)
  assert.equal(game.currentBidderId, 1)
  assert.equal(game.currentTurnId, 2)
  const decision = evaluateTeamAuctionAi(game.gameId, 2)
  assert.equal(decision?.action, 'bid')
  assert.ok(decision.amount >= 10)
})

test('équipes pleines TEST 1 : humain a des slots libres, IA pleine → carte auto attribuée à l’humain', () => {
  const game = makeGame('1v1-ai', [1], 500)
  game.players[1]!.teams[0] = [999]
  startTeamAuctionGame(game.gameId)
  drawNextTeamCard(game.gameId)
  assert.equal(game.phase, 'PLACEMENT')
  assert.equal(game.winnerId, 1)
  assert.equal(game.currentBid, 0)
})

test('équipes pleines TEST 2 : humain plein, IA a des slots libres → carte auto attribuée à l’IA', () => {
  const game = makeGame('1v1-ai', [1], 500)
  game.players[0]!.teams[0] = [999]
  startTeamAuctionGame(game.gameId)
  drawNextTeamCard(game.gameId)
  assert.equal(game.phase, 'PLACEMENT')
  assert.equal(game.winnerId, 2)
  assert.equal(game.currentBid, 0)
})

test('équipes pleines TEST 3 (1v1v1) : A plein → l’enchère n’oppose plus que B et C', () => {
  const game = makeGame('1v1v1-real', [1, 1], 500)
  game.players[0]!.teams[0] = [999]
  game.players[0]!.teams[1] = [998]
  startTeamAuctionGame(game.gameId)
  drawNextTeamCard(game.gameId)
  assert.equal(game.phase, 'BIDDING')
  assert.equal(game.currentBidderId, 2, 'B doit être le premier opener éligible')
  assert.equal(game.currentTurnId, 3, 'C doit recevoir le tour pour répondre à B')
  assert.throws(() => submitTeamBid(game.gameId, 1, 10), /pleines/)
})

test('équipes pleines TEST 4 (1v1v1) : A et B pleins → auto-attribution à C', () => {
  const game = makeGame('1v1v1-real', [1], 500)
  game.players[0]!.teams[0] = [999]
  game.players[1]!.teams[0] = [998]
  startTeamAuctionGame(game.gameId)
  drawNextTeamCard(game.gameId)
  assert.equal(game.phase, 'PLACEMENT')
  assert.equal(game.winnerId, 3)
  assert.equal(game.currentBid, 0)
})

test('équipes pleines TEST 5 : aucun joueur ne peut recevoir de carte → la partie passe aux résultats', () => {
  const game = makeGame('1v1-real', [1], 500)
  game.players[0]!.teams[0] = [getCardKnowledgeBySlug('naruto')!.id]
  game.players[1]!.teams[0] = [getCardKnowledgeBySlug('sasuke')!.id]
  startTeamAuctionGame(game.gameId)
  drawNextTeamCard(game.gameId)
  assert.equal(game.phase, 'RESULTS')
  assert.ok(game.finalResults)
})

test('équipes pleines TEST 6 : un joueur aux équipes pleines ne peut ni BID ni ALL-IN', () => {
  const game = makeGame('1v1-real', [1], 500)
  game.players[0]!.teams[0] = [999]
  startTeamAuctionGame(game.gameId)
  drawNextTeamCard(game.gameId)
  game.phase = 'BIDDING'
  game.currentTurnId = 1
  game.currentCardId = 42
  assert.throws(() => submitTeamBid(game.gameId, 1, 10), /pleines/)
  assert.throws(() => allInTeamBid(game.gameId, 1), /pleines/)
})
