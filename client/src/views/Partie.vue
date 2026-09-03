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
  undoPlacement,
  type CategorySlug,
  type LastPlacement,
  type PlayerBuild,
} from '../game/gameEngine'

type Phase = 'construction' | 'combat' | 'result'

const cards = ref<Card[]>([])
const builds = ref<[PlayerBuild, PlayerBuild]>(createPlayerBuilds())
const usedCardIds = ref(new Set<number>())
const pendingCard = ref<Card | null>(null)
const lastPlacement = ref<LastPlacement | null>(null)
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
  lastPlacement.value = { playerId: activePlayerId.value, category, card: pendingCard.value }
  pendingCard.value = null

  if (allBuildsComplete.value) {
    phase.value = 'combat'
    return
  }
  activePlayerId.value = getNextPlayerId(activePlayerId.value)
}

function undoLastPlacement() {
  if (phase.value !== 'construction' || !lastPlacement.value || pendingCard.value) return
  const placement = lastPlacement.value
  const playerIndex = placement.playerId - 1
  builds.value[playerIndex] = undoPlacement(builds.value[playerIndex]!, placement)
  pendingCard.value = placement.card
  activePlayerId.value = placement.playerId
  lastPlacement.value = null
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
  lastPlacement.value = null
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
      <a class="brand" href="/" aria-label="Shinobi Area, accueil"><img class="brand-logo" src="/logo.png" alt="" aria-hidden="true" /></a>
      <div class="game-nav-links"><a class="game-nav-tab active" href="/partie">Combat 2</a><a class="game-nav-tab" href="/partie">Combat 3</a></div>
      <a class="profile-link" href="/partie">Profil</a>
    </nav>

    <header class="page-heading">
      <div>
        <p class="eyebrow">Construction locale · 30 placements</p>
        <h1>Fight</h1>
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
          <article v-for="build in builds" :key="build.playerId" class="build-panel" :class="{ 'is-active': build.playerId === activePlayerId, 'player-one': build.playerId === 1, 'player-two': build.playerId === 2 }">
            <header class="build-header">
              <div><p class="eyebrow">Composition</p><h2>Joueur {{ build.playerId }}</h2></div>
              <span class="build-count">{{ filledSlotCount(build) }} <small>/ 15</small></span>
            </header>
            <div class="category-grid">
              <button v-for="[label, slug] in CATEGORY_DEFINITIONS" :key="slug" class="category-slot" :class="{ filled: slotCard(build, slug), selectable: build.playerId === activePlayerId && !!pendingCard && !slotCard(build, slug) }" type="button" :disabled="build.playerId !== activePlayerId || !pendingCard || !!slotCard(build, slug)" @click="placePendingCard(slug)">
                <span class="slot-label">{{ label }}</span>
                <template v-if="slotCard(build, slug)"><span class="slot-card-preview"><img v-if="slotCard(build, slug)?.imageUrl" :src="slotCard(build, slug)?.imageUrl ?? undefined" :alt="`Miniature de ${slotCard(build, slug)?.name}`" /><span v-else class="slot-card-fallback">{{ slotCard(build, slug)?.name.slice(0, 1) }}</span></span><span class="slot-card-details"><span class="slot-card-name">{{ slotCard(build, slug)?.name }}</span><span class="slot-state">Remplie</span></span></template>
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
          <div class="draw-actions"><button class="draw-button" type="button" :disabled="loading || !!pendingCard || availableCardCount === 0 || allBuildsComplete" @click="drawCard">PIOCHER <span>↓</span></button><button class="back-button" type="button" :disabled="!lastPlacement || !!pendingCard" @click="undoLastPlacement">← Retour</button></div>
          <p class="draw-hint">{{ pendingCard ? 'Choisis une case libre dans la composition active.' : `Joueur ${activePlayerId}, pioche une carte.` }}</p>
        </aside>
      </section>
    </template>

    <section v-else-if="phase === 'combat'" class="combat-panel">
      <div class="combat-intro"><p class="eyebrow">Étape suivante</p><h2>Qui gagne le combat ?</h2><p>Les deux compositions sont complètes. Le résultat manuel est disponible pour cette version.</p></div>
      <div class="combat-actions"><button type="button" @click="chooseWinner(1)">Joueur 1 gagne <span>→</span></button><button type="button" @click="chooseWinner(2)">Joueur 2 gagne <span>→</span></button></div>
      <div class="combat-builds"><article v-for="build in builds" :key="build.playerId" class="build-panel" :class="{ 'player-one': build.playerId === 1, 'player-two': build.playerId === 2 }"><header class="build-header"><h3>Joueur {{ build.playerId }}</h3><span class="build-count">15 <small>/ 15</small></span></header><div class="category-grid"><div v-for="[label, slug] in CATEGORY_DEFINITIONS" :key="slug" class="category-slot filled"><span class="slot-label">{{ label }}</span><span class="slot-card-preview"><img v-if="slotCard(build, slug)?.imageUrl" :src="slotCard(build, slug)?.imageUrl ?? undefined" :alt="`Miniature de ${slotCard(build, slug)?.name}`" /><span v-else class="slot-card-fallback">{{ slotCard(build, slug)?.name.slice(0, 1) }}</span></span><span class="slot-card-details"><span class="slot-card-name">{{ slotCard(build, slug)?.name }}</span><span class="slot-state">Remplie</span></span></div></div></article></div>
    </section>

    <section v-else class="result-panel">
      <p class="eyebrow">Combat terminé</p><h2>{{ winnerName }} gagne.</h2><p>Victoire enregistrée manuellement. Les deux compositions restent disponibles ci-dessous.</p>
      <div class="result-builds"><article v-for="build in builds" :key="build.playerId"><h3>Joueur {{ build.playerId }}</h3><div v-for="[label, slug] in CATEGORY_DEFINITIONS" :key="slug"><span>{{ label }}</span><strong>{{ slotCard(build, slug)?.name }}</strong></div></article></div>
      <div class="result-actions"><button class="primary-button" type="button" @click="replay">Rejouer <span>↻</span></button><a class="secondary-button" href="/">Retour à l’accueil <span>↗</span></a></div>
    </section>
  </main>
</template>

<style>
.game-shell {
  min-height: 100vh;
  background: var(--bg-main);
}

.game-shell > * {
  max-width: 1360px;
  margin-inline: auto;
  padding-inline: max(20px, calc((100vw - 1360px) / 2));
}

.game-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: none !important;
  min-height: 78px;
  border-bottom: 1px solid rgba(84, 48, 12, 0.35);
  background: var(--accent-orange);
}

.game-nav .brand {
  font-size: 1rem;
}

.game-nav .brand-logo {
  display: block;
  width: auto;
  height: 48px;
  object-fit: contain;
}

.game-nav-links {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #2b2113;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-size: 0.68rem;
}

.game-nav-tab {
  padding: 0.75rem 1.15rem;
  border: 1px solid rgba(76, 48, 15, 0.35);
  background: rgba(255, 214, 102, 0.34);
  clip-path: var(--clip-soft);
}

.game-nav-tab.active {
  background: #fff0bd;
  font-weight: 700;
}

.game-nav-tab:hover,
.game-nav-tab:focus-visible {
  background: rgba(255, 236, 174, 0.58);
}

.game-nav .profile-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 42px;
  padding: 0.75rem 1.25rem;
  border: 1px solid rgba(76, 48, 15, 0.42);
  background: #2b2113;
  color: #fff0bd;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 0.64rem;
  clip-path: var(--clip-soft);
}

.game-nav .profile-link:hover,
.game-nav .profile-link:focus-visible {
  background: #473316;
}

.page-heading {
  display: block;
  text-align: center;
  padding: 52px 0 26px;
}

.eyebrow {
  color: var(--accent-gold);
  font-size: 0.6rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.page-heading h1 {
  margin-top: 18px;
  font-size: clamp(2.4rem, 5vw, 4.7rem);
  line-height: 0.96;
  letter-spacing: -0.08em;
  text-transform: uppercase;
}

.page-heading h1 i {
  color: var(--accent-orange);
  font-style: normal;
}

.turn-status {
  max-width: 360px;
  margin: 22px auto 0;
  text-align: left;
  min-width: 270px;
  padding: 14px 18px;
  border: 1px solid rgba(246, 128, 72, 0.6);
  background: linear-gradient(135deg, rgba(41, 23, 16, 0.92), rgba(17, 20, 22, 0.9));
  box-shadow: var(--shadow-glow-orange);
}

.turn-status.active {
  border-color: rgba(84, 196, 255, 0.5);
  background: linear-gradient(135deg, rgba(18, 31, 40, 0.95), rgba(14, 19, 25, 0.9));
  box-shadow: var(--shadow-glow-blue);
}

.turn-status strong,
.turn-status small {
  display: block;
}

.turn-status strong {
  font-size: 0.76rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.turn-status small {
  margin-top: 8px;
  color: var(--text-muted);
  font-size: 0.58rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.status-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  margin-right: 8px;
  border-radius: 50%;
  background: var(--accent-orange);
  box-shadow: 0 0 12px rgba(246, 128, 72, 0.8);
}

.turn-status.active .status-dot {
  background: var(--accent-blue);
  box-shadow: 0 0 12px rgba(84, 196, 255, 0.8);
}

.construction-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(220px, 0.62fr);
  align-items: start;
  gap: 18px;
  padding-bottom: 72px;
}

.builds-column {
  display: contents;
}

.build-panel {
  min-width: 0;
  padding: 16px;
  background: rgba(17, 20, 24, 0.88);
  border: 1px solid rgba(160, 174, 175, 0.18);
  box-shadow: var(--shadow-dark);
}

.build-panel.player-one {
  border-color: rgba(246, 128, 72, 0.35);
  background: #353033;
}

.build-panel.player-two {
  border-color: rgba(84, 196, 255, 0.35);
  background: #30363b;
}

.build-panel.is-active {
  border-color: rgba(241, 212, 141, 0.8);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35);
}

.build-header {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 14px;
}

.build-header .eyebrow {
  margin-bottom: 7px;
}

.build-header h2,
.build-header h3 {
  margin: 0;
  font-size: clamp(1.35rem, 2vw, 2rem);
  letter-spacing: -0.06em;
  text-transform: uppercase;
}

.build-count {
  color: var(--accent-gold);
  font-family: 'Syne', 'Segoe UI', sans-serif;
  font-size: clamp(1.7rem, 2vw, 2.3rem);
  font-weight: 700;
}

.build-count small {
  color: var(--text-muted);
  font-size: 0.6rem;
  letter-spacing: 0.08em;
}

.category-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 7px;
}

.category-slot {
  display: flex;
  min-width: 0;
  min-height: 76px;
  flex-direction: column;
  align-items: stretch;
  justify-content: space-between;
  padding: 8px;
  border: 1px solid rgba(150, 170, 167, 0.18);
  background: rgba(11, 14, 18, 0.78);
  color: var(--text-muted);
  text-align: left;
  transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
}

.category-slot.selectable {
  border-color: rgba(241, 212, 141, 0.32);
  background: rgba(32, 28, 19, 0.72);
}

.category-slot.selectable:hover,
.category-slot.selectable:focus-visible {
  transform: translateY(-1px);
  border-color: rgba(241, 212, 141, 0.8);
  box-shadow: 0 0 0 1px rgba(241, 212, 141, 0.15);
}

.category-slot.filled {
  display: grid;
  grid-template-columns: 46px minmax(0, 1fr);
  column-gap: 8px;
  row-gap: 6px;
  padding: 8px 7px 7px;
  background: rgba(27, 18, 17, 0.9);
  border-color: rgba(246, 128, 72, 0.38);
}

.player-two .category-slot.filled {
  background: rgba(15, 24, 34, 0.92);
  border-color: rgba(84, 196, 255, 0.38);
}

.slot-label,
.slot-card-name,
.slot-state,
.slot-empty {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.slot-label {
  color: var(--accent-gold);
  font-size: 0.54rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.category-slot.filled .slot-label {
  grid-column: 1 / -1;
}

.slot-card-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 46px;
  height: 66px;
  min-width: 46px;
  overflow: hidden;
  border: 1px solid rgba(246, 128, 72, 0.4);
  background: rgba(8, 12, 16, 0.8);
}

.player-two .slot-card-preview {
  border-color: rgba(84, 196, 255, 0.45);
}

.slot-card-preview img,
.slot-card-fallback {
  display: block;
  width: calc(100% - 6px);
  height: calc(100% - 2px);
  object-fit: cover;
  margin: 0;
}

.slot-card-fallback {
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, rgba(50, 31, 20, 0.8), rgba(17, 20, 24, 0.8));
  color: var(--accent-gold);
  font-family: 'Syne', 'Segoe UI', sans-serif;
  font-size: 1rem;
  font-weight: 700;
}

.player-two .slot-card-fallback {
  background: linear-gradient(135deg, rgba(15, 39, 48, 0.8), rgba(17, 20, 24, 0.8));
  color: var(--accent-cyan);
}

.slot-card-details {
  display: flex;
  min-width: 0;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
}

.slot-card-name {
  color: var(--text-main);
  font-size: 0.6rem;
  line-height: 1.3;
}

.slot-state,
.slot-empty {
  font-size: 0.54rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.slot-empty {
  color: var(--text-muted);
}

.slot-state {
  color: var(--accent-gold);
}

.player-two .slot-state {
  color: var(--accent-cyan);
}

.draw-panel {
  position: sticky;
  grid-column: 3;
  top: 16px;
  padding: 18px 18px 16px;
  border: 1px solid rgba(241, 212, 141, 0.5);
  background: linear-gradient(180deg, rgba(30, 27, 20, 0.95), rgba(14, 18, 22, 0.9));
  box-shadow: var(--shadow-dark);
}

.draw-panel .eyebrow {
  margin: 0;
}

.draw-panel h2 {
  margin: 12px 0 16px;
  font-size: 1.6rem;
  letter-spacing: -0.05em;
  text-transform: uppercase;
}

.drawn-card,
.draw-placeholder {
  margin-bottom: 16px;
}

.drawn-card {
  max-width: 246px;
  margin-inline: auto;
}

.draw-placeholder {
  display: grid;
  place-items: center;
  min-height: 230px;
  border: 1px dashed rgba(241, 212, 141, 0.5);
  background: rgba(17, 20, 24, 0.7);
  color: var(--accent-gold);
}

.draw-placeholder span {
  font-family: 'Syne', 'Segoe UI', sans-serif;
  font-size: 3.8rem;
  font-weight: 800;
}

.draw-placeholder small {
  display: block;
  color: var(--text-muted);
  font-size: 0.58rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.draw-actions {
  display: grid;
  gap: 10px;
}

.draw-button,
.back-button,
.primary-button,
.secondary-button,
.combat-actions button {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  min-height: 48px;
  padding: 0.9rem 1rem;
  border: 1px solid transparent;
  color: #181a1b;
  background: linear-gradient(135deg, var(--accent-gold), var(--accent-orange));
  font-size: 0.64rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.draw-button:hover:not(:disabled),
.back-button:hover:not(:disabled),
.primary-button:hover,
.secondary-button:hover,
.combat-actions button:hover {
  transform: translateY(-1px);
}

.draw-button:disabled,
.back-button:disabled {
  opacity: 0.42;
}

.back-button,
.secondary-button {
  color: var(--text-main);
  background: rgba(14, 18, 22, 0.7);
  border-color: rgba(157, 173, 170, 0.24);
}

.draw-button span,
.back-button span,
.primary-button span,
.secondary-button span,
.combat-actions button span {
  font-size: 1.15rem;
}

.draw-hint {
  margin-top: 12px;
  color: var(--text-muted);
  font-size: 0.58rem;
  line-height: 1.6;
  min-height: 36px;
}

.loading-message,
.error-message {
  font-size: 0.7rem;
  line-height: 1.7;
}

.error-message {
  color: var(--accent-red);
}

.combat-panel,
.result-panel {
  max-width: 1100px;
  padding: 32px 0 84px;
}

.combat-intro p,
.result-panel > p {
  max-width: 600px;
  color: var(--text-muted);
  font-size: 0.7rem;
  line-height: 1.8;
}

.combat-intro h2,
.result-panel h2 {
  margin: 18px 0 10px;
  font-size: clamp(2.1rem, 4vw, 4rem);
  line-height: 0.96;
  letter-spacing: -0.08em;
  text-transform: uppercase;
}

.combat-actions {
  display: flex;
  gap: 12px;
  margin: 28px 0 30px;
}

.combat-actions button {
  flex: 1;
  text-align: left;
  color: var(--text-main);
  background: linear-gradient(135deg, rgba(47, 22, 17, 0.9), rgba(18, 20, 23, 0.9));
  border-color: rgba(246, 128, 72, 0.56);
  box-shadow: var(--shadow-glow-orange);
}

.combat-actions button + button {
  background: linear-gradient(135deg, rgba(12, 32, 38, 0.92), rgba(18, 20, 23, 0.92));
  border-color: rgba(84, 196, 255, 0.56);
  box-shadow: var(--shadow-glow-blue);
}

.combat-builds,
.result-builds {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.result-builds article {
  padding: 18px 16px;
  border: 1px solid var(--border-light);
  background: rgba(15, 20, 27, 0.88);
}

.result-builds h3 {
  margin-bottom: 12px;
  font-size: 1.35rem;
  letter-spacing: -0.05em;
  text-transform: uppercase;
}

.result-builds div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 0;
  border-top: 1px solid rgba(160, 174, 175, 0.18);
  font-size: 0.58rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.result-builds strong {
  color: var(--accent-gold);
  text-align: right;
}

.result-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 26px;
}

.result-actions .primary-button,
.result-actions .secondary-button {
  width: auto;
  min-width: 180px;
}

@media (max-width: 960px) {
  .game-nav {
    padding-inline: max(20px, calc((100vw - 1360px) / 2)) !important;
  }

  .game-nav-links {
    gap: 4px;
  }

  .game-nav-tab {
    padding-inline: 0.75rem;
  }
}

@media (max-width: 680px) {
  .construction-layout {
    grid-template-columns: 1fr;
  }

  .builds-column {
    display: grid;
    gap: 14px;
  }

  .draw-panel {
    position: static;
    grid-column: auto;
  }

  .combat-builds,
  .result-builds {
    grid-template-columns: 1fr;
  }

  .page-heading {
    display: block;
    padding-top: 38px;
  }

  .turn-status {
    margin-top: 22px;
  }

  .category-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .draw-panel {
    padding: 16px;
  }

  .combat-actions {
    display: grid;
  }
}

@media (max-width: 480px) {
  .game-shell > * {
    padding-inline: 14px;
  }

  .game-nav .brand-logo {
    height: 40px;
  }

  .category-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .result-actions {
    display: grid;
  }
}
</style>
