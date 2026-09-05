<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import SocialHeader from '../components/SocialHeader.vue'
import { CATEGORY_DEFINITIONS, type CategorySlug, type PlayerBuild } from '../game/gameEngine'
import { fetchAllCards } from '../services/cardApi'
import { simulateFight } from '../services/gameApi'
import type { Card } from '../types/card'
import type { CombatResult } from '../types/combat'

const cards = ref<Card[]>([])
const loading = ref(true)
const error = ref('')
const result = ref<CombatResult | null>(null)
const search = ref('')
const playerCount = ref<2 | 3>(2)
const activeSelection = ref<{ playerId: 1 | 2 | 3; category: CategorySlug } | null>(null)
const modalQuery = ref('')

function emptySlots(): Record<CategorySlug, Card | null> {
  return Object.fromEntries(CATEGORY_DEFINITIONS.map(([, slug]) => [slug, null])) as Record<CategorySlug, Card | null>
}

const buildOne = ref<PlayerBuild>({ playerId: 1, slots: emptySlots() })
const buildTwo = ref<PlayerBuild>({ playerId: 2, slots: emptySlots() })
const buildThree = ref<PlayerBuild>({ playerId: 3, slots: emptySlots() })

const selectedBuilds = computed(() => {
  if (playerCount.value === 3) return [buildOne.value, buildTwo.value, buildThree.value]
  return [buildOne.value, buildTwo.value]
})

const currentCandidates = computed(() => {
  const query = modalQuery.value.trim().toLowerCase()
  return cards.value.filter((card) => {
    const passesQuery = !query || card.name.toLowerCase().includes(query)
    return passesQuery
  })
})

const simulatorReady = computed(() => {
  if (playerCount.value === 3) return false
  return CATEGORY_DEFINITIONS.every(([, slug]) => buildOne.value.slots[slug] && buildTwo.value.slots[slug])
})

onMounted(async () => {
  try {
    cards.value = await fetchAllCards()
  } catch (exception) {
    error.value = exception instanceof Error ? exception.message : 'Impossible de charger les cartes.'
  } finally {
    loading.value = false
  }
})

function slotLabel(slug: CategorySlug) {
  return CATEGORY_DEFINITIONS.find(([, candidate]) => candidate === slug)?.[0] ?? slug
}

function openSelection(playerId: 1 | 2 | 3, category: CategorySlug) {
  activeSelection.value = { playerId, category }
  modalQuery.value = ''
}

function assignCard(card: Card) {
  if (!activeSelection.value) return
  const target = selectedBuilds.value.find((build) => build.playerId === activeSelection.value?.playerId)
  if (!target) return
  target.slots[activeSelection.value.category] = card
  activeSelection.value = null
  modalQuery.value = ''
}

function clearSlot(playerId: 1 | 2 | 3, category: CategorySlug) {
  const target = selectedBuilds.value.find((build) => build.playerId === playerId)
  if (!target) return
  target.slots[category] = null
}

function compositionFor(build: PlayerBuild) {
  return {
    slots: Object.fromEntries(
      CATEGORY_DEFINITIONS.map(([, slug]) => [slug, build.slots[slug]?.slug ?? '']),
    ),
  }
}

async function runSimulation() {
  if (!simulatorReady.value) return
  try {
    result.value = await simulateFight(compositionFor(buildOne.value), compositionFor(buildTwo.value))
    error.value = ''
  } catch (exception) {
    error.value = exception instanceof Error ? exception.message : 'La simulation a échoué.'
  }
}

function replay() {
  buildOne.value = { playerId: 1, slots: emptySlots() }
  buildTwo.value = { playerId: 2, slots: emptySlots() }
  buildThree.value = { playerId: 3, slots: emptySlots() }
  result.value = null
  error.value = ''
}
</script>

<template>
  <main class="simulation-page">
    <SocialHeader />
    <section class="page-shell">
      <header class="page-header">
        <div>
          <p class="eyebrow">Simulation</p>
          <h1>Arène de combat</h1>
        </div>
        <div class="mode-toggle" aria-label="Mode de simulation">
          <button type="button" :class="{ active: playerCount === 2 }" @click="playerCount = 2">1v1</button>
          <button type="button" :class="{ active: playerCount === 3 }" @click="playerCount = 3" :disabled="true">1v1v1 · non supporté</button>
        </div>
      </header>

      <p v-if="loading" class="state-message">Chargement des cartes...</p>
      <p v-else-if="error" class="error-message">{{ error }}</p>

      <template v-else>
        <div class="builds-grid">
          <article v-for="build in selectedBuilds" :key="build.playerId" class="build-panel">
            <header class="build-header">
              <div>
                <p class="eyebrow">Joueur {{ build.playerId }}</p>
                <h2>{{ build.playerId === 1 ? 'Joueur 1' : build.playerId === 2 ? 'Joueur 2' : 'Joueur 3' }}</h2>
              </div>
              <span class="slot-counter">
                {{ CATEGORY_DEFINITIONS.filter(([, slug]) => build.slots[slug]).length }} / {{ CATEGORY_DEFINITIONS.length }}
              </span>
            </header>

            <div class="category-grid">
              <button
                v-for="[label, slug] in CATEGORY_DEFINITIONS"
                :key="`${build.playerId}-${slug}`"
                type="button"
                class="category-slot"
                :class="{ filled: !!build.slots[slug] }"
                @click="openSelection(build.playerId as 1 | 2 | 3, slug)"
              >
                <span class="slot-label">{{ label }}</span>
                <template v-if="build.slots[slug]">
                  <img v-if="build.slots[slug]?.imageUrl" :src="build.slots[slug]?.imageUrl ?? undefined" :alt="build.slots[slug]?.name" loading="lazy" />
                  <span v-else class="slot-fallback">{{ build.slots[slug]?.name.slice(0, 1) }}</span>
                  <strong>{{ build.slots[slug]?.name }}</strong>
                  <div class="slot-actions">
                    <span>Remplacer</span>
                    <span @click.stop="clearSlot(build.playerId as 1 | 2 | 3, slug)">Supprimer</span>
                  </div>
                </template>
                <template v-else>
                  <span class="slot-empty">Choisir une carte</span>
                </template>
              </button>
            </div>
          </article>
        </div>

        <div class="simulator-actions">
          <button type="button" class="primary-button" :disabled="!simulatorReady" @click="runSimulation">Simuler le combat</button>
          <button type="button" class="secondary-button" @click="replay">Réinitialiser</button>
        </div>

        <section v-if="result" class="result-panel">
          <p class="eyebrow">Résultat</p>
          <h2>
            {{ result.winner === 'draw' ? 'Égalité' : `Vainqueur : Joueur ${result.winner === 'player1' ? 1 : 2}` }}
          </h2>
          <div class="scoreboard">
            <article>
              <h3>Joueur 1</h3>
              <strong>{{ result.player1.total }}</strong>
              <span>{{ result.player1.validationErrors.length ? 'Erreurs de validation' : 'Total' }}</span>
            </article>
            <div class="versus">VS</div>
            <article>
              <h3>Joueur 2</h3>
              <strong>{{ result.player2.total }}</strong>
              <span>{{ result.player2.validationErrors.length ? 'Erreurs de validation' : 'Total' }}</span>
            </article>
          </div>

          <div v-if="result.player1.appliedRules.length || result.player2.appliedRules.length" class="rules-list">
            <h3>Règles appliquées</h3>
            <ul>
              <li v-for="rule in [...result.player1.appliedRules, ...result.player2.appliedRules]" :key="`${rule.ruleId}-${rule.target}-${rule.after}`">
                {{ rule.label }} · {{ rule.target }} : {{ rule.before }} → {{ rule.after }}
              </li>
            </ul>
          </div>
        </section>
      </template>
    </section>

    <div v-if="activeSelection" class="selection-modal" role="dialog" aria-modal="true">
      <div class="selection-panel">
        <header>
          <div>
            <p class="eyebrow">Choisir une carte</p>
            <h3>{{ activeSelection.playerId === 1 ? 'Joueur 1' : 'Joueur 2' }} · {{ slotLabel(activeSelection.category) }}</h3>
          </div>
          <button type="button" class="close-button" @click="activeSelection = null">Fermer</button>
        </header>

        <input v-model="modalQuery" class="search-input" type="search" placeholder="Rechercher une carte" />

        <div class="candidate-list">
          <button
            v-for="card in currentCandidates"
            :key="card.id"
            type="button"
            class="candidate-card"
            @click="assignCard(card)"
          >
            <img v-if="card.imageUrl" :src="card.imageUrl" :alt="card.name" />
            <span class="candidate-name">{{ card.name }}</span>
            <small>{{ card.effectiveRarity }}</small>
          </button>
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
.simulation-page {
  min-height: 100vh;
  background: var(--bg-main);
  color: var(--text-main);
}
.page-shell {
  max-width: 1300px;
  margin: 0 auto;
  padding: 36px 20px 80px;
}
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
}
.page-header h1 {
  margin: 8px 0 0;
  font-size: clamp(2rem, 4vw, 3.5rem);
  text-transform: uppercase;
}
.mode-toggle {
  display: inline-flex;
  border: 1px solid var(--border-light);
  background: var(--bg-panel);
}
.mode-toggle button {
  min-height: 42px;
  padding: 0 14px;
  border: 0;
  background: transparent;
  color: var(--text-muted);
  font-weight: 700;
}
.mode-toggle button.active {
  background: var(--accent-orange);
  color: #1a120d;
}
.builds-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
  gap: 18px;
}
.build-panel {
  background: var(--bg-panel);
  border: 1px solid var(--border-light);
  padding: 18px;
}
.build-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
}
.slot-counter {
  font-size: 0.75rem;
  color: var(--text-muted);
}
.category-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.category-slot {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 172px;
  padding: 12px 10px;
  border: 1px solid var(--border-light);
  background: rgba(255, 255, 255, 0.02);
  color: var(--text-main);
  text-align: center;
}
.category-slot.filled {
  border-color: rgba(255, 166, 77, 0.7);
}
.category-slot img {
  width: 54px;
  height: 54px;
  object-fit: cover;
  border-radius: 8px;
}
.slot-fallback {
  width: 54px;
  height: 54px;
  display: grid;
  place-items: center;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.08);
  font-weight: 700;
}
.slot-label {
  color: var(--accent-gold);
  font-size: 0.7rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.slot-empty {
  color: var(--text-muted);
}
.slot-actions {
  display: flex;
  gap: 8px;
  font-size: 0.68rem;
  color: var(--text-muted);
}
.slot-actions span:last-child {
  color: #ff9b9b;
}
.simulator-actions {
  display: flex;
  gap: 12px;
  margin-top: 24px;
  flex-wrap: wrap;
}
.primary-button,
.secondary-button,
.close-button {
  min-height: 44px;
  padding: 0 16px;
  border: 1px solid var(--border-strong);
  font-weight: 700;
}
.primary-button {
  background: var(--accent-orange);
  color: #1a120d;
}
.secondary-button,
.close-button {
  background: transparent;
  color: var(--text-main);
}
.result-panel {
  margin-top: 28px;
  padding: 22px;
  border: 1px solid var(--border-light);
  background: linear-gradient(180deg, rgba(24, 30, 36, 0.96), rgba(17, 20, 24, 0.96));
}
.scoreboard {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  gap: 18px;
  align-items: center;
  margin-top: 18px;
}
.scoreboard article {
  display: grid;
  gap: 6px;
  padding: 18px;
  border: 1px solid var(--border-light);
  background: rgba(255, 255, 255, 0.02);
}
.scoreboard strong {
  font-size: clamp(2rem, 4vw, 3.5rem);
}
.versus {
  font-weight: 900;
  letter-spacing: 0.2em;
  color: var(--accent-gold);
}
.rules-list {
  margin-top: 24px;
}
.rules-list ul {
  margin: 12px 0 0;
  padding-left: 18px;
  color: var(--text-muted);
}
.state-message {
  color: var(--accent-gold);
}
.error-message {
  color: #ffbaba;
}
.selection-modal {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  display: grid;
  place-items: center;
  padding: 20px;
}
.selection-panel {
  width: min(900px, 100%);
  max-height: 80vh;
  overflow: auto;
  background: var(--bg-panel);
  border: 1px solid var(--border-light);
  padding: 18px;
}
.selection-panel header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}
.search-input {
  width: 100%;
  min-height: 42px;
  margin-bottom: 12px;
  padding: 0 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--border-light);
  color: var(--text-main);
}
.candidate-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 10px;
}
.candidate-card {
  display: grid;
  justify-items: center;
  gap: 6px;
  padding: 12px 10px;
  border: 1px solid var(--border-light);
  background: rgba(255, 255, 255, 0.02);
  color: var(--text-main);
}
.candidate-card img {
  width: 60px;
  height: 60px;
  object-fit: cover;
  border-radius: 8px;
}
.candidate-name {
  font-weight: 700;
  text-align: center;
}
@media (max-width: 720px) {
  .page-header,
  .selection-panel header {
    flex-direction: column;
    align-items: stretch;
  }
  .category-grid {
    grid-template-columns: 1fr;
  }
  .scoreboard {
    grid-template-columns: 1fr;
  }
}
</style>
