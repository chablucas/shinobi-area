<script setup lang="ts">
import { computed, ref } from 'vue'
import CategorySelector from '../components/CategorySelector.vue'
import GameCard from '../components/GameCard.vue'
import RoundResult from '../components/RoundResult.vue'
import { fetchAllCards } from '../services/cardApi'
import { categoriesFor, compareRound, createPlayers, getRoundCards, type Player, type Round } from '../game/gameEngine'
import type { Card, Category } from '../types/card'

type Phase = 'setup' | 'playing' | 'finished'

const phase = ref<Phase>('setup')
const playerCount = ref(2)
const players = ref<Player[]>([])
const round = ref<Round | null>(null)
const selectedCategory = ref<Category | null>(null)
const winnerIds = ref<number[]>([])
const winningValue = ref<number | null>(null)
const loading = ref(false)
const errorMessage = ref('')
const totalRounds = ref(0)

const activePlayer = computed(() => players.value.find((player) => player.id === round.value?.activePlayerId) ?? null)
const roundCards = computed(() => round.value ? getRoundCards(players.value) : [])
const activeCard = computed(() => activePlayer.value?.deck[0] ?? null)
const battleCards = computed(() => players.value.flatMap((player) => player.deck[0] ? [{ player, card: player.deck[0] }] : []))
const activeCategories = computed(() => activeCard.value ? categoriesFor(activeCard.value) : [])
const isRevealed = computed(() => Boolean(selectedCategory.value))
const maxRounds = computed(() => totalRounds.value)
const isLastRound = computed(() => round.value?.number === maxRounds.value)
const resultMessage = computed(() => {
  if (winnerIds.value.length === 0) return 'Tour nul'
  if (winnerIds.value.length > 1) return 'Égalité parfaite'
  const winnerIndex = winnerIds.value[0]
  return `${winnerIndex === undefined ? 'Personne' : players.value[winnerIndex]?.name} remporte le tour`
})
const resultDetail = computed(() => winningValue.value === null ? 'Aucune carte ne possède de valeur pour cette catégorie.' : `La meilleure valeur est ${winningValue.value}.`)
const gameWinner = computed(() => {
  const highestScore = Math.max(...players.value.map((player) => player.score))
  const leaders = players.value.filter((player) => player.score === highestScore)
  return leaders.length === 1 ? leaders[0] : null
})
const isFinalTie = computed(() => {
  if (!players.value.length) return false
  const highestScore = Math.max(...players.value.map((player) => player.score))
  return players.value.filter((player) => player.score === highestScore).length > 1
})

async function startGame() {
  loading.value = true
  errorMessage.value = ''
  try {
    const cards = await fetchAllCards()
    if (cards.length < playerCount.value) throw new Error('Il n’y a pas assez de cartes pour lancer la partie.')
    players.value = createPlayers(cards, playerCount.value)
    totalRounds.value = players.value[0]?.deck.length ?? 0
    beginRound(1)
    phase.value = 'playing'
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'La partie ne peut pas démarrer.'
  } finally {
    loading.value = false
  }
}

function beginRound(number: number) {
  const activePlayerId = (number - 1) % playerCount.value
  round.value = { number, activePlayerId, cards: getRoundCards(players.value), category: null }
  selectedCategory.value = null
  winnerIds.value = []
  winningValue.value = null
}

function chooseCategory(category: Category) {
  if (selectedCategory.value || !round.value) return
  selectedCategory.value = category
  round.value.category = category
  const outcome = compareRound(roundCards.value, category)
  winnerIds.value = outcome.winnerIds
  winningValue.value = outcome.winningValue
  const winnerIndex = outcome.winnerIds[0]
  if (winnerIndex !== undefined && outcome.winnerIds.length === 1 && players.value[winnerIndex]) players.value[winnerIndex].score += 1
}

function nextRound() {
  if (!selectedCategory.value || !round.value) return
  players.value.forEach((player) => player.deck.shift())
  if (isLastRound.value) {
    phase.value = 'finished'
    return
  }
  beginRound(round.value.number + 1)
}

function replay() {
  phase.value = 'setup'
  players.value = []
  round.value = null
  totalRounds.value = 0
}
</script>

<template>
  <main class="game-shell">
    <nav class="game-nav">
      <a class="brand" href="/"><span class="brand-mark"><i></i><i></i><i></i></span><span>Shinobi <em>Area</em></span></a>
      <a class="back-link" href="/">Retour accueil <span>↗</span></a>
    </nav>

    <section v-if="phase === 'setup'" class="setup-panel">
      <p class="eyebrow">Mode local · même appareil</p>
      <h1>La partie<br /><i>commence ici.</i></h1>
      <p class="intro">Mélange le catalogue, distribue une carte unique à chaque shinobi et prends le dessus catégorie après catégorie.</p>
      <div class="player-choice" role="radiogroup" aria-label="Nombre de joueurs">
        <button v-for="count in [2, 3]" :key="count" type="button" :class="{ selected: playerCount === count }" @click="playerCount = count">
          <strong>{{ count }}</strong><span>joueurs</span><i>{{ count === 2 ? 'Duel' : 'Escouade' }}</i>
        </button>
      </div>
      <button class="primary-button" type="button" :disabled="loading" @click="startGame">{{ loading ? 'Chargement des cartes...' : 'Commencer la partie' }} <span>→</span></button>
      <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>
    </section>

    <section v-else-if="phase === 'playing' && round && activePlayer" class="playing-panel">
      <header class="game-header"><div><p class="eyebrow">Partie locale</p><h1>Tour {{ round.number }} <span>/ {{ maxRounds }}</span></h1></div><div class="scoreboard"><div v-for="player in players" :key="player.id" :class="{ active: player.id === activePlayer.id }"><span>{{ player.name }}</span><strong>{{ player.score }}</strong></div></div></header>
      <div class="turn-banner"><span class="pulse"></span><strong>{{ activePlayer.name }}</strong> choisit une catégorie</div>
      <div class="battle-grid">
        <div v-for="entry in battleCards" :key="entry.card.id" class="player-column"><p class="player-label">{{ entry.player.name }} <span v-if="entry.player.id === activePlayer.id">· actif</span></p><GameCard :card="entry.card" :revealed="isRevealed" :active="entry.player.id === activePlayer.id" /><div v-if="isRevealed && selectedCategory" class="value-readout"><span>{{ selectedCategory.label }}</span><strong>{{ entry.card.stats[selectedCategory.slug] ?? '—' }}</strong></div></div>
      </div>
      <div class="choice-area"><div v-if="!isRevealed"><p class="choice-title">Choisis ta catégorie</p><CategorySelector :categories="activeCategories" :selected="selectedCategory" @select="chooseCategory" /></div><div v-else><RoundResult :message="resultMessage" :detail="resultDetail" /><button class="primary-button next-button" type="button" @click="nextRound">{{ isLastRound ? 'Voir le résultat' : 'Tour suivant' }} <span>→</span></button></div></div>
    </section>

    <section v-else class="finish-panel">
      <p class="eyebrow">Partie terminée</p><h1>{{ gameWinner ? `${gameWinner.name} gagne.` : 'Égalité.' }}</h1><p class="intro">{{ isFinalTie ? 'Les shinobi terminent avec le même score.' : 'Chaque point a compté. La légende est écrite.' }}</p>
      <div class="final-scores"><div v-for="player in players" :key="player.id"><span>{{ player.name }}</span><strong>{{ player.score }} <small>pt{{ player.score > 1 ? 's' : '' }}</small></strong></div></div>
      <div class="finish-actions"><button class="primary-button" type="button" @click="replay">Rejouer <span>↻</span></button><a class="secondary-button" href="/">Retour accueil <span>↗</span></a></div>
    </section>
  </main>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Syne:wght@400;600;700;800&display=swap');
:root { font-family: 'DM Mono', monospace; color: #f2eee7; background: #111312; font-synthesis: none; } * { box-sizing: border-box; } body { margin: 0; min-width: 320px; } button, a { font: inherit; } button { cursor: pointer; } a { color: inherit; text-decoration: none; }
.game-shell { min-height: 100vh; background: radial-gradient(circle at 80% 15%, #382821 0, #111312 38%); padding: 0 max(24px, calc((100vw - 1240px) / 2)); } .game-nav { height: 92px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #303430; } .brand { display: flex; align-items: center; gap: 12px; font: 700 17px 'Syne', sans-serif; } .brand em { color: #ee7860; font-style: normal; } .brand-mark { width: 29px; height: 29px; display: flex; gap: 3px; align-items: center; justify-content: center; border: 1px solid #ee7860; transform: rotate(45deg); } .brand-mark i { width: 2px; height: 15px; display: block; background: #ee7860; transform: skew(-22deg); } .brand-mark i:nth-child(2) { height: 20px; background: #e7c57e; } .back-link { color: #9da49d; font-size: 11px; } .back-link span { color: #e7c57e; margin-left: 8px; }
.setup-panel, .finish-panel { max-width: 700px; padding: 100px 0 120px; } .eyebrow, .kicker { color: #e7c57e; font-size: 10px; letter-spacing: .13em; text-transform: uppercase; } h1, h2, h3 { font-family: 'Syne', sans-serif; } h1 { font-size: clamp(46px, 7vw, 84px); line-height: .95; letter-spacing: -.07em; margin: 28px 0; } h1 i { color: #ee7860; font-style: normal; } .intro { max-width: 500px; color: #a4aaa3; font-size: 12px; line-height: 1.8; }
.player-choice { display: flex; gap: 12px; margin: 42px 0 22px; } .player-choice button { width: 160px; min-height: 130px; padding: 18px; text-align: left; color: #929890; background: #202421; border: 1px solid #383e39; } .player-choice button.selected { color: #f2eee7; border-color: #e7c57e; background: #302c20; } .player-choice strong { display: block; color: #e7c57e; font: 700 40px 'Syne', sans-serif; } .player-choice i { display: block; margin-top: 18px; color: #ee7860; font-size: 10px; font-style: normal; text-transform: uppercase; } .primary-button, .secondary-button { display: inline-flex; align-items: center; gap: 28px; padding: 16px 19px; border: 0; color: #191a17; background: #e7c57e; font-size: 11px; text-decoration: none; } .primary-button span, .secondary-button span { font-size: 18px; } .primary-button:disabled { opacity: .6; cursor: wait; } .secondary-button { color: #e4e7df; background: transparent; border: 1px solid #4a504b; } .error-message { color: #ee7860; font-size: 11px; }
.playing-panel { padding: 58px 0 90px; } .game-header { display: flex; align-items: end; justify-content: space-between; gap: 30px; } .game-header h1 { margin: 18px 0 0; font-size: clamp(40px, 6vw, 68px); } .game-header h1 span { color: #656c65; font-size: .4em; letter-spacing: 0; } .scoreboard { display: flex; gap: 8px; } .scoreboard div { min-width: 115px; padding: 13px; color: #929890; border: 1px solid #383e39; } .scoreboard div.active { color: #f2eee7; border-color: #ee7860; } .scoreboard span { display: block; font-size: 9px; text-transform: uppercase; } .scoreboard strong { display: block; margin-top: 8px; color: #e7c57e; font: 700 27px 'Syne', sans-serif; } .turn-banner { margin: 35px 0 22px; color: #c4c9c1; font-size: 12px; } .pulse { display: inline-block; width: 7px; height: 7px; margin-right: 10px; border-radius: 50%; background: #ee7860; box-shadow: 0 0 14px #ee7860; } .turn-banner strong { color: #ee7860; }
.battle-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; } .player-column { min-width: 0; } .player-label { margin: 0 0 10px; color: #a4aaa3; font-size: 10px; text-transform: uppercase; } .player-label span { color: #e7c57e; } .game-card { position: relative; overflow: hidden; border: 1px solid #383e39; background: #202421; } .game-card.is-active { border-color: #e7c57e; } .game-card img, .card-image-fallback, .card-back { display: grid; place-items: center; width: 100%; aspect-ratio: 2 / 3; object-fit: cover; } .card-image-fallback { color: #e7c57e; background: #302421; font: 700 52px 'Syne', sans-serif; } .card-back { color: #e7c57e; background: repeating-linear-gradient(135deg, #302421, #302421 8px, #26201e 8px, #26201e 16px); } .card-back span { font: 72px 'Syne', sans-serif; } .card-back small { margin-top: -35%; font-size: 8px; letter-spacing: .15em; } .game-card-copy { padding: 12px; } .game-card-copy span, .value-readout span { color: #929890; font-size: 9px; text-transform: uppercase; } .game-card-copy h3 { margin: 5px 0 0; font-size: 15px; } .value-readout { display: flex; justify-content: space-between; align-items: center; padding: 12px; border: 1px solid #383e39; border-top: 0; } .value-readout strong { color: #e7c57e; font: 700 20px 'Syne', sans-serif; }
.choice-area { max-width: 760px; margin-top: 28px; } .choice-title { color: #e7c57e; font-size: 11px; text-transform: uppercase; } .category-selector { display: flex; flex-wrap: wrap; gap: 8px; } .category-selector button { display: flex; justify-content: space-between; gap: 24px; min-width: 145px; padding: 12px; color: #d8ddd5; background: #202421; border: 1px solid #383e39; text-transform: capitalize; } .category-selector button:hover, .category-selector button.selected { border-color: #e7c57e; } .category-selector button strong { color: #ee7860; font-size: 9px; text-transform: uppercase; } .round-result { border-left: 2px solid #ee7860; padding: 3px 0 3px 18px; } .round-result .kicker { display: flex; align-items: center; gap: 7px; } .round-result .kicker i { width: 5px; height: 5px; background: #ee7860; border-radius: 50%; } .round-result h2 { margin: 13px 0 4px; font-size: 25px; } .round-result p { margin: 0; color: #929890; font-size: 11px; } .next-button { margin-top: 28px; }
.final-scores { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 44px 0 28px; } .final-scores div { padding: 18px; border: 1px solid #383e39; } .final-scores span { color: #a4aaa3; font-size: 10px; } .final-scores strong { display: block; margin-top: 12px; color: #e7c57e; font: 700 30px 'Syne', sans-serif; } .final-scores small { color: #929890; font: 10px 'DM Mono', monospace; } .finish-actions { display: flex; flex-wrap: wrap; gap: 10px; }
@media (max-width: 760px) { .game-nav { height: 75px; } .setup-panel, .finish-panel { padding-top: 72px; } .game-header { display: block; } .scoreboard { margin-top: 28px; } .scoreboard div { flex: 1; min-width: 0; } .battle-grid { grid-template-columns: repeat(2, 1fr); } .player-column:last-child:nth-child(odd) { grid-column: 1 / -1; max-width: 50%; } }
@media (max-width: 460px) { .game-shell { padding: 0 18px; } h1 { font-size: 48px; } .player-choice button { width: 50%; } .battle-grid { gap: 8px; } .game-card-copy h3 { font-size: 12px; } .category-selector button { min-width: 100%; } .final-scores { grid-template-columns: 1fr; } }
</style>