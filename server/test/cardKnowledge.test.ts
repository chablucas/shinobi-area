import assert from 'node:assert/strict'
import test from 'node:test'
import { getAllCanonicalCards } from '../src/game/cardCatalog.js'
import { CARD_KNOWLEDGE, CARD_KNOWLEDGE_COUNT, getCardKnowledgeBySlug, listCardKnowledge, rarityOrder } from '../src/game/cardKnowledge.js'

const canonicalCards = getAllCanonicalCards() as Array<{ id: number; slug: string; name: string; stats: Record<string, number>; traits: Record<string, unknown>; rarity: string; rarityMeta: { label: string; rank: number; colorName: string; colorHex: string } }>

test('le catalogue canonique contient exactement 163 cartes', () => {
  assert.equal(canonicalCards.length, 163)
  assert.equal(CARD_KNOWLEDGE_COUNT, 163)
})

test('le catalogue canonique expose 163 slugs uniques sans vide', () => {
  const slugs = canonicalCards.map((card) => card.slug)
  assert.equal(new Set(slugs).size, 163)
  assert.ok(slugs.every((slug) => slug && slug.trim().length > 0))
  assert.ok(canonicalCards.every((card) => card.name && card.name.trim().length > 0))
})

test('chaque carte canonique possède les champs attendus', () => {
  for (const card of canonicalCards) {
    assert.ok(card.id)
    assert.ok(card.slug)
    assert.ok(card.name)
    assert.ok(card.stats)
    assert.ok(card.traits)
    assert.ok(card.rarity)
    assert.ok(card.rarityMeta)
  }
})

test('la rareté est cohérente avec l’ordre canonique global', () => {
  const hamura = getCardKnowledgeBySlug('hamura')
  assert.ok(hamura)
  assert.equal(hamura.rarity, 'SEMI_GOD')
  assert.equal(rarityOrder.find((item) => item.id === hamura.rarity)?.rank, hamura.rarityMetadata.rank)
  assert.deepEqual(rarityOrder.map((item) => item.id), ['UNCOMMON', 'COMMON', 'RARE', 'EPIC', 'MYTHIC', 'LEGENDARY', 'SEMI_GOD', 'DIVINE'])
})

test('le lookup par slug renvoie bien la carte canonique complète', () => {
  const hamura = getCardKnowledgeBySlug('hamura')
  assert.ok(hamura)
  assert.equal(hamura.name, 'Hamura')
  assert.ok(hamura.stats.chakra >= 0)
  assert.ok(Array.isArray(hamura.traits.eligibleSlots))
  assert.ok(hamura.traits.abilities.kekkeiMora.length >= 0)
})

test('listCardKnowledge expose bien les 163 cartes et leur unicité', () => {
  assert.equal(listCardKnowledge().length, 163)
  assert.equal(new Set(listCardKnowledge().map((card) => card.slug)).size, 163)
  assert.ok(CARD_KNOWLEDGE.every((card) => card.stats && card.traits && card.rarityMetadata))
})

test('le mapping Nagato/Aoba/Obito/Sai reste correct', () => {
  assert.equal(getCardKnowledgeBySlug('nagato')?.name, 'Nagato')
  assert.equal(getCardKnowledgeBySlug('aoba')?.name, 'Aoba')
  assert.equal(getCardKnowledgeBySlug('obito')?.name, 'Obito')
  assert.equal(getCardKnowledgeBySlug('sai')?.name, 'Sai')
  assert.equal(getCardKnowledgeBySlug('ukon-sakon')?.name, 'Ukon & Sakon')
})
