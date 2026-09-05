import assert from 'node:assert/strict'
import test from 'node:test'
import { GameStatus, Prisma } from '@prisma/client'
import { prisma } from '../src/config/prisma.js'
import { getCardKnowledgeBySlug, listCardKnowledge } from '../src/game/cardKnowledge.js'
import { publicGameState, GAME_CATEGORIES } from '../src/services/realtimeGameService.js'

// Les 9 variantes exigées par l'audit, avec leur slug canonique et leur nom canonique attendus.
const EXPECTED_VARIANTS: Array<{ slug: string; name: string }> = [
  { slug: 'obito-blanc', name: 'Obito Blanc' },
  { slug: 'obito-orange', name: 'Obito Orange' },
  { slug: 'naruto-sj', name: 'Naruto SJ' },
  { slug: 'kakashi-ms', name: 'Kakashi MS' },
  { slug: 'kakashi-dms', name: 'Kakashi DMS' },
  { slug: 'hiruzen', name: 'Hiruzen' },
  { slug: 'hiruzen-vieux', name: 'Hiruzen Vieux' },
  { slug: 'oonoki', name: 'Oonoki' },
  { slug: 'ooniki-vieux', name: 'Ooniki Vieux' },
]

// Construit une ligne Game minimale dont les slots du joueur 1 portent les IDs CANONIQUES
// des slugs demandés. publicGameState ne lit que l'état JSON + la table Card, donc aucune
// ligne Game/Lobby/User n'est créée en base.
function fakeGameWithSlots(userId: number, slugs: string[]) {
  const slots: Record<string, number | null> = Object.fromEntries(GAME_CATEGORIES.map((category) => [category, null]))
  slugs.slice(0, GAME_CATEGORIES.length).forEach((slug, index) => {
    slots[GAME_CATEGORIES[index]!] = getCardKnowledgeBySlug(slug)!.id
  })
  const state = { players: [{ userId, displayName: 'Probe', playerNumber: 1, pile: [] as number[], pendingCardId: null, slots }] }
  return {
    id: 'probe-game',
    lobbyId: 'probe-lobby',
    mode: 'ONE_V_ONE',
    status: GameStatus.PLAYING,
    currentPlayerNumber: 1,
    turnNumber: 0,
    state: state as unknown as Prisma.JsonValue,
  }
}

test('chaque variante récupère son propre slug, nom et image Prisma dans le DTO realtime', async (t) => {
  for (const expected of EXPECTED_VARIANTS) {
    await t.test(expected.slug, async () => {
      const knowledge = getCardKnowledgeBySlug(expected.slug)
      assert.ok(knowledge, `carte canonique absente pour ${expected.slug}`)
      const prismaCard = await prisma.card.findUnique({ where: { slug: expected.slug }, select: { id: true, slug: true, name: true, imageUrl: true } })
      assert.ok(prismaCard, `carte Prisma absente pour le slug ${expected.slug}`)
      assert.equal(prismaCard.name, expected.name)

      const dto = await publicGameState(fakeGameWithSlots(4242, [expected.slug]) as never, 4242)
      assert.ok(dto)
      const view = dto.players[0]!.slots[GAME_CATEGORIES[0]!]
      assert.ok(view)
      assert.equal(view.slug, expected.slug, 'le slug du DTO realtime doit être le slug canonique')
      assert.equal(view.name, expected.name, 'le nom du DTO realtime doit être le nom canonique de la variante')
      assert.equal(view.id, knowledge.id, 'le realtime garde l’ID canonique')
      assert.ok(prismaCard.imageUrl, `la carte Prisma ${expected.slug} doit avoir une image`)
      assert.equal(view.imageUrl, prismaCard.imageUrl, 'l’image du DTO realtime doit être celle de la carte Prisma du MÊME slug')
      assert.deepEqual(view.stats, knowledge.stats, 'les stats du DTO realtime doivent être celles de la variante canonique')
    })
  }
})

test('les variantes d’un même personnage ne partagent ni image ni stats en realtime', async () => {
  const groups: string[][] = [
    ['obito', 'obito-blanc', 'obito-orange'],
    ['naruto', 'naruto-sj', 'naruto-ermite', 'naruto-kcm', 'naruto-kcm1', 'naruto-kcm-sen', 'naruto-rikudo'],
    ['kakashi', 'kakashi-ms', 'kakashi-dms', 'kakashi-hokage'],
    ['hiruzen', 'hiruzen-vieux'],
    ['oonoki', 'ooniki-vieux'],
  ]
  for (const group of groups) {
    const views = []
    for (const slug of group) {
      const dto = await publicGameState(fakeGameWithSlots(4343, [slug]) as never, 4343)
      const view = dto!.players[0]!.slots[GAME_CATEGORIES[0]!]!
      views.push({ slug, imageUrl: view.imageUrl, stats: view.stats, name: view.name })
    }
    const images = new Set(views.map((view) => view.imageUrl))
    const statsSignatures = new Set(views.map((view) => JSON.stringify(view.stats)))
    const names = new Set(views.map((view) => view.name))
    assert.equal(images.size, group.length, `images dupliquées dans le groupe ${group.join(', ')}`)
    assert.equal(statsSignatures.size, group.length, `stats dupliquées dans le groupe ${group.join(', ')}`)
    assert.equal(names.size, group.length, `noms dupliqués dans le groupe ${group.join(', ')}`)
  }
})

test('un ID canonique différent de l’ID Prisma permet quand même de récupérer la bonne image', async () => {
  const prismaCards = await prisma.card.findMany({ select: { id: true, slug: true, imageUrl: true } })
  const bySlug = new Map(prismaCards.map((card) => [card.slug, card]))
  // Il doit exister des cartes dont l'ID canonique (JSON) diffère de l'ID Prisma (autoincrement) :
  // c'est précisément le cas que le correctif couvre.
  const divergent = listCardKnowledge().filter((card) => bySlug.get(card.slug) && bySlug.get(card.slug)!.id !== card.id)
  assert.ok(divergent.length > 150, `attendu >150 cartes avec ID canonique ≠ ID Prisma, trouvé ${divergent.length}`)

  for (const knowledge of divergent) {
    const prismaCard = bySlug.get(knowledge.slug)!
    const dto = await publicGameState(fakeGameWithSlots(4545, [knowledge.slug]) as never, 4545)
    const view = dto!.players[0]!.slots[GAME_CATEGORIES[0]!]!
    assert.equal(view.id, knowledge.id)
    assert.notEqual(view.id, prismaCard.id, `${knowledge.slug} : l’ID canonique doit différer de l’ID Prisma dans ce test`)
    assert.equal(view.slug, knowledge.slug)
    assert.equal(view.imageUrl, prismaCard.imageUrl, `${knowledge.slug} : mauvaise image malgré la résolution par slug`)
  }
})
