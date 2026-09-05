import assert from 'node:assert/strict'
import test from 'node:test'
import {
  calculateCharacterOverallScore,
  calculateTeamScore,
  chooseBestTeamPlacement,
  evaluateTeamPlacement,
  normalizeTeamConfig,
  resolveFinalStandings,
  resolveTeamConfrontation,
} from '../src/game/teamMode.js'

const card = (name: string, stats: Record<string, number>) => ({ name, stats })

test('le score global d’un personnage est la moyenne des statistiques numériques pertinentes', () => {
  const score = calculateCharacterOverallScore(card('Test', { chakra: 90, iq: 80, speed: 70, clan: 0, sensory: 0 }))
  assert.equal(score, 80)
})

test('une carte très faible est généralement privilégiée dans une grande équipe', () => {
  const weakCard = card('Weak', { chakra: 20, iq: 30, speed: 25, ninjutsuAttack: 28, taijutsu: 24 })
  const teamTwo = [card('A', { chakra: 94, iq: 90, speed: 88, ninjutsuAttack: 86 }), card('B', { chakra: 91, iq: 92, speed: 90, ninjutsuAttack: 88 })]
  const teamFive = [card('A', { chakra: 88, iq: 85, speed: 90, ninjutsuAttack: 84 }), card('B', { chakra: 90, iq: 84, speed: 87, ninjutsuAttack: 85 }), card('C', { chakra: 86, iq: 88, speed: 89, ninjutsuAttack: 83 }), card('D', { chakra: 87, iq: 86, speed: 86, ninjutsuAttack: 82 })]
  const smallTeam = evaluateTeamPlacement(weakCard, teamTwo, teamTwo, { teamSize: 2 })
  const largeTeam = evaluateTeamPlacement(weakCard, teamFive, teamFive, { teamSize: 5 })
  assert.ok(largeTeam > smallTeam)
})

test('une carte exceptionnelle est valorisée davantage dans une petite équipe lorsque le contexte le justifie', () => {
  const elite = card('Elite', { chakra: 99, iq: 98, speed: 96, ninjutsuAttack: 97, taijutsu: 95 })
  const smallTeam = evaluateTeamPlacement(elite, [card('A', { chakra: 48, iq: 52, speed: 55, ninjutsuAttack: 54 })], [card('B', { chakra: 58, iq: 68, speed: 63, ninjutsuAttack: 62 })], { teamSize: 2, strategicNeed: 4 })
  const largeTeam = evaluateTeamPlacement(elite, [card('A', { chakra: 88, iq: 84, speed: 87, ninjutsuAttack: 83 }), card('B', { chakra: 86, iq: 89, speed: 85, ninjutsuAttack: 84 }), card('C', { chakra: 84, iq: 82, speed: 83, ninjutsuAttack: 80 })], [card('D', { chakra: 78, iq: 74, speed: 76, ninjutsuAttack: 75 })], { teamSize: 4, strategicNeed: 1 })
  assert.ok(smallTeam > largeTeam)
})

test('la confrontation équipe contre équipe garde la moyenne et la comparaison comme référence', () => {
  const teamA = [card('A', { chakra: 90, iq: 90 }), card('B', { chakra: 70, iq: 80 })]
  const teamB = [card('C', { chakra: 72, iq: 64 }), card('D', { chakra: 80, iq: 68 })]
  const result = resolveTeamConfrontation(teamA, teamB)
  assert.equal(result.winner, 'left')
  assert.ok(result.leftScore > result.rightScore)
})

test('la résolution finale compte les victoires et le total des notes de toutes les équipes', () => {
  const players = [
    { id: 1, teams: [[card('A1', { chakra: 90 }), card('A2', { chakra: 80 })], [card('A3', { chakra: 95 }), card('A4', { chakra: 90 })]] },
    { id: 2, teams: [[card('B1', { chakra: 80 }), card('B2', { chakra: 85 })], [card('B3', { chakra: 60 }), card('B4', { chakra: 65 })]] },
  ]
  const { standings, matchups } = resolveFinalStandings(players)
  assert.equal(matchups.length, 2)
  assert.equal(standings[0]!.playerId, 1)
  assert.ok(standings[0]!.victories >= standings[1]!.victories)
})

test('la configuration équipe est validée proprement', () => {
  assert.deepEqual(normalizeTeamConfig({ teamSizes: [3, 4, 2], initialBudget: 500 }), { teamCount: 3, teamSizes: [3, 4, 2], initialBudget: 500 })
  assert.throws(() => normalizeTeamConfig({ teamSizes: [], initialBudget: 100 }))
})

test('le meilleur placement stratégique est bien choisi parmi plusieurs équipes', () => {
  const elite = card('Elite', { chakra: 96, iq: 98, speed: 95, ninjutsuAttack: 97 })
  const teams = [
    { members: [card('G1', { chakra: 78, iq: 70, speed: 72, ninjutsuAttack: 74 })], opponent: [card('O1', { chakra: 81, iq: 75, speed: 71, ninjutsuAttack: 72 })], size: 2 },
    { members: [card('H1', { chakra: 60, iq: 69, speed: 65, ninjutsuAttack: 66 }), card('H2', { chakra: 67, iq: 62, speed: 66, ninjutsuAttack: 63 })], opponent: [card('O2', { chakra: 68, iq: 70, speed: 69, ninjutsuAttack: 71 })], size: 3 },
  ]
  const choice = chooseBestTeamPlacement(elite, teams, { remainingSlots: 1, budgetRemaining: 120, strategicNeed: 2 })
  assert.ok(choice)
  assert.equal(choice.teamIndex, 0)
})
