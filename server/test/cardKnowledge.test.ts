import assert from 'node:assert/strict'
import test from 'node:test'
import cardStatsData from '../src/data/shinobi-card-stats.json' with { type: 'json' }
import cardTraitsData from '../src/data/shinobi-card-traits.json' with { type: 'json' }
import cardRaritiesData from '../src/data/shinobi-card-rarities.json' with { type: 'json' }
import { CARD_KNOWLEDGE, CARD_KNOWLEDGE_COUNT, getCardKnowledgeBySlug, listCardKnowledge, rarityOrder } from '../src/game/cardKnowledge.js'

test('il existe exactement 163 cartes dans les trois sources canoniques', () => {
  assert.equal(cardStatsData.length, 163)
  assert.equal(cardTraitsData.cardTraits.length, 163)
  assert.equal(cardRaritiesData.cards.length, 163)
  assert.equal(CARD_KNOWLEDGE_COUNT, 163)
})

test('aucun doublon de slug côté stats ou traits', () => {
  assert.equal(new Set(cardStatsData.map((card) => card.slug)).size, 163)
  assert.equal(new Set(cardTraitsData.cardTraits.map((card: { slug: string }) => card.slug)).size, 163)
})

test('les 163 slugs de stats correspondent exactement aux 163 slugs de traits', () => {
  const statsSlugs = new Set(cardStatsData.map((card) => card.slug))
  const traitsSlugs = new Set(cardTraitsData.cardTraits.map((card: { slug: string }) => card.slug))
  assert.deepEqual([...statsSlugs].sort(), [...traitsSlugs].sort())
})

test('les slugs de rareté correspondent exactement aux slugs de stats', () => {
  const statsSlugs = new Set(cardStatsData.map((card) => card.slug))
  const raritySlugs = new Set(cardRaritiesData.cards.map((card) => card.slug))
  assert.deepEqual([...statsSlugs].sort(), [...raritySlugs].sort())
  assert.equal(raritySlugs.size, 163)
})

test('la rareté est chargée par slug et respecte son rang canonique', () => {
  const rarity = getCardKnowledgeBySlug('hamura')?.rarity
  assert.ok(rarity)
  assert.equal(rarityOrder.find((item) => item.id === rarity)?.rank, getCardKnowledgeBySlug('hamura')?.rarityMetadata.rank)
  assert.deepEqual(rarityOrder.map((item) => item.id), ['UNCOMMON', 'COMMON', 'RARE', 'EPIC', 'MYTHIC', 'LEGENDARY', 'SEMI_GOD', 'DIVINE'])
})

test('le lookup par slug renvoie les stats et les traits fusionnés', () => {
  const hamura = getCardKnowledgeBySlug('hamura')
  assert.ok(hamura)
  assert.equal(hamura.stats.chakra, cardStatsData.find((card) => card.slug === 'hamura')?.stats.chakra)
  assert.ok(hamura.traits.abilities.kekkeiMora.length > 0)
})

test('listCardKnowledge expose bien les 163 cartes fusionnées', () => {
  assert.equal(listCardKnowledge().length, 163)
  assert.ok(CARD_KNOWLEDGE.every((card) => card.stats && card.traits))
})
