import assert from 'node:assert/strict'
import test from 'node:test'
import { prisma } from '../src/config/prisma.js'
import { getCanonicalCard, resolveCanonicalSlug } from '../src/game/cardCatalog.js'
import { getCard } from '../src/services/cardService.js'

test('les cartes Prisma doivent résoudre leur slug canonique et garder le nom du JSON', async () => {
  const cards = await prisma.card.findMany({ select: { slug: true, name: true, imageUrl: true }, take: 200 })
  const required = {
    nagato: 'nagato-prime',
    aoba: 'aoba',
    obito: 'obito',
    sai: 'sai',
    yugito: 'yugito',
    madara: 'madara',
    kakashi: 'kakashi',
    karui: 'karui',
    shin: 'shin',
    konan: 'konan',
    hashirama: 'hashirama',
  }

  for (const [legacySlug, canonicalSlug] of Object.entries(required)) {
    const canonical = getCanonicalCard(legacySlug)
    assert.ok(canonical, `Carte canonique absente pour ${legacySlug}`)
    assert.equal(canonical.slug, canonicalSlug)
    assert.equal(resolveCanonicalSlug(legacySlug), canonicalSlug)
  }

  for (const card of cards) {
    const canonical = getCanonicalCard(card.slug) ?? getCanonicalCard(resolveCanonicalSlug(card.slug))
    assert.ok(canonical, `Le slug Prisma ${card.slug} ne correspond à aucune carte canonique.`)
    assert.equal(resolveCanonicalSlug(card.slug), canonical.slug)
    const dto = await getCard(card.slug)
    assert.ok(dto)
    assert.equal(dto.slug, canonical.slug)
    assert.equal(dto.name, canonical.name)
    assert.equal(dto.imageUrl, card.imageUrl)
  }
})
