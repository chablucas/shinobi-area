import assert from 'node:assert/strict'
import test from 'node:test'
import { chooseBestCategory } from '../../client/src/game/ai/categoryEvaluator.js'
import { createPlayerBuild } from '../../client/src/game/gameEngine.js'
import type { Card } from '../../client/src/types/card.js'

function card(stats: Record<string, number>): Card { return { id: 1, name: 'Fixture', slug: 'fixture', imageUrl: null, stats } }

test('IA ne choisit pas une catégorie occupée', () => {
  const build = createPlayerBuild(2)
  build.slots.ninjutsu = card({ ninjutsuAttack: 100, ninjutsuDefense: 100 })
  assert.notEqual(chooseBestCategory(build, card({ ninjutsuAttack: 100, ninjutsuDefense: 100 })), 'ninjutsu')
})
test('IA choisit la meilleure valeur brute et Ninjutsu additionne attaque et défense', () => {
  const build = createPlayerBuild(2)
  assert.equal(chooseBestCategory(build, card({ chakra: 70, iq: 40, ninjutsuAttack: 90, ninjutsuDefense: 85, speed: 65 })), 'ninjutsu')
})
test('IA ne choisit jamais sensory', () => {
  const build = createPlayerBuild(2)
  assert.notEqual(chooseBestCategory(build, card({ sensory: 100, chakra: 0 })), 'sensory')
})
test('IA utilise un tie-break déterministe', () => {
  const build = createPlayerBuild(2)
  assert.equal(chooseBestCategory(build, card({ chakra: 50, iq: 50 })), 'chakra')
})
