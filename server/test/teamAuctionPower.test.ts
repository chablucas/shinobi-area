import assert from 'node:assert/strict'
import test from 'node:test'
import { getAllCanonicalCards } from '../src/game/cardCatalog.js'
import { getTeamAuctionPowerScore, listTeamAuctionPower } from '../src/game/teamAuctionPower.js'

test('team-auction-power.json couvre exactement le catalogue canonique sans doublon', () => {
  const canonicalCards = getAllCanonicalCards()
  const powerCards = listTeamAuctionPower()

  const slugs = powerCards.map((card) => card.slug)
  const uniqueSlugs = new Set(slugs)
  assert.equal(uniqueSlugs.size, slugs.length, 'aucun slug ne doit être dupliqué')

  if (canonicalCards.length === 163) {
    assert.equal(powerCards.length, 163)
  }

  for (const powerCard of powerCards) {
    assert.ok(canonicalCards.some((card) => card.slug === powerCard.slug), `slug ${powerCard.slug} absent du catalogue canonique`)
  }

  for (const canonicalCard of canonicalCards) {
    const score = getTeamAuctionPowerScore(canonicalCard.slug)
    assert.equal(typeof score, 'number')
    assert.ok(score >= 0 && score <= 100, `generalScore hors plage pour ${canonicalCard.slug}`)
  }
})

test('Kaguya possède la valeur intrinsèque maximale', () => {
  assert.equal(getTeamAuctionPowerScore('kaguya'), 100)
})

test('les cartes Sexy Jutsu sont volontairement quasi nulles', () => {
  assert.ok(getTeamAuctionPowerScore('naruto-sj') <= 5)
  assert.ok(getTeamAuctionPowerScore('konohamaru-sj') <= 5)
})

test('deux variantes du même personnage ont des generalScore distincts par slug', () => {
  const powerCards = listTeamAuctionPower()
  const narutoVariants = powerCards.filter((card) => card.slug.startsWith('naruto'))
  assert.ok(narutoVariants.length > 1)
  const scores = new Set(narutoVariants.map((card) => card.generalScore))
  assert.ok(scores.size > 1, 'les variantes de Naruto doivent avoir des scores différenciés')
})
