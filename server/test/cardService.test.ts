import assert from 'node:assert/strict'
import test from 'node:test'
import { listCards } from '../src/services/cardService.js'

test('GET /api/cards peut sérialiser les 163 cartes avec leurs statistiques IA', async () => {
  const firstPage = await listCards(1, 100)
  const secondPage = await listCards(2, 100)
  const cards = [...firstPage.data, ...secondPage.data]
  const ukonSakon = cards.find((card) => card.slug === 'ukon-et-sakon')

  assert.equal(firstPage.pagination.total, 163)
  assert.equal(cards.length, 163)
  assert.ok(ukonSakon)
  assert.deepEqual(
    ukonSakon.stats,
    {
      chakra: 48,
      invocation: 0,
      iq: 67,
      ninjutsuAttack: 52,
      ninjutsuDefense: 43,
      genjutsu: 0,
      taijutsu: 34,
      avatar: 0,
      body: 53,
      fuinjutsu: 0,
      senjutsu: 0,
      kenjutsu: 0,
      clan: 0,
      speed: 40,
      kekkeiGenkai: 0,
      sensory: 0,
    },
  )
  assert.equal(typeof ukonSakon.stats.chakra, 'number')
  assert.equal(typeof ukonSakon.stats.iq, 'number')
  assert.equal(typeof ukonSakon.stats.ninjutsuAttack, 'number')
  assert.equal(typeof ukonSakon.stats.ninjutsuDefense, 'number')
  assert.equal(typeof ukonSakon.stats.genjutsu, 'number')
  assert.equal(typeof ukonSakon.stats.taijutsu, 'number')
  assert.equal(typeof ukonSakon.stats.speed, 'number')
})