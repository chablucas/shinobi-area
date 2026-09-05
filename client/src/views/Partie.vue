<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import GameCard from '../components/GameCard.vue'
import { fetchAllCards } from '../services/cardApi'
import { useAuthStore } from '../stores/auth'
import { saveBuild } from '../services/buildApi'
import { CombatApiError, simulateFight } from '../services/gameApi'
import { calculateRealtimeGameResult, chooseRealtimeGameResult, getGameLobby, getLobbyGame, SocialApiError, type AutoRealtimeResult, type RealtimeGameState } from '../services/socialApi'
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
import CombatDrawArea from '../components/CombatDrawArea.vue'

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
const socketConnected = ref(false)
const drawLoading = ref(false)
const currentStateVersion = ref(0)
const realtimeHostId = ref<number | null>(null)
const resultLoading = ref(false)
const manualResultOpen = ref(false)

const activeBuild = computed(() => builds.value[activePlayerId.value - 1]!)
const availableCardCount = computed(() => cards.value.length - usedCardIds.value.size)
const allBuildsComplete = computed(() => builds.value.every(isBuildComplete))
const winnerName = computed(() => winnerId.value ? `Joueur ${winnerId.value}` : '')
const playerCount = computed<2 | 3>(() => props.mode === 'local3' ? 3 : 2)
const isComputerTurn = computed(() => props.mode === 'solo' && activePlayerId.value === 2)
const combatBlocked = computed(() => Boolean(combatResult.value && (combatResult.value.player1.validationErrors.length || combatResult.value.player2.validationErrors.length)))
const gameStatKeys: Record<string, keyof CombatResult['player1']['finalStats'] | null> = { chakra: 'chakra', invocation: 'invocation', iq: 'iq', ninjutsu: 'ninjutsuAttack', genjutsu: 'genjutsu', taijutsu: 'taijutsu', avatar: 'avatar', body: 'body', fuinjutsu: 'fuinjutsu', senjutsu: 'senjutsu', kenjutsu: 'kenjutsu', clan: null, vitesse: 'speed', 'kekkei-genkai': 'kekkeiGenkai', 'kekkei-mora': 'kekkeiMora' }

onMounted(async () => {
  await auth.loadCurrentUser()
  if (props.lobbyId) {
    if (!auth.token) { lobbyAccessError.value = 'Connecte-toi pour rejoindre ce combat.'; loading.value = false; return }
    try {
      const lobby = await getGameLobby(auth.token, props.lobbyId)
      realtimeHostId.value = lobby.creatorId
      if (lobby.status !== 'PLAYING') { lobbyAccessError.value = lobby.status === 'READY' ? 'Le combat n’a pas encore commencé.' : 'Le salon attend encore les participants.'; loading.value = false; return }
      realtimeState.value = await getLobbyGame(auth.token, props.lobbyId)
      realtimePlayerNumber.value = realtimeState.value.players.find((player) => player.userId === auth.user?.id)?.playerNumber ?? null
      const socket = connectGameSocket(auth.token)
      realtimeSocket.value = socket
      const join = () => { socketConnected.value = true; errorMessage.value = ''; socket.emit('game:join', realtimeState.value?.id ?? '') }
      socket.on('connect', join)
      socket.on('disconnect', () => { socketConnected.value = false; drawLoading.value = false })
      socket.on('connect_error', () => { socketConnected.value = false; errorMessage.value = 'Connexion au combat impossible. Reconnexion...' })
      socket.on('game:state', (state) => {
        const incomingVersion = Number(state.stateVersion ?? state.turnNumber ?? 0)
        if (incomingVersion < currentStateVersion.value) {
          return
        }
        currentStateVersion.value = incomingVersion
        realtimeState.value = state
        drawLoading.value = false
        errorMessage.value = ''
      })
      socket.on('game:error', (socketError) => { errorMessage.value = socketError.message; drawLoading.value = false })
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
const isRealtimeHost = computed(() => auth.user?.id === realtimeHostId.value)
const autoRealtimeResult = computed(() => {
  const result = realtimeState.value?.result
  return result && 'resultMode' in result && result.resultMode === 'AUTO' ? result as AutoRealtimeResult : null
})
const realtimeWinnerName = computed(() => {
  const result = realtimeState.value?.result
  const winnerNumber = result && 'winnerNumber' in result ? result.winnerNumber : result?.winner === 'player1' ? 1 : result?.winner === 'player2' ? 2 : null
  return winnerNumber ? realtimeState.value?.players.find((player) => player.playerNumber === winnerNumber)?.displayName ?? `Joueur ${winnerNumber}` : ''
})
const realtimeResultIsDraw = computed(() => {
  const result = realtimeState.value?.result
  return result && 'isDraw' in result ? result.isDraw : result?.winner === 'draw'
})
const canDraw = computed(() => Boolean(
  socketConnected.value
  && realtimeState.value?.status === 'PLAYING'
  && realtimeMyTurn.value
  && !realtimeMyPlayer.value?.pendingCard
  && (realtimeMyPlayer.value?.cardsRemaining ?? 0) > 0
  && !drawLoading.value
))
function realtimeCanPlaceCategory(category: string) {
  const player = realtimeMyPlayer.value
  if (!realtimeState.value || !realtimeMyTurn.value || !player?.pendingCard || player.playerNumber !== realtimePlayerNumber.value || player.slots[category]) return false
  return true
}
function realtimeDraw() {
  if (!realtimeState.value || !canDraw.value) return
  drawLoading.value = true
  realtimeSocket.value?.emit('game:draw', realtimeState.value.id)
}
function realtimePlace(category: string) { if (realtimeState.value && realtimeCanPlaceCategory(category)) realtimeSocket.value?.emit('game:place-card', { gameId: realtimeState.value.id, category }) }
async function calculateRealtimeWinner() {
  if (!auth.token || !realtimeState.value || resultLoading.value) return
  resultLoading.value = true
  errorMessage.value = ''
  try { realtimeState.value = await calculateRealtimeGameResult(auth.token, realtimeState.value.id) } catch (error) { errorMessage.value = error instanceof Error ? error.message : 'Calcul du résultat impossible.' } finally { resultLoading.value = false }
}
async function submitManualRealtimeWinner(winnerNumber: 1 | 2 | null, isDraw = false) {
  if (!auth.token || !realtimeState.value || resultLoading.value) return
  resultLoading.value = true
  errorMessage.value = ''
  try { realtimeState.value = await chooseRealtimeGameResult(auth.token, realtimeState.value.id, winnerNumber, isDraw); manualResultOpen.value = false } catch (error) { errorMessage.value = error instanceof Error ? error.message : 'Choix du résultat impossible.' } finally { resultLoading.value = false }
}

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
    finalStats.kekkeiMora = build.slots['kekkei-mora']?.stats.kekkeiMora ?? 0
    return { baseStats: { ...finalStats }, finalStats, total: Object.entries(finalStats).filter(([key]) => key !== 'clan').reduce((total, [, value]) => total + value, 0), appliedRules: [], permissions: { sharingan: false, rinnegan: false, byakugan: false, tenseigan: false, otsutsuki: false, uzumaki: false }, validationErrors: [] }
  })
  return { resolutionMode: 'manual', winner: 'draw', player1: results[0]!, player2: results[1]!, player1Total: results[0]!.total, player2Total: results[1]!.total, scores: { player1: 0, player2: 0 }, categories: [] }
}

function chooseManualWinner(winner: 'player1' | 'player2' | 'draw') {
  if (phase.value !== 'combat') return
  combatResult.value = { ...manualResult(), winner }
  winnerId.value = winner === 'player1' ? 1 : winner === 'player2' ? 2 : null
  phase.value = 'result'
}

function cardFor(build: PlayerBuild, slug: CategorySlug) { return build.slots[slug] }
function finalValue(player: CombatResult['player1'], slug: CategorySlug) {
  if (slug === 'clan') return null
  const value = player.finalStats[gameStatKeys[slug]!]
  return typeof value === 'number' ? Number(value.toFixed(2)) : value
}

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

type DrawCardLike = Pick<Card, 'name' | 'imageUrl' | 'clans' | 'traits'> & {
  stats?: Record<string, number | null>
}

function drawStatsFor(card: DrawCardLike | null) {
  if (!card) return []
  const statsMap = card.stats ?? {}
  const stats = [
    ['Chakra', statsMap.chakra ?? 0],
    ['IQ', statsMap.iq ?? 0],
    ['Ninjutsu', statsMap.ninjutsuAttack ?? 0],
    ['Genjutsu', statsMap.genjutsu ?? 0],
    ['Taijutsu', statsMap.taijutsu ?? 0],
    ['Body', statsMap.body ?? 0],
    ['Vitesse', statsMap.speed ?? 0],
    ['Kekkei Genkai', statsMap.kekkeiGenkai ?? 0],
    ['Kekkei Mōra', statsMap.kekkeiMora ?? 0],
  ] as Array<[string, number]>
  return stats.filter(([, value]) => Number(value) > 0).map(([label, value]) => ({ label, value: Number(value).toFixed(0) }))
}

function drawBonusesFor(card: DrawCardLike | null) {
  if (!card) return []
  const bonuses: Array<{ label: string; value: string }> = []
  const clans = card.clans?.length ? card.clans.join(' · ') : 'Aucun clan'
  bonuses.push({ label: 'Clan', value: clans })
  const kekkeiGenkai = card.traits?.abilities?.kekkeiGenkai?.length ? card.traits.abilities.kekkeiGenkai.join(' · ') : 'Aucun'
  bonuses.push({ label: 'Kekkei Genkai', value: kekkeiGenkai })
  const kekkeiMora = card.traits?.abilities?.kekkeiMora?.length ? card.traits.abilities.kekkeiMora.join(' · ') : 'Aucun'
  bonuses.push({ label: 'Kekkei Mōra', value: kekkeiMora })
  return bonuses
}
</script>

<template>
  <main class="game-shell">
    <SocialHeader />

    <header class="page-heading">
      <div>
        <p class="eyebrow">{{ props.mode === 'solo' ? 'Solo · joueur contre ordinateur' : props.mode === 'local3' ? 'Local · 3 joueurs' : 'Local · 2 joueurs' }}</p>
        <h1>Arène de combat</h1>
      </div>
      <div v-if="phase === 'construction'" class="turn-status" :class="{ active: !pendingCard }">
        <span class="status-dot"></span>
        <strong>
          {{ isComputerTurn ? 'Tour de l’ordinateur...' : pendingCard ? `Joueur ${activePlayerId} : place ta carte` : `Tour du Joueur ${activePlayerId} : pioche une carte` }}
        </strong>
        <small>{{ availableCardCount }} cartes restantes dans le deck</small>
      </div>
    </header>

    <p v-if="lobbyAccessError" class="error-message">{{ lobbyAccessError }}</p>
    <template v-else>
      <p v-if="loading" class="loading-message">Chargement des 163 cartes...</p>
      <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>

      <!-- Combat multijoueur temps réel -->
      <section v-if="props.lobbyId && realtimeState" class="realtime-game">
        <div class="realtime-turn" :class="{ active: realtimeMyTurn }">
          <strong>{{ realtimeMyTurn ? 'À TON TOUR' : `AU TOUR DE JOUEUR ${realtimeState.currentPlayerNumber}` }}</strong>
          <span>Tour {{ realtimeState.turnNumber }}</span>
        </div>

        <div class="realtime-boards">
          <article
            v-for="player in realtimeState.players"
            :key="player.playerNumber"
            class="realtime-board"
            :class="{ 'is-current': player.playerNumber === realtimeState.currentPlayerNumber }"
          >
            <header>
              <div>
                <p class="eyebrow">Joueur {{ player.playerNumber }}</p>
                <h2>{{ player.userId === auth.user?.id ? 'Toi' : player.displayName }}</h2>
              </div>
              <span>{{ player.cardsRemaining }} cartes</span>
            </header>

            <!-- Pioche si Joueur 1 (au-dessus) -->
            <div
              v-if="player.playerNumber === 1 && player.playerNumber === realtimePlayerNumber"
              class="realtime-draw-zone player-one-draw"
            >
              <CombatDrawArea
                :card="player.pendingCard"
                title="Carte piochée"
                :show-button="true"
                :button-disabled="!canDraw"
                :stats="drawStatsFor(player.pendingCard)"
                :bonuses="drawBonusesFor(player.pendingCard)"
                button-label="PIOCHER"
                empty-text="Aucune carte"
                :waiting-text="realtimeMyTurn ? 'PIOCHER' : 'EN ATTENTE'"
                @draw="realtimeDraw"
              />
            </div>

            <div class="realtime-slots">
              <button
                v-for="[label, category] in CATEGORY_DEFINITIONS"
                :key="category"
                type="button"
                :disabled="!realtimeCanPlaceCategory(category) && !(player.playerNumber === realtimePlayerNumber && player.slots[category] === null && !realtimeMyTurn)"
                :class="{
                  filled: !!player.slots[category],
                  selectable: player.playerNumber === realtimePlayerNumber && realtimeCanPlaceCategory(category) && !player.slots[category],
                }"
                @click="realtimePlace(category)"
              >
                <span>{{ label }}</span>
                <template v-if="player.slots[category]">
                  <div class="realtime-slot-art">
                    <img v-if="player.slots[category]?.imageUrl" :src="player.slots[category]?.imageUrl ?? undefined" :alt="`Carte ${player.slots[category]?.name}`" />
                    <span v-else>{{ player.slots[category]?.name.slice(0, 1) }}</span>
                  </div>
                  <strong>{{ player.slots[category]?.name }}</strong>
                  <small v-if="category === 'ninjutsu'">{{ player.slots[category]?.stats.ninjutsuAttack }} / {{ player.slots[category]?.stats.ninjutsuDefense }}</small>
                  <small v-else-if="category === 'clan'">{{ player.slots[category]?.clans.join(' · ') || 'Aucun' }}</small>
                  <small v-else>{{
                    category === 'vitesse'
                      ? Number(player.slots[category]?.stats.speed ?? 0).toFixed(0)
                      : category === 'kekkei-genkai'
                        ? Number(player.slots[category]?.stats.kekkeiGenkai ?? 0).toFixed(0)
                        : category === 'kekkei-mora'
                          ? Number(player.slots[category]?.stats.kekkeiMora ?? 0).toFixed(0)
                          : typeof player.slots[category]?.stats[category] === 'number'
                            ? Number(player.slots[category]!.stats[category]).toFixed(0)
                            : '—'
                  }}</small>
                </template>
                <small v-else>VIDE</small>
              </button>
            </div>

            <!-- Pioche si Joueur 2 (en-dessous) -->
            <div
              v-if="player.playerNumber === 2 && player.playerNumber === realtimePlayerNumber"
              class="realtime-draw-zone player-two-draw"
            >
              <CombatDrawArea
                :card="player.pendingCard"
                title="Carte piochée"
                :show-button="true"
                :button-disabled="!canDraw"
                :stats="drawStatsFor(player.pendingCard)"
                :bonuses="drawBonusesFor(player.pendingCard)"
                button-label="PIOCHER"
                empty-text="Aucune carte"
                :waiting-text="realtimeMyTurn ? 'PIOCHER' : 'EN ATTENTE'"
                @draw="realtimeDraw"
              />
            </div>
          </article>
        </div>

        <section v-if="realtimeState.status === 'AWAITING_RESULT'" class="realtime-result">
          <p class="eyebrow">Combat terminé</p>
          <h2>Les deux shinobis sont complets.</h2>
          <div class="combat-actions">
            <button type="button" :disabled="resultLoading" @click="calculateRealtimeWinner">
              {{ resultLoading ? 'CALCUL EN COURS...' : 'CALCULER LE VAINQUEUR' }}
            </button>
            <button v-if="isRealtimeHost" type="button" :disabled="resultLoading" @click="manualResultOpen = true">
              CHOISIR LE VAINQUEUR
            </button>
          </div>
        </section>

        <section v-if="realtimeState.status === 'FINISHED' && realtimeState.result" class="realtime-result">
          <p class="eyebrow">Résultat du combat</p>
          <template v-if="autoRealtimeResult">
            <div class="combat-score">
              <article>
                <h3>Joueur 1</h3>
                <strong>{{ autoRealtimeResult.player1Total }}</strong>
                <span>pts</span>
              </article>
              <b>VS</b>
              <article>
                <h3>Joueur 2</h3>
                <strong>{{ autoRealtimeResult.player2Total }}</strong>
                <span>pts</span>
              </article>
            </div>
            <h2>{{ autoRealtimeResult.isDraw ? 'ÉGALITÉ' : `VAINQUEUR : ${realtimeWinnerName}` }}</h2>
            <p>Résultat calculé par le moteur officiel.</p>
            <details>
              <summary>RÈGLES APPLIQUÉES</summary>
              <p
                v-for="rule in [...autoRealtimeResult.player1.appliedRules, ...autoRealtimeResult.player2.appliedRules]"
                :key="rule.ruleId + rule.target + rule.after"
                class="rule-row"
              >
                {{ rule.label }} · {{ rule.target }} : {{ rule.before }} → {{ rule.after }}
              </p>
            </details>
          </template>
          <template v-else>
            <h2>{{ realtimeResultIsDraw ? 'ÉGALITÉ' : `VAINQUEUR : ${realtimeWinnerName}` }}</h2>
            <p>Résultat choisi manuellement par l’hôte.</p>
          </template>
        </section>

        <div v-if="manualResultOpen" class="manual-result-modal" role="dialog" aria-modal="true">
          <section>
            <p class="eyebrow">Qui a gagné ?</p>
            <button type="button" :disabled="resultLoading" @click="submitManualRealtimeWinner(1)">
              JOUEUR 1 — {{ realtimeState.players[0]?.displayName }}
            </button>
            <button type="button" :disabled="resultLoading" @click="submitManualRealtimeWinner(2)">
              JOUEUR 2 — {{ realtimeState.players[1]?.displayName }}
            </button>
            <button type="button" :disabled="resultLoading" @click="submitManualRealtimeWinner(null, true)">
              ÉGALITÉ
            </button>
            <button type="button" :disabled="resultLoading" @click="manualResultOpen = false">
              ANNULER
            </button>
          </section>
        </div>
      </section>

      <!-- Phase 1: Construction des Shinobis (Local / Solo / 1v1v1) -->
      <template v-if="!props.lobbyId && phase === 'construction'">
        <section class="vertical-battle-layout">
          <!-- JOUEUR 1 -->
          <article class="build-panel player-one" :class="{ 'is-active': activePlayerId === 1 }">
            <header class="build-header">
              <div>
                <p class="eyebrow">Composition 01</p>
                <h2>{{ props.mode === 'solo' ? 'Ton Shinobi' : 'Joueur 1' }}</h2>
              </div>
              <span class="build-count">{{ filledSlotCount(builds[0]!) }} <small>/ 15</small></span>
            </header>

            <!-- Pioche du Joueur 1 : AU-DESSUS de son deck -->
            <div class="player-draw-area draw-area-top">
              <CombatDrawArea
                v-if="activePlayerId === 1"
                :card="pendingCard"
                title="Carte piochée"
                :show-button="!pendingCard"
                :button-disabled="loading || availableCardCount === 0 || allBuildsComplete"
                :stats="drawStatsFor(pendingCard)"
                :bonuses="drawBonusesFor(pendingCard)"
                button-label="PIOCHER UNE CARTE (J1)"
                empty-text="Aucune carte"
                :waiting-text="pendingCard ? 'Place ta carte' : 'En attente du tour de Joueur 1'"
                @draw="drawCard"
              />
              <button
                v-if="lastPlacement && lastPlacement.playerId === 1"
                class="undo-action-btn"
                type="button"
                @click="undoLastPlacement"
              >
                ← Annuler le coup
              </button>
            </div>

            <!-- Grille des 15 cartes Joueur 1 -->
            <div class="category-grid">
              <button
                v-for="[label, slug] in CATEGORY_DEFINITIONS"
                :key="slug"
                class="category-slot"
                :class="{
                  filled: slotCard(builds[0]!, slug),
                  selectable: activePlayerId === 1 && !!pendingCard && !slotCard(builds[0]!, slug),
                }"
                type="button"
                :disabled="activePlayerId !== 1 || !pendingCard || !!slotCard(builds[0]!, slug)"
                @click="placePendingCard(slug)"
              >
                <span class="slot-label">{{ label }}</span>
                <template v-if="slotCard(builds[0]!, slug)">
                  <span class="slot-card-preview">
                    <img
                      v-if="slotCard(builds[0]!, slug)?.imageUrl"
                      :src="slotCard(builds[0]!, slug)?.imageUrl ?? undefined"
                      :alt="`Miniature de ${slotCard(builds[0]!, slug)?.name}`"
                      loading="lazy"
                    />
                    <span v-else class="slot-card-fallback">{{ slotCard(builds[0]!, slug)?.name.slice(0, 1) }}</span>
                  </span>
                  <span class="slot-card-details">
                    <span class="slot-card-name">{{ slotCard(builds[0]!, slug)?.name }}</span>
                    <span class="slot-state">Posée</span>
                  </span>
                </template>
                <template v-else>
                  <span class="slot-empty">Libre</span>
                  <span class="slot-state">{{ activePlayerId === 1 && pendingCard ? 'Placer ici' : 'En attente' }}</span>
                </template>
              </button>
            </div>
          </article>

          <!-- ZONE CENTRALE DE COMBAT -->
          <div class="battle-center-arena">
            <div class="arena-badge">
              <span class="arena-icon">⚔</span>
              <span class="arena-text">ZONE DE COMBAT</span>
              <span class="arena-icon">⚔</span>
            </div>
            <p class="arena-status">
              {{
                allBuildsComplete
                  ? 'Compositions complètes ! Prêt pour le combat.'
                  : isComputerTurn
                    ? 'L’ordinateur analyse la pioche...'
                    : pendingCard
                      ? `Joueur ${activePlayerId} : choisis l'emplacement de ta carte`
                      : `Joueur ${activePlayerId} : tire une carte`
              }}
            </p>
          </div>

          <!-- JOUEUR 2 -->
          <article class="build-panel player-two" :class="{ 'is-active': activePlayerId === 2 }">
            <header class="build-header">
              <div>
                <p class="eyebrow">Composition 02</p>
                <h2>{{ props.mode === 'solo' ? 'IA Adversaire' : 'Joueur 2' }}</h2>
              </div>
              <span class="build-count">{{ filledSlotCount(builds[1]!) }} <small>/ 15</small></span>
            </header>

            <!-- Grille des 15 cartes Joueur 2 -->
            <div class="category-grid">
              <button
                v-for="[label, slug] in CATEGORY_DEFINITIONS"
                :key="slug"
                class="category-slot"
                :class="{
                  filled: slotCard(builds[1]!, slug),
                  selectable: activePlayerId === 2 && !!pendingCard && !slotCard(builds[1]!, slug),
                }"
                type="button"
                :disabled="isComputerTurn || activePlayerId !== 2 || !pendingCard || !!slotCard(builds[1]!, slug)"
                @click="placePendingCard(slug)"
              >
                <span class="slot-label">{{ label }}</span>
                <template v-if="slotCard(builds[1]!, slug)">
                  <span class="slot-card-preview">
                    <img
                      v-if="slotCard(builds[1]!, slug)?.imageUrl"
                      :src="slotCard(builds[1]!, slug)?.imageUrl ?? undefined"
                      :alt="`Miniature de ${slotCard(builds[1]!, slug)?.name}`"
                      loading="lazy"
                    />
                    <span v-else class="slot-card-fallback">{{ slotCard(builds[1]!, slug)?.name.slice(0, 1) }}</span>
                  </span>
                  <span class="slot-card-details">
                    <span class="slot-card-name">{{ slotCard(builds[1]!, slug)?.name }}</span>
                    <span class="slot-state">Posée</span>
                  </span>
                </template>
                <template v-else>
                  <span class="slot-empty">Libre</span>
                  <span class="slot-state">{{ activePlayerId === 2 && pendingCard ? 'Placer ici' : 'En attente' }}</span>
                </template>
              </button>
            </div>

            <!-- Pioche du Joueur 2 : EN DESSOUS de son deck -->
            <div class="player-draw-area draw-area-bottom">
              <CombatDrawArea
                v-if="activePlayerId === 2 && !isComputerTurn"
                :card="pendingCard"
                title="Carte piochée"
                :show-button="!pendingCard"
                :button-disabled="loading || availableCardCount === 0 || allBuildsComplete"
                :stats="drawStatsFor(pendingCard)"
                :bonuses="drawBonusesFor(pendingCard)"
                button-label="PIOCHER UNE CARTE (J2)"
                empty-text="Aucune carte"
                :waiting-text="pendingCard ? 'Place ta carte' : isComputerTurn ? 'Ordinateur...' : 'En attente du tour de Joueur 2'"
                @draw="drawCard"
              />
              <div v-else-if="isComputerTurn" class="ai-thinking-badge">
                <span>L'ordinateur réfléchit et place son shinobi...</span>
              </div>
              <button
                v-if="lastPlacement && lastPlacement.playerId === 2"
                class="undo-action-btn"
                type="button"
                @click="undoLastPlacement"
              >
                ← Annuler le coup
              </button>
            </div>
          </article>

          <!-- JOUEUR 3 (si mode 1v1v1) -->
          <article
            v-if="props.mode === 'local3' && builds[2]"
            class="build-panel player-three"
            :class="{ 'is-active': activePlayerId === 3 }"
          >
            <header class="build-header">
              <div>
                <p class="eyebrow">Composition 03</p>
                <h2>Joueur 3</h2>
              </div>
              <span class="build-count">{{ filledSlotCount(builds[2]!) }} <small>/ 15</small></span>
            </header>

            <div class="category-grid">
              <button
                v-for="[label, slug] in CATEGORY_DEFINITIONS"
                :key="slug"
                class="category-slot"
                :class="{
                  filled: slotCard(builds[2]!, slug),
                  selectable: activePlayerId === 3 && !!pendingCard && !slotCard(builds[2]!, slug),
                }"
                type="button"
                :disabled="activePlayerId !== 3 || !pendingCard || !!slotCard(builds[2]!, slug)"
                @click="placePendingCard(slug)"
              >
                <span class="slot-label">{{ label }}</span>
                <template v-if="slotCard(builds[2]!, slug)">
                  <span class="slot-card-preview">
                    <img
                      v-if="slotCard(builds[2]!, slug)?.imageUrl"
                      :src="slotCard(builds[2]!, slug)?.imageUrl ?? undefined"
                      :alt="`Miniature de ${slotCard(builds[2]!, slug)?.name}`"
                      loading="lazy"
                    />
                    <span v-else class="slot-card-fallback">{{ slotCard(builds[2]!, slug)?.name.slice(0, 1) }}</span>
                  </span>
                  <span class="slot-card-details">
                    <span class="slot-card-name">{{ slotCard(builds[2]!, slug)?.name }}</span>
                    <span class="slot-state">Posée</span>
                  </span>
                </template>
                <template v-else>
                  <span class="slot-empty">Libre</span>
                  <span class="slot-state">{{ activePlayerId === 3 && pendingCard ? 'Placer ici' : 'En attente' }}</span>
                </template>
              </button>
            </div>

            <!-- Pioche du Joueur 3 : EN DESSOUS de son deck -->
            <div class="player-draw-area draw-area-bottom">
              <CombatDrawArea
                v-if="activePlayerId === 3"
                :card="pendingCard"
                title="Carte piochée"
                :show-button="!pendingCard"
                :button-disabled="loading || availableCardCount === 0 || allBuildsComplete"
                :stats="drawStatsFor(pendingCard)"
                :bonuses="drawBonusesFor(pendingCard)"
                button-label="PIOCHER UNE CARTE (J3)"
                empty-text="Aucune carte"
                :waiting-text="pendingCard ? 'Place ta carte' : 'En attente du tour de Joueur 3'"
                @draw="drawCard"
              />
              <button
                v-if="lastPlacement && lastPlacement.playerId === 3"
                class="undo-action-btn"
                type="button"
                @click="undoLastPlacement"
              >
                ← Annuler le coup
              </button>
            </div>
          </article>
        </section>
      </template>

      <!-- Phase 2: Étape de combat -->
      <section v-else-if="!props.lobbyId && phase === 'combat'" class="combat-panel">
        <div class="combat-intro">
          <p class="eyebrow">Arène finale</p>
          <h2>Simuler le combat</h2>
          <p>Les deux shinobis sont complets. Lance la confrontation officielle ou choisis le dénouement.</p>
        </div>

        <div class="combat-actions">
          <button type="button" class="btn-simulate" :disabled="simulating" @click="runSimulation">
            <span>{{ simulating ? 'Simulation en cours...' : '⚡ SIMULER LE COMBAT' }}</span>
            <span>→</span>
          </button>
          <div class="manual-choices">
            <button type="button" :disabled="simulating" @click="chooseManualWinner('player1')">
              Victoire J1
            </button>
            <button type="button" :disabled="simulating" @click="chooseManualWinner('player2')">
              Victoire J2
            </button>
            <button type="button" :disabled="simulating" @click="chooseManualWinner('draw')">
              Égalité
            </button>
          </div>
        </div>

        <div class="combat-builds">
          <article
            v-for="build in builds"
            :key="build.playerId"
            class="build-panel"
            :class="{ 'player-one': build.playerId === 1, 'player-two': build.playerId === 2, 'player-three': build.playerId === 3 }"
          >
            <header class="build-header">
              <h3>Joueur {{ build.playerId }}</h3>
              <span class="build-count">15 <small>/ 15</small></span>
            </header>
            <div class="category-grid">
              <div v-for="[label, slug] in CATEGORY_DEFINITIONS" :key="slug" class="category-slot filled">
                <span class="slot-label">{{ label }}</span>
                <span class="slot-card-preview">
                  <img
                    v-if="slotCard(build, slug)?.imageUrl"
                    :src="slotCard(build, slug)?.imageUrl ?? undefined"
                    :alt="`Miniature de ${slotCard(build, slug)?.name}`"
                  />
                  <span v-else class="slot-card-fallback">{{ slotCard(build, slug)?.name.slice(0, 1) }}</span>
                </span>
                <span class="slot-card-details">
                  <span class="slot-card-name">{{ slotCard(build, slug)?.name }}</span>
                  <span class="slot-state">Prête</span>
                </span>
              </div>
            </div>
          </article>
        </div>
      </section>

      <!-- Phase 3: Résultats du combat -->
      <section v-else-if="!props.lobbyId" class="result-panel">
        <p class="eyebrow">Dénouement de l'arène</p>

        <template v-if="combatResult && combatBlocked">
          <h2>Composition invalide</h2>
          <div class="validation-errors">
            <p v-for="error in [...combatResult.player1.validationErrors, ...combatResult.player2.validationErrors]" :key="error.ruleId + error.message">
              {{ error.message }}
            </p>
          </div>
        </template>

        <template v-else-if="combatResult">
          <h2>
            {{
              combatResult.resolutionMode === 'manual'
                ? combatResult.winner === 'draw'
                  ? 'Égalité'
                  : `Vainqueur choisi : Joueur ${combatResult.winner === 'player1' ? 1 : 2}`
                : combatResult.winner === 'draw'
                  ? 'Égalité'
                  : `Gagnant : Joueur ${combatResult.winner === 'player1' ? 1 : 2}`
            }}
          </h2>

          <div class="combat-score">
            <article class="score-card player-one">
              <h3>Joueur 1</h3>
              <strong>{{ Number(combatResult.player1.total).toFixed(2) }}</strong>
              <span>Total Points</span>
            </article>
            <b class="score-vs">VS</b>
            <article class="score-card player-two">
              <h3>Joueur 2</h3>
              <strong>{{ Number(combatResult.player2.total).toFixed(2) }}</strong>
              <span>Total Points</span>
            </article>
          </div>

          <div class="result-builds final-builds">
            <article
              v-for="(player, index) in [combatResult.player1, combatResult.player2]"
              :key="index"
              class="build-panel"
              :class="{ 'player-one': index === 0, 'player-two': index === 1 }"
            >
              <header class="build-header">
                <h3>Joueur {{ index + 1 }} · Statistiques finales</h3>
              </header>
              <div class="category-grid">
                <div v-for="[label, slug] in CATEGORY_DEFINITIONS" :key="slug" class="category-slot filled">
                  <span class="slot-label">{{ label }}</span>
                  <span class="slot-card-preview">
                    <img
                      v-if="cardFor(builds[index]!, slug)?.imageUrl"
                      :src="cardFor(builds[index]!, slug)?.imageUrl ?? undefined"
                      :alt="`Miniature de ${cardFor(builds[index]!, slug)?.name}`"
                    />
                    <span v-else class="slot-card-fallback">{{ cardFor(builds[index]!, slug)?.name.slice(0, 1) }}</span>
                  </span>
                  <span class="slot-card-details">
                    <span class="slot-card-name">{{ cardFor(builds[index]!, slug)?.name }}</span>
                    <span v-if="slug === 'ninjutsu'" class="final-stat-pair">ATQ {{ player.finalStats.ninjutsuAttack }} · DEF {{ player.finalStats.ninjutsuDefense }}</span>
                    <span v-else-if="slug === 'clan'" class="final-stat-pair">{{ cardFor(builds[index]!, slug)?.name }}</span>
                    <span v-else class="final-stat-value">{{ finalValue(player, slug) }}</span>
                  </span>
                </div>
              </div>

              <div v-if="player.appliedRules.length" class="rules-applied-section">
                <h4>Règles appliquées</h4>
                <p v-for="rule in player.appliedRules" :key="rule.ruleId + rule.target + rule.after" class="rule-row">
                  {{ rule.label }} · {{ rule.target }} : {{ rule.before }} → {{ rule.after }}
                  <small>({{ rule.operation }} {{ rule.value }})</small>
                </p>
              </div>
            </article>
          </div>
        </template>

        <div v-else class="error-message">Aucun résultat de combat disponible.</div>

        <div class="result-actions">
          <button v-if="auth.isAuthenticated" class="primary-button" type="button" :disabled="saved" @click="saveHumanBuild">
            {{ saved ? '✓ Perso sauvegardé' : '💾 Sauvegarder mon perso' }}
          </button>
          <a v-else class="secondary-button" href="/connexion">Connecte-toi pour sauvegarder</a>
          <button class="primary-button" type="button" @click="replay">
            Rejouer <span>↻</span>
          </button>
          <a class="secondary-button" href="/">Retour à l’accueil <span>↗</span></a>
        </div>
      </section>
    </template>
  </main>
</template>

<style scoped>
.game-shell {
  min-height: 100vh;
  background: var(--bg-main);
  overflow-x: hidden;
}

.game-shell > * {
  max-width: 1360px;
  margin-inline: auto;
  padding-inline: max(16px, calc((100vw - 1360px) / 2));
  box-sizing: border-box;
}

.page-heading {
  display: block;
  text-align: center;
  padding: 32px 0 20px;
}

.eyebrow {
  color: var(--accent-gold);
  font-size: 0.6rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  margin: 0;
}

.page-heading h1 {
  margin: 8px 0 0;
  font-size: clamp(2rem, 5vw, 3.8rem);
  line-height: 0.96;
  letter-spacing: -0.06em;
  text-transform: uppercase;
}

.turn-status {
  max-width: 420px;
  margin: 18px auto 0;
  text-align: left;
  padding: 12px 18px;
  border: 1px solid rgba(246, 128, 72, 0.6);
  background: linear-gradient(135deg, rgba(41, 23, 16, 0.92), rgba(17, 20, 22, 0.9));
  box-shadow: var(--shadow-glow-orange);
  clip-path: var(--clip-soft);
}

.turn-status.active {
  border-color: rgba(84, 196, 255, 0.6);
  background: linear-gradient(135deg, rgba(18, 31, 40, 0.95), rgba(14, 19, 25, 0.9));
  box-shadow: var(--shadow-glow-blue);
}

.turn-status strong,
.turn-status small {
  display: block;
}

.turn-status strong {
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.turn-status small {
  margin-top: 6px;
  color: var(--text-muted);
  font-size: 0.58rem;
  letter-spacing: 0.08em;
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

/* Vertical Battle Layout (Mobile & Tablet & Desktop responsive) */
.vertical-battle-layout {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding-bottom: 70px;
  margin-top: 10px;
}

.build-panel {
  min-width: 0;
  padding: 18px 16px;
  background: rgba(17, 20, 24, 0.88);
  border: 1px solid rgba(160, 174, 175, 0.18);
  box-shadow: var(--shadow-dark);
  clip-path: var(--clip-soft);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.build-panel.player-one {
  border-color: rgba(246, 128, 72, 0.4);
  background: #353033;
}

.build-panel.player-two {
  border-color: rgba(84, 196, 255, 0.4);
  background: #30363b;
}

.build-panel.player-three {
  border-color: rgba(138, 217, 184, 0.45);
  background: #303936;
}

.build-panel.is-active {
  border-color: var(--accent-gold);
  box-shadow: 0 0 20px rgba(241, 212, 141, 0.25);
}

.build-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.build-header h2,
.build-header h3 {
  margin: 4px 0 0;
  font-size: clamp(1.2rem, 3vw, 1.8rem);
  letter-spacing: -0.04em;
  text-transform: uppercase;
}

.build-count {
  color: var(--accent-gold);
  font-family: 'Syne', sans-serif;
  font-size: clamp(1.4rem, 2.5vw, 1.9rem);
  font-weight: 700;
}

.build-count small {
  color: var(--text-muted);
  font-size: 0.58rem;
}

/* Zone de pioche intégrée par joueur */
.player-draw-area {
  padding: 12px;
  margin: 12px 0;
  border: 1px dashed rgba(241, 212, 141, 0.4);
  background: rgba(12, 15, 20, 0.65);
  clip-path: var(--clip-soft);
}

.draw-area-top {
  margin-top: 4px;
  margin-bottom: 14px;
}

.draw-area-bottom {
  margin-top: 14px;
  margin-bottom: 4px;
}

.draw-cta-container {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.draw-action-btn {
  flex: 1;
  min-height: 46px;
  padding: 10px 16px;
  border: 0;
  background: linear-gradient(135deg, var(--accent-gold), var(--accent-orange));
  color: #181a1b;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  clip-path: var(--clip-soft);
  cursor: pointer;
  touch-action: manipulation;
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.draw-action-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(246, 128, 72, 0.4);
}

.draw-action-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.undo-action-btn {
  min-height: 46px;
  padding: 10px 14px;
  border: 1px solid var(--border-light);
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-soft);
  font-size: 0.62rem;
  cursor: pointer;
  clip-path: var(--clip-soft);
}

.draw-waiting-badge {
  text-align: center;
  padding: 8px;
  color: var(--text-muted);
  font-size: 0.62rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.ai-thinking-badge {
  text-align: center;
  padding: 10px;
  color: var(--accent-cyan);
  font-size: 0.68rem;
  letter-spacing: 0.06em;
  animation: pulse 1.5s infinite ease-in-out;
}

@keyframes pulse {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}

.active-draw-preview {
  padding: 4px;
}

.card-preview-compact {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 8px;
  background: rgba(246, 128, 72, 0.12);
  border: 1px solid var(--accent-orange);
  clip-path: var(--clip-soft);
}

.preview-img-box {
  width: 48px;
  height: 64px;
  flex-shrink: 0;
  background: #000;
  border: 1px solid var(--accent-gold);
  overflow: hidden;
  display: grid;
  place-items: center;
}

.preview-img-box img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.preview-letter {
  font-family: 'Syne', sans-serif;
  font-size: 1.6rem;
  font-weight: 800;
  color: var(--accent-gold);
}

.preview-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.preview-badge {
  color: var(--accent-gold);
  font-size: 0.52rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.preview-info strong {
  font-size: 0.85rem;
  color: var(--text-main);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preview-instruction {
  color: var(--accent-orange);
  font-size: 0.58rem;
  font-weight: 600;
}

/* Zone centrale de combat */
.battle-center-arena {
  text-align: center;
  padding: 16px 20px;
  border: 1px solid rgba(241, 212, 141, 0.5);
  background: linear-gradient(135deg, rgba(34, 28, 20, 0.95), rgba(18, 22, 28, 0.95));
  clip-path: var(--clip-soft);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
}

.arena-badge {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: var(--accent-gold);
  font-family: 'Syne', sans-serif;
  font-weight: 800;
  font-size: 0.85rem;
  letter-spacing: 0.14em;
}

.arena-icon {
  color: var(--accent-orange);
  font-size: 1.1rem;
}

.arena-status {
  margin: 6px 0 0;
  color: var(--text-muted);
  font-size: 0.68rem;
  line-height: 1.5;
}

/* Grille des catégories (Deck) */
.category-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 6px;
}

.category-slot {
  display: flex;
  min-width: 0;
  min-height: 68px;
  flex-direction: column;
  align-items: stretch;
  justify-content: space-between;
  padding: 6px;
  border: 1px solid rgba(150, 170, 167, 0.2);
  background: rgba(11, 14, 18, 0.75);
  color: var(--text-muted);
  text-align: left;
  transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
  touch-action: manipulation;
  cursor: pointer;
}

.category-slot.selectable {
  border-color: rgba(241, 212, 141, 0.8);
  background: rgba(48, 38, 22, 0.8);
  box-shadow: 0 0 10px rgba(241, 212, 141, 0.3);
  animation: pulse-border 1.2s infinite alternate ease-in-out;
}

@keyframes pulse-border {
  from { border-color: rgba(241, 212, 141, 0.5); }
  to { border-color: rgba(241, 212, 141, 1); }
}

.category-slot.selectable:hover {
  transform: translateY(-2px);
  border-color: var(--accent-gold);
}

.category-slot.filled {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr);
  column-gap: 6px;
  row-gap: 4px;
  padding: 6px;
  background: rgba(27, 18, 17, 0.9);
  border-color: rgba(246, 128, 72, 0.4);
}

.player-two .category-slot.filled {
  background: rgba(15, 24, 34, 0.92);
  border-color: rgba(84, 196, 255, 0.4);
}

.player-three .category-slot.filled {
  background: rgba(18, 32, 26, 0.92);
  border-color: rgba(138, 217, 184, 0.4);
}

.slot-label {
  color: var(--accent-gold);
  font-size: 0.5rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.category-slot.filled .slot-label {
  grid-column: 1 / -1;
}

.slot-card-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 50px;
  min-width: 36px;
  overflow: hidden;
  border: 1px solid rgba(246, 128, 72, 0.4);
  background: rgba(8, 12, 16, 0.8);
}

.player-two .slot-card-preview {
  border-color: rgba(84, 196, 255, 0.45);
}

.player-three .slot-card-preview {
  border-color: rgba(138, 217, 184, 0.45);
}

.slot-card-preview img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.slot-card-fallback {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.4);
  color: var(--accent-gold);
  font-weight: 700;
  font-size: 0.8rem;
}

.slot-card-details {
  display: flex;
  min-width: 0;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
}

.slot-card-name {
  color: var(--text-main);
  font-size: 0.55rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.slot-state,
.slot-empty {
  font-size: 0.5rem;
  letter-spacing: 0.06em;
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

.player-three .slot-state {
  color: var(--accent-green);
}

/* Phase Combat & Results */
.combat-panel,
.result-panel {
  max-width: 1100px;
  margin: 0 auto;
  padding: 24px 0 80px;
}

.combat-intro h2,
.result-panel h2 {
  margin: 10px 0 8px;
  font-size: clamp(1.8rem, 4vw, 3.2rem);
  text-transform: uppercase;
  letter-spacing: -0.04em;
}

.combat-intro p,
.result-panel > p {
  color: var(--text-muted);
  font-size: 0.72rem;
  line-height: 1.6;
}

.combat-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 24px 0 32px;
}

.btn-simulate {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-height: 52px;
  padding: 12px 20px;
  border: 1px solid var(--accent-gold);
  background: linear-gradient(135deg, var(--accent-gold), var(--accent-orange));
  color: #181a1b;
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  clip-path: var(--clip-soft);
  cursor: pointer;
  touch-action: manipulation;
}

.manual-choices {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.manual-choices button {
  min-height: 44px;
  padding: 8px 12px;
  border: 1px solid var(--border-light);
  background: var(--bg-panel-strong);
  color: var(--text-soft);
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  clip-path: var(--clip-soft);
  cursor: pointer;
}

.manual-choices button:hover {
  border-color: var(--accent-gold);
  color: var(--accent-gold);
}

.combat-builds,
.result-builds {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.combat-score {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 16px;
  margin: 24px 0;
}

.score-card {
  padding: 18px;
  text-align: center;
  border: 1px solid var(--border-light);
  background: rgba(15, 20, 27, 0.9);
  clip-path: var(--clip-soft);
}

.score-card h3 {
  margin: 0 0 6px;
  font-size: 0.8rem;
  text-transform: uppercase;
  color: var(--text-muted);
}

.score-card strong {
  display: block;
  font-family: 'Syne', sans-serif;
  font-size: clamp(2rem, 5vw, 3.2rem);
  color: var(--accent-gold);
}

.score-card span {
  display: block;
  font-size: 0.55rem;
  text-transform: uppercase;
  color: var(--text-muted);
}

.score-vs {
  font-family: 'Syne', sans-serif;
  font-size: 1.4rem;
  color: var(--accent-orange);
}

.final-stat-value,
.final-stat-pair {
  color: var(--text-main);
  font-size: 0.52rem;
  line-height: 1.3;
  text-transform: uppercase;
}

.final-stat-pair {
  color: var(--accent-cyan);
}

.rules-applied-section {
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1px solid var(--border-light);
}

.rules-applied-section h4 {
  margin: 0 0 8px;
  color: var(--accent-gold);
  font-size: 0.65rem;
  text-transform: uppercase;
}

.rule-row {
  display: block;
  margin: 4px 0;
  font-size: 0.58rem;
  color: var(--text-muted);
  line-height: 1.4;
}

.rule-row small {
  color: var(--accent-cyan);
  margin-left: 4px;
}

.result-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 28px;
}

.primary-button,
.secondary-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 48px;
  padding: 10px 18px;
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  clip-path: var(--clip-soft);
  cursor: pointer;
  touch-action: manipulation;
  text-decoration: none;
}

.primary-button {
  background: linear-gradient(135deg, var(--accent-gold), var(--accent-orange));
  color: #181a1b;
  border: 0;
}

.secondary-button {
  border: 1px solid var(--border-light);
  background: var(--bg-panel-strong);
  color: var(--text-soft);
}

/* Realtime elements */
.realtime-game {
  display: grid;
  gap: 18px;
  padding-bottom: 76px;
}

.realtime-turn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 18px;
  border: 1px solid rgba(241, 212, 141, 0.45);
  background: rgba(30, 27, 20, 0.92);
}

.realtime-turn.active { border-color: rgba(84, 196, 255, 0.7); }
.realtime-turn strong { color: var(--accent-gold); font-size: clamp(0.85rem, 2vw, 1.1rem); }
.realtime-turn span { color: var(--text-muted); font-size: 0.65rem; text-transform: uppercase; }

.realtime-boards { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.realtime-board { min-width: 0; padding: 16px; border: 1px solid rgba(246, 128, 72, 0.35); background: #353033; }
.realtime-board:nth-child(2) { border-color: rgba(84, 196, 255, 0.35); background: #30363b; }
.realtime-board.is-current { box-shadow: 0 0 0 2px rgba(241, 212, 141, 0.55); }
.realtime-board > header { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
.realtime-board h2 { margin-top: 4px; font-size: clamp(1.1rem, 2vw, 1.5rem); text-transform: uppercase; }
.realtime-board > header > span { color: var(--text-muted); font-size: 0.62rem; text-transform: uppercase; }

.realtime-slots { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
.realtime-slots button { display: flex; min-width: 0; min-height: 64px; flex-direction: column; justify-content: space-between; gap: 4px; padding: 6px; border: 1px solid rgba(157, 173, 170, 0.25); background: rgba(11, 14, 18, 0.72); color: var(--text-muted); text-align: left; }
.realtime-slots button.selectable { border-color: var(--accent-gold); cursor: pointer; }
.realtime-slots button > span { overflow: hidden; color: var(--accent-gold); font-size: 0.5rem; letter-spacing: 0.08em; text-overflow: ellipsis; text-transform: uppercase; white-space: nowrap; }
.realtime-slots button strong { overflow: hidden; color: var(--text-main); font-size: 0.6rem; text-overflow: ellipsis; white-space: nowrap; }
.realtime-slots button small { overflow: hidden; color: var(--text-muted); font-size: 0.54rem; text-overflow: ellipsis; white-space: nowrap; }
.realtime-slots button.filled { border-color: rgba(246, 128, 72, 0.5); }

.realtime-draw-zone { display: grid; grid-template-columns: minmax(180px, 280px) 1fr; align-items: center; gap: 18px; padding: 14px; border: 1px dashed rgba(241, 212, 141, 0.4); margin: 10px 0; }
.realtime-drawn-card, .realtime-empty-draw { display: grid; min-height: 70px; place-items: center; margin: 6px 0; border: 1px dashed rgba(241, 212, 141, 0.5); background: rgba(17, 20, 24, 0.7); text-align: center; }
.realtime-drawn-card strong { color: var(--text-main); font-size: 0.72rem; }
.realtime-drawn-card span { color: var(--accent-gold); font-size: 0.52rem; text-transform: uppercase; }
.realtime-empty-draw { color: var(--accent-gold); font-size: 0.68rem; letter-spacing: 0.1em; }
.realtime-draw-zone button { width: 100%; min-height: 42px; padding: 0.65rem; border: 0; background: linear-gradient(135deg, var(--accent-gold), var(--accent-orange)); color: #181a1b; font-size: 0.62rem; font-weight: 700; letter-spacing: 0.1em; }
.realtime-draw-zone button:disabled { cursor: not-allowed; opacity: 0.4; }

.realtime-result { padding: 20px; border: 1px solid var(--accent-gold); }
.realtime-result h2 { margin-bottom: 8px; font-size: 1.4rem; text-transform: uppercase; }
.realtime-result p { color: var(--text-muted); font-size: 0.7rem; }

.manual-result-modal { position: fixed; inset: 0; z-index: 1000; display: grid; place-items: center; background: rgba(0, 0, 0, 0.8); padding: 16px; }
.manual-result-modal section { display: grid; gap: 10px; width: min(100%, 420px); padding: 24px; background: var(--bg-panel); border: 1px solid var(--accent-gold); }
.manual-result-modal button { min-height: 44px; padding: 10px; border: 1px solid var(--border-light); background: var(--bg-panel-strong); color: var(--text-main); font-size: 0.68rem; font-weight: 700; cursor: pointer; }

/* Responsive Media Queries */
@media (min-width: 1024px) {
  .vertical-battle-layout {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(420px, 1fr));
    align-items: start;
    gap: 24px;
  }

  .battle-center-arena {
    grid-column: 1 / -1;
  }
}

@media (min-width: 601px) and (max-width: 1023px) {
  .vertical-battle-layout {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: start;
    gap: 18px;
  }

  .vertical-battle-layout > .player-one {
    grid-column: 1;
    grid-row: 1;
  }

  .vertical-battle-layout > .player-two {
    grid-column: 2;
    grid-row: 1;
  }

  .vertical-battle-layout > .battle-center-arena {
    grid-column: 1 / -1;
    grid-row: 2;
  }

  .vertical-battle-layout > .player-three {
    grid-column: 1 / -1;
    grid-row: 3;
  }

  .category-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 900px) {
  .category-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .realtime-boards {
    grid-template-columns: 1fr;
  }

  .combat-builds,
  .result-builds {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 580px) {
  .category-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .manual-choices {
    grid-template-columns: 1fr;
  }

  .combat-score {
    grid-template-columns: 1fr;
    gap: 10px;
  }

  .score-vs {
    text-align: center;
  }

  .result-actions {
    flex-direction: column;
  }

  .result-actions button,
  .result-actions a {
    width: 100%;
  }
}
</style>
