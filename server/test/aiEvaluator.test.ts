import assert from 'node:assert/strict'
import test from 'node:test'
import { chooseBestCategory } from '../../client/src/game/ai/categoryEvaluator.js'
import { createPlayerBuild } from '../../client/src/game/gameEngine.js'
import type { Card } from '../../client/src/types/card.js'
import cardStatsData from '../src/data/shinobi-card-stats.json' with { type: 'json' }

function card(stats: Record<string, number>): Card { return { id: 1, name: 'Fixture', slug: 'fixture', imageUrl: null, stats } }

const categoryOrder = [
  'chakra', 'invocation', 'iq', 'ninjutsu', 'genjutsu', 'taijutsu', 'avatar',
  'body', 'fuinjutsu', 'senjutsu', 'kenjutsu', 'clan', 'vitesse', 'kekkei-genkai', 'kekkei-mora',
] as const

function comparableValues(stats: Record<string, number | null>) {
  return {
    chakra: stats.chakra ?? 0,
    invocation: stats.invocation ?? 0,
    iq: stats.iq ?? 0,
    ninjutsu: ((stats.ninjutsuAttack ?? 0) + (stats.ninjutsuDefense ?? 0)) / 2,
    genjutsu: stats.genjutsu ?? 0,
    taijutsu: stats.taijutsu ?? 0,
    avatar: stats.avatar ?? 0,
    body: stats.body ?? 0,
    fuinjutsu: stats.fuinjutsu ?? 0,
    senjutsu: stats.senjutsu ?? 0,
    kenjutsu: stats.kenjutsu ?? 0,
    clan: 0,
    vitesse: stats.speed ?? 0,
    'kekkei-genkai': stats.kekkeiGenkai ?? 0,
    'kekkei-mora': stats.kekkeiMora ?? 0,
  }
}

function bestCategory(stats: Record<string, number | null>, occupied: readonly string[] = []) {
  const values = comparableValues(stats)
  return categoryOrder
    .filter((category) => !occupied.includes(category))
    .reduce((best, category) => values[category] > values[best] ? category : best)
}

function realCard(entry: (typeof cardStatsData)[number]): Card {
  return { id: entry.id, name: entry.name, slug: entry.slug, imageUrl: null, stats: entry.stats }
}

test('IA ne choisit pas une catégorie occupée', () => {
  const build = createPlayerBuild(2)
  build.slots.ninjutsu = card({ ninjutsuAttack: 100, ninjutsuDefense: 100 })
  assert.notEqual(chooseBestCategory(build, card({ ninjutsuAttack: 100, ninjutsuDefense: 100 })), 'ninjutsu')
})
test('IA compare Ninjutsu avec la moyenne de son attaque et de sa défense', () => {
  const build = createPlayerBuild(2)
  assert.equal(chooseBestCategory(build, card({ chakra: 88, iq: 40, ninjutsuAttack: 90, ninjutsuDefense: 85, speed: 65 })), 'chakra')
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
test('les vraies statistiques déterminent le choix de Danzō, Guy et Ino', () => {
  const realCards = cardStatsData.filter((entry) => ['guy', 'ino', 'danzo'].includes(entry.slug))
  assert.equal(realCards.length, 3)
  for (const entry of realCards) {
    const values = comparableValues(entry.stats)
    if (entry.slug === 'danzo') {
      console.table(values)
      assert.equal(entry.stats.genjutsu, 95)
      assert.equal(entry.stats.fuinjutsu, 92)
      assert.equal(entry.stats.iq, 91)
      assert.equal(values.ninjutsu, 71)
      assert.equal(chooseBestCategory(createPlayerBuild(2), realCard(entry)), 'genjutsu')
    }
    assert.equal(chooseBestCategory(createPlayerBuild(2), realCard(entry)), bestCategory(entry.stats))
  }
})
test('les 163 cartes choisissent toujours leur meilleure catégorie libre', () => {
  for (const entry of cardStatsData) {
    assert.equal(chooseBestCategory(createPlayerBuild(2), realCard(entry)), bestCategory(entry.stats), entry.slug)
  }
})
test('l’IA passe à la deuxième puis à la troisième meilleure catégorie libre', () => {
  const stats = { chakra: 90, iq: 80, taijutsu: 70, speed: 60 }
  const build = createPlayerBuild(2)
  assert.equal(chooseBestCategory(build, card(stats)), 'chakra')
  build.slots.chakra = card({ chakra: 1 })
  assert.equal(chooseBestCategory(build, card(stats)), 'iq')
  build.slots.iq = card({ iq: 1 })
  assert.equal(chooseBestCategory(build, card(stats)), 'taijutsu')
})
test('une carte sans statistiques est rejetée explicitement', () => {
  assert.throws(() => chooseBestCategory(createPlayerBuild(2), { id: 999, name: 'Sans stats', slug: 'sans-stats', imageUrl: null, stats: {} }), /statistiques absentes/)
})
