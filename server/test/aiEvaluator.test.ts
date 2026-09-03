import assert from 'node:assert/strict'
import test from 'node:test'
import { chooseBestCategory } from '../../client/src/game/ai/categoryEvaluator.js'
import { createPlayerBuild } from '../../client/src/game/gameEngine.js'
import type { Card } from '../../client/src/types/card.js'
import cardStatsData from '../src/data/shinobi-card-stats.json' with { type: 'json' }
import { listCardKnowledge } from '../src/game/cardKnowledge.js'

function card(stats: Record<string, number>, options: Partial<Pick<Card, 'slug' | 'clans' | 'traits'>> = {}): Card { return { id: 1, name: 'Fixture', slug: 'fixture', imageUrl: null, stats, ...options } }

const knowledgeBySlug = new Map(listCardKnowledge().map((entry) => [entry.slug, entry]))

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

function realCard(entry: (typeof cardStatsData)[number]): Card {
  const knowledge = knowledgeBySlug.get(entry.slug)
  return { id: entry.id, name: entry.name, slug: entry.slug, imageUrl: null, clans: entry.clans, stats: entry.stats, traits: knowledge?.traits ?? null }
}

function legacyCategory(build: ReturnType<typeof createPlayerBuild>, entry: (typeof cardStatsData)[number]) {
  return categoryOrder.filter((category) => !build.slots[category]).reduce((best, category) => comparableValues(entry.stats)[category] > comparableValues(entry.stats)[best] ? category : best)
}

function simulate(entries: readonly (typeof cardStatsData)[number][], strategy: (build: ReturnType<typeof createPlayerBuild>, entry: (typeof cardStatsData)[number]) => typeof categoryOrder[number]) {
  let build = createPlayerBuild(2)
  for (const entry of entries) build = { ...build, slots: { ...build.slots, [strategy(build, entry)]: realCard(entry) } }
  return build
}

test('IA ne choisit pas une catégorie occupée', () => {
  const build = createPlayerBuild(2)
  build.slots.ninjutsu = card({ ninjutsuAttack: 100, ninjutsuDefense: 100 })
  assert.notEqual(chooseBestCategory(build, card({ ninjutsuAttack: 100, ninjutsuDefense: 100 })), 'ninjutsu')
})
test('IA compare Ninjutsu avec la moyenne de son attaque et de sa défense', () => {
  const build = createPlayerBuild(2)
  assert.equal(chooseBestCategory(build, card({ chakra: 95, ninjutsuAttack: 100, ninjutsuDefense: 0 })), 'chakra')
})
test('une carte moyenne en Chakra conserve Chakra lorsqu une catégorie secondaire raisonnable est disponible', () => {
  assert.equal(chooseBestCategory(createPlayerBuild(2), card({ chakra: 72, invocation: 75 })), 'invocation')
})
test('une valeur excellente dans une catégorie prioritaire est choisie immédiatement', () => {
  assert.equal(chooseBestCategory(createPlayerBuild(2), card({ chakra: 96, invocation: 75 })), 'chakra')
  assert.equal(chooseBestCategory(createPlayerBuild(2), card({ iq: 96, taijutsu: 60 })), 'iq')
  assert.equal(chooseBestCategory(createPlayerBuild(2), card({ avatar: 100, chakra: 60 })), 'avatar')
})
test('Clan et Kekkei Mōra exigent une compatibilité réelle', () => {
  assert.notEqual(chooseBestCategory(createPlayerBuild(2), card({ chakra: 72, invocation: 75 })), 'clan')
  const otsutsukiCard = cardStatsData.find((entry) => entry.clans.includes('OTSUTSUKI'))
  assert.ok(otsutsukiCard)
  assert.equal(chooseBestCategory(createPlayerBuild(2), realCard(otsutsukiCard)), 'clan')
  assert.notEqual(chooseBestCategory(createPlayerBuild(2), card({ chakra: 72, invocation: 75, kekkeiMora: 100 })), 'kekkei-mora')
  const hamura = cardStatsData.find((entry) => entry.slug === 'hamura')
  assert.ok(hamura)
  const buildWithClanTaken = createPlayerBuild(2)
  buildWithClanTaken.slots.clan = card({ chakra: 1 })
  assert.equal(chooseBestCategory(buildWithClanTaken, realCard(hamura)), 'kekkei-mora')
})
test('une catégorie secondaire exceptionnelle peut battre une priorité médiocre', () => {
  assert.equal(chooseBestCategory(createPlayerBuild(2), card({ chakra: 55, genjutsu: 98 })), 'genjutsu')
  assert.equal(chooseBestCategory(createPlayerBuild(2), card({ chakra: 55, invocation: 100 })), 'invocation')
  assert.equal(chooseBestCategory(createPlayerBuild(2), card({ chakra: 55, fuinjutsu: 100 })), 'fuinjutsu')
  assert.equal(chooseBestCategory(createPlayerBuild(2), card({ chakra: 55, kenjutsu: 97 })), 'kenjutsu')
})
test('IA ne choisit jamais sensory', () => {
  const build = createPlayerBuild(2)
  assert.notEqual(chooseBestCategory(build, card({ sensory: 100, chakra: 0 })), 'sensory')
})
test('IA utilise un tie-break déterministe', () => {
  const build = createPlayerBuild(2)
  for (const category of categoryOrder.filter((category) => category !== 'chakra' && category !== 'iq')) build.slots[category] = card({ chakra: 1 })
  assert.equal(chooseBestCategory(build, card({ chakra: 100, iq: 100 })), 'chakra')
})
test('les 163 cartes sont évaluables sans erreur et sensory est ignoré', () => {
  for (const entry of cardStatsData) {
    assert.doesNotThrow(() => chooseBestCategory(createPlayerBuild(2), realCard(entry)), entry.slug)
  }
  assert.notEqual(chooseBestCategory(createPlayerBuild(2), card({ sensory: 100, chakra: 0 })), 'sensory')
})
test('l IA devient moins conservatrice lorsqu il ne reste que peu de slots', () => {
  const stats = { chakra: 72, invocation: 75 }
  const build = createPlayerBuild(2)
  assert.equal(chooseBestCategory(build, card(stats)), 'invocation')
  for (const category of categoryOrder.filter((category) => category !== 'chakra' && category !== 'invocation')) build.slots[category] = card({ chakra: 1 })
  assert.equal(chooseBestCategory(build, card(stats)), 'chakra')
})
test('une catégorie prioritaire déjà occupée est ignorée', () => {
  const build = createPlayerBuild(2)
  build.slots.chakra = card({ chakra: 1 })
  assert.notEqual(chooseBestCategory(build, card({ chakra: 100, taijutsu: 60 })), 'chakra')
})
test('les séquences complètes conservent différemment les slots stratégiques', () => {
  const sequences = [[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], [16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30], [31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45]]
  for (const ids of sequences) {
    const entries = ids.map((id) => cardStatsData.find((entry) => entry.id === id)!)
    const legacy = simulate(entries, legacyCategory)
    const strategic = simulate(entries, (build, entry) => chooseBestCategory(build, realCard(entry))!)
    assert.ok(Object.values(strategic.slots).every(Boolean))
    assert.notDeepEqual(strategic.slots, legacy.slots)
  }
})
test('une carte sans statistiques est rejetée explicitement', () => {
  assert.throws(() => chooseBestCategory(createPlayerBuild(2), { id: 999, name: 'Sans stats', slug: 'sans-stats', imageUrl: null, stats: {} }), /statistiques absentes/)
})
test('les traits Kekkei Mōra étendent la compatibilité au-delà de Hamura/Toneri', () => {
  const kaguya = cardStatsData.find((entry) => entry.slug === 'kaguya')
  assert.ok(kaguya)
  assert.ok((knowledgeBySlug.get('kaguya')?.traits.kekkeiMoraStrategicScore ?? 0) > 0)
  const withKekkeiMoraAbility = card({ chakra: 40, invocation: 40 }, { slug: 'unknown-six-paths', traits: { kekkeiMoraStrategicScore: 1 } as unknown as Card['traits'] })
  assert.equal(chooseBestCategory(createPlayerBuild(2), withKekkeiMoraAbility), 'kekkei-mora')
  const withoutAbility = card({ chakra: 40, invocation: 40 }, { slug: 'no-six-paths', traits: { kekkeiMoraStrategicScore: 0 } as unknown as Card['traits'] })
  assert.notEqual(chooseBestCategory(createPlayerBuild(2), withoutAbility), 'kekkei-mora')
})
test('le Clan stratégique est dérivé de clanRules (bonus + permissions), pas d’une liste de clans codée en dur', () => {
  const withoutClanBonus = card({ chakra: 60 }, { traits: { clanStrategicScore: 0 } as unknown as Card['traits'] })
  assert.notEqual(chooseBestCategory(createPlayerBuild(2), withoutClanBonus), 'clan')
  const withClanBonus = card({ chakra: 60 }, { traits: { clanStrategicScore: 0.55 } as unknown as Card['traits'] })
  assert.equal(chooseBestCategory(createPlayerBuild(2), withClanBonus), 'clan')
  const yamanaka = cardStatsData.find((entry) => entry.clans.includes('YAMANAKA'))
  assert.ok(yamanaka)
  assert.equal(knowledgeBySlug.get(yamanaka.slug)?.traits.clanStrategicScore, 0)
  const uzumaki = cardStatsData.find((entry) => entry.clans.includes('UZUMAKI'))
  assert.ok(uzumaki)
  assert.ok((knowledgeBySlug.get(uzumaki.slug)?.traits.clanStrategicScore ?? 0) > 0)
})
test('Avatar ignore la statistique si les traits ne confirment aucun avatar explicite', () => {
  const noAvatarTrait = card({ avatar: 100, chakra: 40 }, { traits: { avatars: [] } as unknown as Card['traits'] })
  assert.notEqual(chooseBestCategory(createPlayerBuild(2), noAvatarTrait), 'avatar')
  const withAvatarTrait = card({ avatar: 100, chakra: 40 }, { traits: { avatars: [{ kind: 'SUSANOO', id: 'X' }] } as unknown as Card['traits'] })
  assert.equal(chooseBestCategory(createPlayerBuild(2), withAvatarTrait), 'avatar')
})
test('une carte avec un avatar réellement reconnu dans les traits n’est jamais bloquée', () => {
  const kakashiDms = cardStatsData.find((entry) => entry.slug === 'kakashi-dms')
  assert.ok(kakashiDms)
  assert.ok((knowledgeBySlug.get('kakashi-dms')?.traits.avatars.length ?? 0) > 0)
  const buildWithNinjutsuTaken = createPlayerBuild(2)
  buildWithNinjutsuTaken.slots.ninjutsu = card({ chakra: 1 })
  assert.equal(chooseBestCategory(buildWithNinjutsuTaken, realCard(kakashiDms)), 'avatar')
})
test('les 163 cartes ont des scores stratégiques Clan et Kekkei Mōra cohérents (>= 0)', () => {
  for (const entry of listCardKnowledge()) {
    assert.ok(entry.traits.clanStrategicScore >= 0, entry.slug)
    assert.ok(entry.traits.kekkeiMoraStrategicScore >= 0, entry.slug)
  }
})
