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
test('IA choisit la deuxième meilleure catégorie si la première est occupée', () => {
  const build = createPlayerBuild(2)
  build.slots.genjutsu = card({ genjutsu: 99 })
  assert.equal(chooseBestCategory(build, card({ genjutsu: 99, taijutsu: 80, chakra: 20 })), 'taijutsu')
})
test('IA ignore une faible statistique quand une meilleure catégorie est libre', () => {
  const build = createPlayerBuild(2)
  assert.equal(chooseBestCategory(build, card({ chakra: 10, iq: 60, genjutsu: 88, taijutsu: 72, body: 55 })), 'genjutsu')
})
test('IA évalue Kekkei Mōra avec sa propre statistique', () => {
  const build = createPlayerBuild(2)
  assert.equal(chooseBestCategory(build, card({ kekkeiMora: 97, kekkeiGenkai: 50, chakra: 40 })), 'kekkei-mora')
})
test('IA ne choisit jamais sensory', () => {
  const build = createPlayerBuild(2)
  assert.notEqual(chooseBestCategory(build, card({ sensory: 100, chakra: 0 })), 'sensory')
})
test('IA utilise un tie-break déterministe', () => {
  const build = createPlayerBuild(2)
  assert.equal(chooseBestCategory(build, card({ chakra: 50, iq: 50 })), 'chakra')
})
test('IA suit l’ordre officiel complet en cas d’égalité', () => {
  const build = createPlayerBuild(2)
  assert.equal(chooseBestCategory(build, card({ chakra: 10, invocation: 10, iq: 10, ninjutsuAttack: 5, ninjutsuDefense: 5 })), 'chakra')
  build.slots.chakra = card({ chakra: 10 })
  build.slots.invocation = card({ invocation: 10 })
  assert.equal(chooseBestCategory(build, card({ chakra: 10, invocation: 10, iq: 10 })), 'iq')
})
