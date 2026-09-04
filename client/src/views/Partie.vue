<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import GameCard from '../components/GameCard.vue'
import { fetchAllCards } from '../services/cardApi'
import { useAuthStore } from '../stores/auth'
import { saveBuild } from '../services/buildApi'
import { CombatApiError, simulateFight } from '../services/gameApi'
import { getGameLobby, getLobbyGame, SocialApiError, type RealtimeGameState } from '../services/socialApi'
import { connectGameSocket, type GameSocket } from '../services/realtimeApi'
import type { Card } from '../types/card'
import type { CombatResult } from '../types/combat'
import {
  CATEGORY_DEFINITIONS,
  createPlayerBuildsForCount,
  drawRandomCard,
  filledSlotCount,
  getNextPlayerId,
  isBuildComplete,
  placeCard,
  undoPlacement,
  type CategorySlug,
  type LastPlacement,
  type PlayerBuild,
  type PlayerId,
} from '../game/gameEngine'
import { chooseBestCategory } from '../game/ai/categoryEvaluator'
import SocialHeader from '../components/SocialHeader.vue'

type Phase = 'construction' | 'combat' | 'result'
type GameMode = 'solo' | 'local2' | 'local3'

const props = withDefaults(defineProps<{ mode?: GameMode; lobbyId?: string }>(), { mode: 'local2' })
const auth = useAuthStore()

const cards = ref<Card[]>([])
const builds = ref<PlayerBuild[]>(createPlayerBuildsForCount(props.mode === 'local3' ? 3 : 2))
const usedCardIds = ref(new Set<number>())
const pendingCard = ref<Card | null>(null)
const lastPlacement = ref<LastPlacement | null>(null)
const activePlayerId = ref<PlayerId>(1)
const phase = ref<Phase>('construction')
const winnerId = ref<PlayerId | null>(null)
const combatResult = ref<CombatResult | null>(null)
const simulating = ref(false)
const loading = ref(true)
const errorMessage = ref('')
const lobbyAccessError = ref('')
const saved = ref(false)
const gameId = ref(crypto.randomUUID())
const realtimeState = ref<RealtimeGameState | null>(null)
const realtimePlayerNumber = ref<number | null>(null)
const realtimeSocket = ref<GameSocket | null>(null)

const activeBuild = computed(() => builds.value[activePlayerId.value - 1]!)
const availableCardCount = computed(() => cards.value.length - usedCardIds.value.size)
const allBuildsComplete = computed(() => builds.value.every(isBuildComplete))
const winnerName = computed(() => winnerId.value ? `Joueur ${winnerId.value}` : '')
const playerCount = computed<2 | 3>(() => props.mode === 'local3' ? 3 : 2)
const isComputerTurn = computed(() => props.mode === 'solo' && activePlayerId.value === 2)
const combatBlocked = computed(() => Boolean(combatResult.value && (combatResult.value.player1.validationErrors.length || combatResult.value.player2.validationErrors.length)))
const gameStatKeys: Record<string, keyof CombatResult['player1']['finalStats'] | null> = { chakra: 'chakra', invocation: 'invocation', iq: 'iq', ninjutsu: 'ninjutsuAttack', genjutsu: 'genjutsu', taijutsu: 'taijutsu', avatar: 'avatar', body: 'body', fuinjutsu: 'fuinjutsu', senjutsu: 'senjutsu', kenjutsu: 'kenjutsu', clan: null, vitesse: 'speed', 'kekkei-genkai': 'kekkeiGenkai', 'kekkei-mora': null }

onMounted(async () => {
  await auth.loadCurrentUser()
  if (props.lobbyId) {
    if (!auth.token) { lobbyAccessError.value = 'Connecte-toi pour rejoindre ce combat.'; loading.value = false; return }
    try {
      const lobby = await getGameLobby(auth.token, props.lobbyId)
      if (lobby.status !== 'PLAYING') { lobbyAccessError.value = lobby.status === 'READY' ? 'Le combat n’a pas encore commencé.' : 'Le salon attend encore les participants.'; loading.value = false; return }
      realtimeState.value = await getLobbyGame(auth.token, props.lobbyId)
      realtimePlayerNumber.value = realtimeState.value.players.find((player) => player.userId === auth.user?.id)?.playerNumber ?? null
      const socket = connectGameSocket(auth.token)
      realtimeSocket.value = socket
      const join = () => socket.emit('game:join', realtimeState.value?.id ?? '')
      socket.on('connect', join)
      socket.on('game:state', (state) => { realtimeState.value = state })
      socket.on('game:error', (socketError) => { errorMessage.value = socketError.message })
    } catch (error) {
      lobbyAccessError.value = error instanceof SocialApiError
        ? error.status === 404 ? 'Salon introuvable' : error.status === 401 || error.status === 403 ? 'Vous n’avez pas accès à ce combat.' : error.message
        : 'Accès au combat impossible.'
      loading.value = false
      return
    }
  }
  try {
    cards.value = await fetchAllCards()
    if (cards.value.length < 30) errorMessage.value = 'Il faut au moins 30 cartes pour commencer une partie.'
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Impossible de charger les cartes.'
  } finally {
    loading.value = false
  }
})
onUnmounted(() => { realtimeSocket.value?.disconnect() })

const realtimeCurrentPlayer = computed(() => realtimeState.value?.players.find((player) => player.playerNumber === realtimeState.value?.currentPlayerNumber) ?? null)
const realtimeMyPlayer = computed(() => realtimeState.value?.players.find((player) => player.playerNumber === realtimePlayerNumber.value) ?? null)
const realtimeMyTurn = computed(() => Boolean(realtimeState.value && realtimePlayerNumber.value === realtimeState.value.currentPlayerNumber))
function normalizeRealtimeCategory(value: string) { return value.toLowerCase().replaceAll('-', '').replaceAll('ō', 'o').replaceAll('ū', 'u') }
function realtimeCanPlaceCategory(category: string) {
  const player = realtimeMyPlayer.value
  const pendingCard = player?.pendingCard
  if (!realtimeState.value || !realtimeMyTurn.value || !pendingCard || player.playerNumber !== realtimePlayerNumber.value || player.slots[category]) return false
  return pendingCard.eligibleSlots.some((slot) => normalizeRealtimeCategory(slot) === normalizeRealtimeCategory(category))
}
function realtimeDraw() { if (realtimeState.value && realtimeMyTurn.value) realtimeSocket.value?.emit('game:draw', realtimeState.value.id) }
function realtimePlace(category: string) { if (realtimeState.value && realtimeCanPlaceCategory(category)) realtimeSocket.value?.emit('game:place-card', { gameId: realtimeState.value.id, category }) }

watch([activePlayerId, phase, cards], () => {
  if (isComputerTurn.value && !loading.value) playComputerTurn()
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
  activePlayerId.value = getNextPlayerId(activePlayerId.value, playerCount.value)
}

function playComputerTurn() {
  if (!isComputerTurn.value || phase.value !== 'construction' || pendingCard.value) return
  const card = drawRandomCard(cards.value, usedCardIds.value)
  if (!card) return
  const category = chooseBestCategory(activeBuild.value, card)
  if (!category) return
  usedCardIds.value = new Set(usedCardIds.value).add(card.id)
  builds.value[1] = placeCard(activeBuild.value, category, card)
  lastPlacement.value = { playerId: 2, category, card }
  if (allBuildsComplete.value) phase.value = 'combat'
  else activePlayerId.value = 1
}

function undoLastPlacement() {
  if (phase.value !== 'construction' || !lastPlacement.value || pendingCard.value || (props.mode === 'solo' && lastPlacement.value.playerId === 2)) return
  const placement = lastPlacement.value
  const playerIndex = placement.playerId - 1
  builds.value[playerIndex] = undoPlacement(builds.value[playerIndex]!, placement)
  pendingCard.value = placement.card
  activePlayerId.value = placement.playerId
  lastPlacement.value = null
}

function compositionFor(build: PlayerBuild) {
  return { slots: Object.fromEntries(CATEGORY_DEFINITIONS.map(([, slug]) => [slug, build.slots[slug]?.slug ?? ''])) }
}

function manualResult(): CombatResult {
  const results = builds.value.slice(0, 2).map((build) => {
    const finalStats = Object.fromEntries(Object.keys(gameStatKeys).filter((key) => gameStatKeys[key]).map((key) => [gameStatKeys[key], build.slots[key as CategorySlug]?.stats[gameStatKeys[key]!] ?? 0])) as CombatResult['player1']['finalStats']
    finalStats.clan = 0
    return { baseStats: { ...finalStats }, finalStats, total: Object.entries(finalStats).filter(([key]) => key !== 'clan').reduce((total, [, value]) => total + value, 0), appliedRules: [], permissions: { sharingan: false, rinnegan: false, byakugan: false, tenseigan: false, otsutsuki: false, uzumaki: false }, validationErrors: [] }
  })
  return { resolutionMode: 'manual', winner: 'draw', player1: results[0]!, player2: results[1]!, player1Total: results[0]!.total, player2Total: results[1]!.total }
}

function chooseManualWinner(winner: 'player1' | 'player2' | 'draw') {
  if (phase.value !== 'combat') return
  combatResult.value = { ...manualResult(), winner }
  winnerId.value = winner === 'player1' ? 1 : winner === 'player2' ? 2 : null
  phase.value = 'result'
}

function cardFor(build: PlayerBuild, slug: CategorySlug) { return build.slots[slug] }
function finalValue(player: CombatResult['player1'], slug: CategorySlug) { return slug === 'clan' || slug === 'kekkei-mora' ? null : player.finalStats[gameStatKeys[slug]!] }

async function runSimulation() {
  if (phase.value !== 'combat' || simulating.value || builds.value.length < 2) return
  simulating.value = true
  errorMessage.value = ''
  try {
    combatResult.value = await simulateFight(compositionFor(builds.value[0]!), compositionFor(builds.value[1]!))
    winnerId.value = combatResult.value.winner === 'player1' ? 1 : combatResult.value.winner === 'player2' ? 2 : null
    phase.value = 'result'
    if (props.mode === 'solo' && auth.isAuthenticated && winnerId.value) void auth.recordResult(gameId.value, winnerId.value === 1)
  } catch (error) {
    if (error instanceof CombatApiError && error.result) { combatResult.value = error.result; phase.value = 'result' }
    errorMessage.value = error instanceof Error ? error.message : 'Impossible de simuler le combat.'
  } finally { simulating.value = false }
}

async function saveHumanBuild() {
  if (!auth.token || saved.value) return
  const slots = CATEGORY_DEFINITIONS.map(([_, slug]) => {
    const cardId = builds.value[0]?.slots[slug]?.id
    return typeof cardId === 'number' ? { categorySlug: slug, cardId } : null
  }).filter((slot): slot is { categorySlug: typeof CATEGORY_DEFINITIONS[number][1]; cardId: number } => slot !== null)
  if (slots.length !== CATEGORY_DEFINITIONS.length) return
  try { await saveBuild(auth.token, `Composition ${new Date().toLocaleDateString('fr-FR')}`, slots); saved.value = true } catch (error) { errorMessage.value = error instanceof Error ? error.message : 'Impossible de sauvegarder la composition.' }
}

function replay() {
  builds.value = createPlayerBuildsForCount(playerCount.value)
  usedCardIds.value = new Set()
  pendingCard.value = null
  lastPlacement.value = null
  activePlayerId.value = 1
  winnerId.value = null
  combatResult.value = null
  simulating.value = false
  errorMessage.value = ''
  phase.value = 'construction'
  saved.value = false
  gameId.value = crypto.randomUUID()
}

function slotCard(build: PlayerBuild, slug: CategorySlug) {
  return build.slots[slug]
}
</script>

<template>
  <main class="game-shell">
    <SocialHeader />

    <header class="page-heading">
      <div>
        <p class="eyebrow">{{ props.mode === 'solo' ? 'Solo · joueur contre ordinateur' : props.mode === 'local3' ? 'Local · 3 joueurs' : 'Local · 2 joueurs' }}</p>
        <h1>Fight</h1>
      </div>
      <div v-if="phase === 'construction'" class="turn-status" :class="{ active: !pendingCard }">
        <span class="status-dot"></span>
        <strong>{{ pendingCard ? `Joueur ${activePlayerId} choisit une catégorie` : `Tour du Joueur ${activePlayerId}` }}</strong>
        <small>{{ availableCardCount }} cartes disponibles</small>
      </div>
    </header>

    <p v-if="lobbyAccessError" class="error-message">{{ lobbyAccessError }}</p>
    <template v-else>
    <p v-if="loading" class="loading-message">Chargement des 163 cartes...</p>
    <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>

    <section v-if="props.lobbyId && realtimeState" class="realtime-game">
      <div class="realtime-turn" :class="{ active: realtimeMyTurn }">
        <strong>{{ realtimeMyTurn ? 'À TON TOUR' : `AU TOUR DE JOUEUR ${realtimeState.currentPlayerNumber}` }}</strong>
        <span>Tour {{ realtimeState.turnNumber }}</span>
      </div>
      <div class="realtime-boards">
          <article v-for="player in realtimeState.players" :key="player.playerNumber" class="realtime-board" :class="{ 'is-current': player.playerNumber === realtimeState.currentPlayerNumber }">
          <header><div><p class="eyebrow">Joueur {{ player.playerNumber }}</p><h2>{{ player.userId === auth.user?.id ? 'Toi' : player.displayName }}</h2></div><span>{{ player.cardsRemaining }} cartes</span></header>
          <div class="realtime-slots"><button v-for="[label, category] in CATEGORY_DEFINITIONS" :key="category" type="button" :disabled="!realtimeCanPlaceCategory(category) && !(player.playerNumber === realtimePlayerNumber && player.slots[category] === null && !realtimeMyTurn)" :class="{ filled: !!player.slots[category], selectable: player.playerNumber === realtimePlayerNumber && realtimeCanPlaceCategory(category) && !player.slots[category] }" @click="realtimePlace(category)"><span>{{ label }}</span><template v-if="player.slots[category]"><div class="realtime-slot-art"><img v-if="player.slots[category]?.imageUrl" :src="player.slots[category]?.imageUrl ?? undefined" :alt="`Carte ${player.slots[category]?.name}`" /><span v-else>{{ player.slots[category]?.name.slice(0, 1) }}</span></div><strong>{{ player.slots[category]?.name }}</strong><small v-if="category === 'ninjutsu'">{{ player.slots[category]?.stats.ninjutsuAttack }} / {{ player.slots[category]?.stats.ninjutsuDefense }}</small><small v-else-if="category === 'clan'">{{ player.slots[category]?.clans.join(' · ') || 'Aucun' }}</small><small v-else>{{ player.slots[category]?.stats[category] ?? 'Présente' }}</small></template><small v-else>VIDE</small></button></div>
        </article>
      </div>
      <div class="realtime-draw-zone"><div><p class="eyebrow">Pioche joueur {{ realtimePlayerNumber }}</p><div v-if="realtimeMyPlayer?.pendingCard" class="realtime-drawn-card"><div class="realtime-drawn-card-art"><img v-if="realtimeMyPlayer.pendingCard.imageUrl" :src="realtimeMyPlayer.pendingCard.imageUrl" :alt="`Carte ${realtimeMyPlayer.pendingCard.name}`" /><span v-else>{{ realtimeMyPlayer.pendingCard.name.slice(0, 1) }}</span></div><div class="realtime-drawn-card-copy"><strong>{{ realtimeMyPlayer.pendingCard.name }}</strong><span>Carte piochée</span></div></div><div v-else class="realtime-empty-draw">{{ realtimeMyTurn ? 'PIOCHER' : 'EN ATTENTE' }}</div><button type="button" :disabled="!realtimeMyTurn || !!realtimeMyPlayer?.pendingCard || !realtimeMyPlayer?.cardsRemaining" @click="realtimeDraw">PIOCHER</button></div><p v-if="realtimeCurrentPlayer" class="realtime-current">{{ realtimeMyTurn ? 'Choisis une catégorie pour poser ta carte.' : `Joueur ${realtimeState.currentPlayerNumber} prépare son action.` }}</p></div>
      <section v-if="realtimeState.status === 'FINISHED' && realtimeState.result" class="realtime-result"><h2>Combat terminé</h2><p>Le moteur serveur a calculé le résultat officiel.</p></section>
    </section>

    <template v-if="!props.lobbyId && phase === 'construction'">
      <section class="construction-layout">
        <div class="builds-column">
          <article v-for="build in builds" :key="build.playerId" class="build-panel" :class="{ 'is-active': build.playerId === activePlayerId, 'player-one': build.playerId === 1, 'player-two': build.playerId === 2, 'player-three': build.playerId === 3 }">
            <header class="build-header">
              <div><p class="eyebrow">Composition</p><h2>Joueur {{ build.playerId }}</h2></div>
              <span class="build-count">{{ filledSlotCount(build) }} <small>/ 15</small></span>
            </header>
            <div class="category-grid">
              <button v-for="[label, slug] in CATEGORY_DEFINITIONS" :key="slug" class="category-slot" :class="{ filled: slotCard(build, slug), selectable: build.playerId === activePlayerId && !!pendingCard && !slotCard(build, slug) }" type="button" :disabled="isComputerTurn || build.playerId !== activePlayerId || !pendingCard || !!slotCard(build, slug)" @click="placePendingCard(slug)">
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

    <section v-else-if="!props.lobbyId && phase === 'combat'" class="combat-panel">
      <div class="combat-intro"><p class="eyebrow">Étape suivante</p><h2>Simuler le combat</h2><p>Les deux compositions sont complètes. Le serveur calcule le résultat.</p></div>
      <div class="combat-actions"><button type="button" :disabled="simulating" @click="runSimulation">{{ simulating ? 'Simulation en cours...' : 'Simuler le combat' }} <span>→</span></button><button type="button" :disabled="simulating" @click="chooseManualWinner('player1')">Joueur 1 gagne</button><button type="button" :disabled="simulating" @click="chooseManualWinner('player2')">Joueur 2 gagne</button><button type="button" :disabled="simulating" @click="chooseManualWinner('draw')">Égalité</button></div>
      <div class="combat-builds"><article v-for="build in builds" :key="build.playerId" class="build-panel" :class="{ 'player-one': build.playerId === 1, 'player-two': build.playerId === 2 }"><header class="build-header"><h3>Joueur {{ build.playerId }}</h3><span class="build-count">15 <small>/ 15</small></span></header><div class="category-grid"><div v-for="[label, slug] in CATEGORY_DEFINITIONS" :key="slug" class="category-slot filled"><span class="slot-label">{{ label }}</span><span class="slot-card-preview"><img v-if="slotCard(build, slug)?.imageUrl" :src="slotCard(build, slug)?.imageUrl ?? undefined" :alt="`Miniature de ${slotCard(build, slug)?.name}`" /><span v-else class="slot-card-fallback">{{ slotCard(build, slug)?.name.slice(0, 1) }}</span></span><span class="slot-card-details"><span class="slot-card-name">{{ slotCard(build, slug)?.name }}</span><span class="slot-state">Remplie</span></span></div></div></article></div>
    </section>

    <section v-else-if="!props.lobbyId" class="result-panel">
      <p class="eyebrow">Combat terminé</p>
      <template v-if="combatResult && combatBlocked">
        <h2>Composition invalide</h2>
        <div class="validation-errors"><p v-for="error in [...combatResult.player1.validationErrors, ...combatResult.player2.validationErrors]" :key="error.ruleId + error.message">{{ error.message }}</p></div>
      </template>
      <template v-else-if="combatResult">
        <h2>{{ combatResult.resolutionMode === 'manual' ? (combatResult.winner === 'draw' ? 'Égalité' : `Vainqueur choisi : Joueur ${combatResult.winner === 'player1' ? 1 : 2}`) : (combatResult.winner === 'draw' ? 'Égalité' : `Gagnant : Joueur ${combatResult.winner === 'player1' ? 1 : 2}`) }}</h2>
        <div class="combat-score"><article><h3>Joueur 1</h3><strong>{{ combatResult.player1.total }}</strong><span>Total</span></article><b>VS</b><article><h3>Joueur 2</h3><strong>{{ combatResult.player2.total }}</strong><span>Total</span></article></div>
        <div class="result-builds final-builds"><article v-for="(player, index) in [combatResult.player1, combatResult.player2]" :key="index" class="build-panel" :class="{ 'player-one': index === 0, 'player-two': index === 1 }"><header class="build-header"><h3>Joueur {{ index + 1 }} · Statistiques finales</h3></header><div class="category-grid"><div v-for="[label, slug] in CATEGORY_DEFINITIONS" :key="slug" class="category-slot filled"><span class="slot-label">{{ label }}</span><span class="slot-card-preview"><img v-if="cardFor(builds[index]!, slug)?.imageUrl" :src="cardFor(builds[index]!, slug)?.imageUrl ?? undefined" :alt="`Miniature de ${cardFor(builds[index]!, slug)?.name}`" /><span v-else class="slot-card-fallback">{{ cardFor(builds[index]!, slug)?.name.slice(0, 1) }}</span></span><span class="slot-card-details"><span class="slot-card-name">{{ cardFor(builds[index]!, slug)?.name }}</span><span v-if="slug === 'ninjutsu'" class="final-stat-pair">ATQ {{ player.finalStats.ninjutsuAttack }} · DEF {{ player.finalStats.ninjutsuDefense }}</span><span v-else-if="slug === 'clan'" class="final-stat-pair">{{ cardFor(builds[index]!, slug)?.name }}</span><span v-else-if="slug === 'kekkei-mora'" class="final-stat-pair">Carte sélectionnée</span><span v-else class="final-stat-value">{{ finalValue(player, slug) }}</span></span></div></div><h4>Règles appliquées</h4><p v-for="rule in player.appliedRules" :key="rule.ruleId + rule.target + rule.after" class="rule-row">{{ rule.label }} · {{ rule.target }} : {{ rule.before }} → {{ rule.after }}<small>({{ rule.operation }} {{ rule.value }})</small></p></article></div>
      </template>
      <div v-else class="error-message">Aucun résultat de combat disponible.</div>
      <div class="result-actions"><button v-if="auth.isAuthenticated" class="primary-button" type="button" :disabled="saved" @click="saveHumanBuild">{{ saved ? 'Perso sauvegardé' : 'Sauvegarder mon perso' }} <span>↓</span></button><a v-else class="secondary-button" href="/connexion">Connecte-toi pour sauvegarder</a><button class="primary-button" type="button" @click="replay">Rejouer <span>↻</span></button><a class="secondary-button" href="/">Retour à l’accueil <span>↗</span></a></div>
    </section>
    </template>
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

.game-nav .create-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 42px;
  padding: 0.75rem 1.2rem;
  border: 1px solid rgba(76, 48, 15, 0.42);
  background: #fff0bd;
  color: #2b2113;
  clip-path: var(--clip-soft);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-size: 0.64rem;
  font-weight: 700;
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

.build-panel.player-three {
  border-color: rgba(138, 217, 184, 0.42);
  background: #303936;
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

.combat-actions button:disabled {
  opacity: 0.55;
  cursor: wait;
}

.combat-score {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 18px;
  margin: 28px 0;
}

.combat-score article {
  padding: 18px;
  border: 1px solid var(--border-light);
  background: rgba(15, 20, 27, 0.88);
}

.combat-score h3,
.combat-score strong,
.combat-score span {
  display: block;
}

.combat-score strong {
  margin-top: 8px;
  color: var(--accent-gold);
  font-family: 'Syne', 'Segoe UI', sans-serif;
  font-size: 2.5rem;
}

.combat-score span {
  color: var(--text-muted);
  font-size: 0.55rem;
  text-transform: uppercase;
}

.result-stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.result-stats article {
  padding: 18px 16px;
  border: 1px solid var(--border-light);
  background: rgba(15, 20, 27, 0.88);
}

.result-stats h3,
.result-stats h4 {
  margin: 0 0 12px;
  color: var(--accent-gold);
  font-size: 0.78rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.final-builds {
  align-items: start;
}

.final-builds h4 {
  margin: 24px 0 12px;
  color: var(--accent-gold);
  font-size: 0.78rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.final-stat-value,
.final-stat-pair {
  color: var(--text-main);
  font-size: 0.55rem;
  line-height: 1.4;
  text-transform: uppercase;
}

.final-stat-pair {
  color: var(--accent-cyan);
}

.result-stats h4 {
  margin-top: 24px;
}

.stat-row,
.rule-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 7px 0;
  border-top: 1px solid rgba(160, 174, 175, 0.18);
  color: var(--text-muted);
  font-size: 0.58rem;
}

.stat-row strong {
  color: var(--text-main);
}

.rule-row {
  display: block;
  line-height: 1.5;
}

.rule-row small {
  display: block;
  color: var(--accent-cyan);
}

.validation-errors {
  padding: 16px;
  border: 1px solid var(--accent-red);
  color: var(--accent-red);
  font-size: 0.68rem;
  line-height: 1.7;
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

.realtime-game {
  display: grid;
  gap: 18px;
  padding-bottom: 76px;
}
.realtime-turn,
.realtime-draw-zone {
  border: 1px solid rgba(241, 212, 141, 0.45);
  background: rgba(30, 27, 20, 0.92);
  box-shadow: var(--shadow-dark);
}
.realtime-turn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 20px;
}
.realtime-turn.active { border-color: rgba(84, 196, 255, 0.7); }
.realtime-turn strong { color: var(--accent-gold); font-size: clamp(.9rem, 2vw, 1.2rem); letter-spacing: .1em; }
.realtime-turn span { color: var(--text-muted); font-size: .65rem; text-transform: uppercase; }
.realtime-boards { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.realtime-board { min-width: 0; padding: 16px; border: 1px solid rgba(246, 128, 72, .35); background: #353033; }
.realtime-board:nth-child(2) { border-color: rgba(84, 196, 255, .35); background: #30363b; }
.realtime-board.is-current { box-shadow: 0 0 0 2px rgba(241, 212, 141, .55); }
.realtime-board > header { display: flex; align-items: end; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
.realtime-board h2 { margin-top: 6px; font-size: clamp(1.1rem, 2vw, 1.6rem); text-transform: uppercase; }
.realtime-board > header > span { color: var(--text-muted); font-size: .62rem; text-transform: uppercase; }
.realtime-slots { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 7px; }
.realtime-slots button { display: flex; min-width: 0; min-height: 66px; flex-direction: column; justify-content: space-between; gap: 4px; padding: 8px; border: 1px solid rgba(157, 173, 170, .25); background: rgba(11, 14, 18, .72); color: var(--text-muted); text-align: left; }
.realtime-slots button.selectable { border-color: var(--accent-gold); cursor: pointer; }
.realtime-slots button > span { overflow: hidden; color: var(--accent-gold); font-size: .5rem; letter-spacing: .08em; text-overflow: ellipsis; text-transform: uppercase; white-space: nowrap; }
.realtime-slots button strong { overflow: hidden; color: var(--text-main); font-size: .62rem; text-overflow: ellipsis; white-space: nowrap; }
.realtime-slots button small { overflow: hidden; color: var(--text-muted); font-size: .56rem; text-overflow: ellipsis; white-space: nowrap; }
.realtime-slots button.filled { border-color: rgba(246, 128, 72, .5); }
.realtime-draw-zone { display: grid; grid-template-columns: minmax(180px, 280px) 1fr; align-items: center; gap: 24px; padding: 18px; }
.realtime-drawn-card, .realtime-empty-draw { display: grid; min-height: 84px; place-items: center; margin: 10px 0; border: 1px dashed rgba(241, 212, 141, .5); background: rgba(17, 20, 24, .7); text-align: center; }
.realtime-drawn-card strong { color: var(--text-main); font-size: .75rem; }
.realtime-drawn-card span { color: var(--accent-gold); font-size: .55rem; text-transform: uppercase; }
.realtime-empty-draw { color: var(--accent-gold); font-size: .7rem; letter-spacing: .1em; }
.realtime-draw-zone button { width: 100%; min-height: 44px; padding: .75rem; border: 0; background: linear-gradient(135deg, var(--accent-gold), var(--accent-orange)); color: #181a1b; font-size: .65rem; font-weight: 700; letter-spacing: .12em; }
.realtime-draw-zone button:disabled { cursor: not-allowed; opacity: .4; }
.realtime-current { color: var(--text-muted); font-size: .7rem; line-height: 1.7; }
.realtime-result { padding: 20px; border: 1px solid var(--accent-gold); }
.realtime-result h2 { margin-bottom: 8px; font-size: 1.5rem; text-transform: uppercase; }
.realtime-result p { color: var(--text-muted); font-size: .7rem; }

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
  .realtime-boards,
  .realtime-draw-zone { grid-template-columns: 1fr; }

  .realtime-slots { grid-template-columns: repeat(2, minmax(0, 1fr)); }

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
  .result-builds,
  .result-stats {
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

  .combat-score {
    grid-template-columns: 1fr;
  }

  .combat-score > b {
    text-align: center;
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
