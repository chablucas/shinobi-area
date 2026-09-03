<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import GameCard from '../components/GameCard.vue'
import { fetchAllCards } from '../services/cardApi'
import type { Card } from '../types/card'
import {
  CATEGORY_DEFINITIONS,
  createPlayerBuilds,
  drawRandomCard,
  filledSlotCount,
  getNextPlayerId,
  isBuildComplete,
  placeCard,
  resolveManualCombat,
  type CategorySlug,
  type PlayerBuild,
} from '../game/gameEngine'

type Phase = 'construction' | 'combat' | 'result'

const cards = ref<Card[]>([])
const builds = ref<[PlayerBuild, PlayerBuild]>(createPlayerBuilds())
const usedCardIds = ref(new Set<number>())
const pendingCard = ref<Card | null>(null)
const activePlayerId = ref<1 | 2>(1)
const phase = ref<Phase>('construction')
const winnerId = ref<1 | 2 | null>(null)
const loading = ref(true)
const errorMessage = ref('')

const activeBuild = computed(() => builds.value[activePlayerId.value === 1 ? 0 : 1]!)
const availableCardCount = computed(() => cards.value.length - usedCardIds.value.size)
const allBuildsComplete = computed(() => builds.value.every(isBuildComplete))
const winnerName = computed(() => winnerId.value ? `Joueur ${winnerId.value}` : '')

onMounted(async () => {
  try {
    cards.value = await fetchAllCards()
    if (cards.value.length < 30) errorMessage.value = 'Il faut au moins 30 cartes pour commencer une partie.'
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Impossible de charger les cartes.'
  } finally {
    loading.value = false
  }
})

function drawCard() {
  if (phase.value !== 'construction' || pendingCard.value || allBuildsComplete.value) return
  errorMessage.value = ''
  const card = drawRandomCard(cards.value, usedCardIds.value)
  if (!card) {
    errorMessage.value = 'Aucune carte ne reste disponible.'
    return
  }
  pendingCard.value = card
  usedCardIds.value = new Set(usedCardIds.value).add(card.id)
}

function placePendingCard(category: CategorySlug) {
  if (!pendingCard.value || phase.value !== 'construction' || activeBuild.value.slots[category]) return
  const playerIndex = activePlayerId.value - 1
  builds.value[playerIndex] = placeCard(activeBuild.value, category, pendingCard.value)
  pendingCard.value = null

  if (allBuildsComplete.value) {
    phase.value = 'combat'
    return
  }
  activePlayerId.value = getNextPlayerId(activePlayerId.value)
}

function chooseWinner(playerId: 1 | 2) {
  if (phase.value !== 'combat') return
  winnerId.value = resolveManualCombat(playerId).winnerId
  phase.value = 'result'
}

function replay() {
  builds.value = createPlayerBuilds()
  usedCardIds.value = new Set()
  pendingCard.value = null
  activePlayerId.value = 1
  winnerId.value = null
  errorMessage.value = ''
  phase.value = 'construction'
}

function slotCard(build: PlayerBuild, slug: CategorySlug) {
  return build.slots[slug]
}
</script>

<template>
  <main class="game-shell">
    <nav class="game-nav">
      <a class="brand" href="/"><span class="brand-mark"><i></i><i></i><i></i></span><span>Shinobi <em>Area</em></span></a>
      <a class="back-link" href="/">Retour accueil <span>↗</span></a>
    </nav>

    <header class="page-heading">
      <div>
        <p class="eyebrow">Construction locale · 30 placements</p>
        <h1 v-if="phase === 'construction'">Forge tes <i>compositions.</i></h1>
        <h1 v-else-if="phase === 'combat'">Place au <i>combat.</i></h1>
        <h1 v-else>Le verdict est <i>tombé.</i></h1>
      </div>
      <div v-if="phase === 'construction'" class="turn-status" :class="{ active: !pendingCard }">
        <span class="status-dot"></span>
        <strong>{{ pendingCard ? `Joueur ${activePlayerId} choisit une catégorie` : `Tour du Joueur ${activePlayerId}` }}</strong>
        <small>{{ availableCardCount }} cartes disponibles</small>
      </div>
    </header>

    <p v-if="loading" class="loading-message">Chargement des 163 cartes...</p>
    <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>

    <template v-if="phase === 'construction'">
      <section class="construction-layout">
        <div class="builds-column">
          <article v-for="build in builds" :key="build.playerId" class="build-panel" :class="{ 'is-active': build.playerId === activePlayerId }">
            <header class="build-header">
              <div><p class="eyebrow">Composition</p><h2>Joueur {{ build.playerId }}</h2></div>
              <span class="build-count">{{ filledSlotCount(build) }} <small>/ 15</small></span>
            </header>
            <div class="category-grid">
              <button v-for="[label, slug] in CATEGORY_DEFINITIONS" :key="slug" class="category-slot" :class="{ filled: slotCard(build, slug), selectable: build.playerId === activePlayerId && !!pendingCard && !slotCard(build, slug) }" type="button" :disabled="build.playerId !== activePlayerId || !pendingCard || !!slotCard(build, slug)" @click="placePendingCard(slug)">
                <span class="slot-label">{{ label }}</span>
                <template v-if="slotCard(build, slug)"><span class="slot-card-name">{{ slotCard(build, slug)?.name }}</span><span class="slot-state">Remplie</span></template>
                <template v-else><span class="slot-empty">Libre</span><span class="slot-state">{{ build.playerId === activePlayerId && pendingCard ? 'Placer ici' : 'En attente' }}</span></template>
              </button>
            </div>
          </article>
        </div>

        <aside class="draw-panel">
          <p class="eyebrow">Zone de pioche</p>
          <h2>{{ pendingCard ? 'Carte piochée' : 'À toi de jouer' }}</h2>
          <div v-if="pendingCard" class="drawn-card"><GameCard :card="pendingCard" :revealed="true" active /></div>
          <div v-else class="draw-placeholder"><span>?</span><small>Une carte à la fois</small></div>
          <button class="draw-button" type="button" :disabled="loading || !!pendingCard || availableCardCount === 0 || allBuildsComplete" @click="drawCard">PIOCHER <span>↓</span></button>
          <p class="draw-hint">{{ pendingCard ? 'Choisis une case libre dans la composition active.' : `Joueur ${activePlayerId}, pioche une carte.` }}</p>
        </aside>
      </section>
    </template>

    <section v-else-if="phase === 'combat'" class="combat-panel">
      <div class="combat-intro"><p class="eyebrow">Étape suivante</p><h2>Qui gagne le combat ?</h2><p>Les deux compositions sont complètes. Le résultat manuel est disponible pour cette version.</p></div>
      <div class="combat-actions"><button type="button" @click="chooseWinner(1)">Joueur 1 gagne <span>→</span></button><button type="button" @click="chooseWinner(2)">Joueur 2 gagne <span>→</span></button></div>
      <div class="combat-builds"><article v-for="build in builds" :key="build.playerId" class="build-panel"><header class="build-header"><h3>Joueur {{ build.playerId }}</h3><span class="build-count">15 <small>/ 15</small></span></header><div class="category-grid"><div v-for="[label, slug] in CATEGORY_DEFINITIONS" :key="slug" class="category-slot filled"><span class="slot-label">{{ label }}</span><span class="slot-card-name">{{ slotCard(build, slug)?.name }}</span><span class="slot-state">Remplie</span></div></div></article></div>
    </section>

    <section v-else class="result-panel">
      <p class="eyebrow">Combat terminé</p><h2>{{ winnerName }} gagne.</h2><p>Victoire enregistrée manuellement. Les deux compositions restent disponibles ci-dessous.</p>
      <div class="result-builds"><article v-for="build in builds" :key="build.playerId"><h3>Joueur {{ build.playerId }}</h3><div v-for="[label, slug] in CATEGORY_DEFINITIONS" :key="slug"><span>{{ label }}</span><strong>{{ slotCard(build, slug)?.name }}</strong></div></article></div>
      <div class="result-actions"><button class="primary-button" type="button" @click="replay">Rejouer <span>↻</span></button><a class="secondary-button" href="/">Retour à l’accueil <span>↗</span></a></div>
    </section>
  </main>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Syne:wght@400;600;700;800&display=swap');
:root { font-family: 'DM Mono', monospace; color: #f2eee7; background: #111312; font-synthesis: none; } * { box-sizing: border-box; } body { margin: 0; min-width: 320px; } button, a { font: inherit; } button { cursor: pointer; } button:disabled { cursor: not-allowed; } a { color: inherit; text-decoration: none; }
.game-shell { min-height: 100vh; background: radial-gradient(circle at 85% 8%, #382821 0, #111312 37%); padding: 0 max(20px, calc((100vw - 1360px) / 2)); } .game-nav { height: 78px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #303430; } .brand { display: flex; align-items: center; gap: 12px; font: 700 17px 'Syne', sans-serif; } .brand em, h1 i { color: #ee7860; font-style: normal; } .brand-mark { width: 29px; height: 29px; display: flex; gap: 3px; align-items: center; justify-content: center; border: 1px solid #ee7860; transform: rotate(45deg); } .brand-mark i { width: 2px; height: 15px; display: block; background: #ee7860; transform: skew(-22deg); } .brand-mark i:nth-child(2) { height: 20px; background: #e7c57e; } .back-link { color: #9da49d; font-size: 11px; } .back-link span { color: #e7c57e; margin-left: 8px; }
.page-heading { display: flex; align-items: end; justify-content: space-between; gap: 30px; padding: 53px 0 34px; } .eyebrow { color: #e7c57e; font-size: 10px; letter-spacing: .13em; text-transform: uppercase; } h1, h2, h3 { font-family: 'Syne', sans-serif; } h1 { font-size: clamp(40px, 5vw, 70px); line-height: .95; letter-spacing: -.07em; margin: 20px 0 0; } h2 { letter-spacing: -.05em; } .turn-status { min-width: 245px; padding: 15px; border: 1px solid #ee7860; background: #302421; } .turn-status strong, .turn-status small { display: block; } .turn-status strong { color: #f2eee7; font-size: 11px; } .turn-status small { margin-top: 7px; color: #a4aaa3; font-size: 9px; } .status-dot { display: inline-block; width: 7px; height: 7px; margin-right: 8px; border-radius: 50%; background: #ee7860; box-shadow: 0 0 12px #ee7860; }
.construction-layout { display: grid; grid-template-columns: minmax(0, 1fr) 250px; align-items: start; gap: 18px; padding-bottom: 70px; } .builds-column { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; } .build-panel { min-width: 0; padding: 16px; border: 1px solid #383e39; background: rgba(32,36,33,.88); } .build-panel.is-active { border-color: #e7c57e; } .build-header { display: flex; align-items: end; justify-content: space-between; margin-bottom: 15px; } .build-header .eyebrow { margin: 0 0 7px; } .build-header h2 { margin: 0; font-size: 24px; } .build-count { color: #e7c57e; font: 700 29px 'Syne', sans-serif; } .build-count small { color: #929890; font: 11px 'DM Mono', monospace; } .category-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; } .category-slot { min-width: 0; min-height: 72px; padding: 9px; color: #858d85; text-align: left; background: #181b19; border: 1px solid #303530; } .category-slot.selectable { color: #f2eee7; border-color: #73663d; background: #29271e; } .category-slot.selectable:hover { border-color: #e7c57e; transform: translateY(-1px); } .category-slot.filled { color: #f2eee7; background: #302421; border-color: #765045; } .slot-label, .slot-card-name, .slot-state, .slot-empty { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .slot-label { color: #e7c57e; font-size: 9px; text-transform: uppercase; } .slot-card-name { margin-top: 8px; color: #f2eee7; font: 600 13px 'Syne', sans-serif; } .slot-empty { margin-top: 10px; font-size: 11px; } .slot-state { margin-top: 5px; color: #747c74; font-size: 8px; text-transform: uppercase; } .filled .slot-state { color: #ee7860; }
.draw-panel { position: sticky; top: 16px; padding: 19px; border: 1px solid #e7c57e; background: #302c20; } .draw-panel .eyebrow { margin: 0; } .draw-panel h2 { margin: 11px 0 14px; font-size: 23px; } .drawn-card { max-width: 190px; margin: 0 auto 16px; } .drawn-card .game-card-copy { padding: 10px; } .drawn-card .game-card-copy h3 { font-size: 13px; } .draw-placeholder { display: grid; place-items: center; min-height: 240px; margin-bottom: 16px; border: 1px dashed #74683f; color: #e7c57e; } .draw-placeholder span { font: 700 70px 'Syne', sans-serif; } .draw-placeholder small { color: #aaa184; font-size: 9px; } .draw-button, .primary-button, .secondary-button { display: inline-flex; align-items: center; justify-content: space-between; gap: 20px; width: 100%; padding: 14px 16px; border: 0; color: #191a17; background: #e7c57e; font-size: 11px; } .draw-button:disabled { opacity: .45; } .draw-button span, .primary-button span, .secondary-button span { font-size: 17px; } .draw-hint { min-height: 29px; margin: 12px 0 0; color: #aaa184; font-size: 9px; line-height: 1.5; } .loading-message, .error-message { font-size: 11px; } .error-message { color: #ee7860; }
.combat-panel, .result-panel { max-width: 960px; padding: 45px 0 90px; } .combat-intro h2, .result-panel h2 { margin: 18px 0 10px; font-size: clamp(32px, 5vw, 60px); } .combat-intro p, .result-panel > p { max-width: 520px; color: #a4aaa3; font-size: 11px; line-height: 1.7; } .combat-actions { display: flex; gap: 12px; margin: 35px 0; } .combat-actions button { flex: 1; padding: 23px; color: #f2eee7; background: #302421; border: 1px solid #ee7860; text-align: left; font: 600 17px 'Syne', sans-serif; } .combat-actions button + button { background: #202b28; border-color: #a6d0b8; } .combat-actions span { float: right; color: #e7c57e; } .combat-builds { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; } .combat-builds .build-panel { padding: 16px; } .combat-builds .build-header { margin-bottom: 15px; } .combat-builds .build-header h3 { margin: 0; font-size: 20px; }
.result-builds { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; margin: 32px 0; } .result-builds article { padding: 17px; border: 1px solid #383e39; background: #202421; } .result-builds h3 { margin: 0 0 13px; } .result-builds div { display: flex; justify-content: space-between; gap: 12px; padding: 7px 0; border-top: 1px solid #303530; font-size: 9px; } .result-builds strong { color: #e7c57e; text-align: right; } .result-actions { display: flex; gap: 10px; } .result-actions .primary-button, .result-actions .secondary-button { width: auto; } .secondary-button { color: #e4e7df; background: transparent; border: 1px solid #4a504b; }
@media (max-width: 900px) { .construction-layout { grid-template-columns: 1fr; } .draw-panel { position: static; display: grid; grid-template-columns: 1fr 190px; gap: 10px 18px; align-items: center; } .draw-panel .eyebrow, .draw-panel h2, .draw-hint { grid-column: 1; } .drawn-card, .draw-placeholder { grid-column: 2; grid-row: 1 / span 4; margin: 0; } .draw-button { grid-column: 1; } }
@media (max-width: 650px) { .page-heading { display: block; padding-top: 40px; } .turn-status { margin-top: 25px; } .builds-column, .combat-builds, .result-builds { grid-template-columns: 1fr; } .build-panel { padding: 13px; } .category-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } .category-slot { min-height: 66px; padding: 7px; } .slot-card-name { font-size: 11px; } .draw-panel { display: grid; grid-template-columns: 1fr 130px; } .drawn-card, .draw-placeholder { grid-column: 2; } .draw-placeholder { min-height: 185px; } .draw-placeholder span { font-size: 52px; } .combat-actions { display: grid; } .result-actions { flex-wrap: wrap; } }
@media (max-width: 420px) { .game-shell { padding: 0 14px; } .category-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .draw-panel { display: block; } .drawn-card, .draw-placeholder { margin-bottom: 15px; } .combat-actions button { font-size: 14px; } }
</style>
