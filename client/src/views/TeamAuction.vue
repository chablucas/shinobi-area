<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import SocialHeader from '../components/SocialHeader.vue'
import { useAuthStore } from '../stores/auth'
import { connectGameSocket, type GameSocket, type TeamAuctionMode, type TeamAuctionState } from '../services/realtimeApi'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const mode = computed<TeamAuctionMode>(() => {
  const value = route.query.mode
  return value === '1v1-real' || value === '1v1v1-real' ? value : '1v1-ai'
})
const modeLabel = computed(() => (mode.value === '1v1-ai' ? '1v1 IA' : mode.value === '1v1-real' ? '1v1 joueur réel' : '1v1v1 joueurs réels'))
const expectedPlayers = computed(() => (mode.value === '1v1v1-real' ? 3 : 2))

const socket = ref<GameSocket | null>(null)
const socketConnected = ref(false)
const state = ref<TeamAuctionState | null>(null)
const gameId = ref<string | null>(null)
const isHostLocal = ref(false)
const errorMessage = ref('')
const loading = ref(true)

const teamSizesArray = ref<number[]>([3, 3])
const initialBudget = ref(500)
const creating = ref(false)
const joining = ref(false)
const joinCode = ref('')

const localBidAmount = ref(10)
const configValid = computed(() => teamSizesArray.value.length > 0 && teamSizesArray.value.every((size) => Number.isInteger(size) && size > 0) && Number.isFinite(initialBudget.value) && initialBudget.value > 0)

const myId = computed(() => auth.user?.id ?? null)
const me = computed(() => state.value?.players.find((player) => player.id === myId.value) ?? null)
const isHost = computed(() => Boolean(isHostLocal.value || (state.value?.hostId !== null && state.value?.hostId === myId.value)))
const opponents = computed(() => state.value?.players.filter((player) => player.id !== myId.value) ?? [])
const isMyTurn = computed(() => Boolean(state.value && myId.value !== null && state.value.currentTurnId === myId.value))
const amWinner = computed(() => Boolean(state.value && myId.value !== null && state.value.winnerId === myId.value))
const totalCapacity = computed(() => teamSizesArray.value.reduce((sum, size) => sum + size, 0))

const bidStep = computed(() => state.value?.rules.bidUnit ?? 10)
const minBid = computed(() => state.value?.rules.minBid ?? 10)
const currentBid = computed(() => state.value?.currentBid ?? 0)
const budget = computed(() => me.value?.budget ?? 0)
const minimumNextBid = computed(() => (currentBid.value === 0 ? minBid.value : currentBid.value + bidStep.value))
const canIncrement = computed(() => localBidAmount.value + bidStep.value <= budget.value)
const canDecrement = computed(() => localBidAmount.value - bidStep.value >= minimumNextBid.value)
const canAllIn = computed(() => Boolean(state.value?.rules.allowAllIn && isMyTurn.value && Math.floor(budget.value / bidStep.value) * bidStep.value >= minimumNextBid.value))
const canBid = computed(() =>
  Number.isFinite(localBidAmount.value) &&
  localBidAmount.value >= minimumNextBid.value &&
  localBidAmount.value <= budget.value &&
  localBidAmount.value % bidStep.value === 0,
)
const bidHint = computed(() => {
  if (canBid.value) return ''
  if (!Number.isFinite(localBidAmount.value) || localBidAmount.value % bidStep.value !== 0) return `Le montant doit être un multiple de ${bidStep.value}.`
  if (localBidAmount.value <= currentBid.value) return `Le montant doit dépasser ${currentBid.value} M.`
  if (localBidAmount.value > budget.value) return 'Le montant dépasse ton budget restant.'
  return ''
})

function playerName(id: number | string | null) {
  if (id === null) return ''
  return state.value?.players.find((player) => player.id === id)?.displayName ?? String(id)
}

const currentBidderName = computed(() => playerName(state.value?.currentBidderId ?? null))
const turnStatusLabel = computed(() => {
  if (!state.value) return ''
  if (isMyTurn.value) return 'À vous de jouer'
  const turnPlayer = state.value.players.find((player) => player.id === state.value?.currentTurnId)
  if (!turnPlayer) return ''
  return turnPlayer.isAi ? `${turnPlayer.displayName} réfléchit...` : `${turnPlayer.displayName} est en train de jouer...`
})
const winnerAnnouncement = computed(() => {
  if (!state.value?.winnerId) return ''
  const winner = playerName(state.value.winnerId)
  const cardName = state.value.currentCard?.name ?? 'la carte'
  return state.value.currentBid > 0 ? `${winner} remporte ${cardName} pour ${state.value.currentBid} M` : `${winner} récupère ${cardName}`
})
const placementStatusLabel = computed(() => {
  if (amWinner.value) return ''
  if (!state.value?.winnerId) return 'Placement en cours...'
  const winnerIsAi = state.value.players.find((player) => player.id === state.value?.winnerId)?.isAi
  return winnerIsAi ? `${playerName(state.value.winnerId)} place la carte...` : 'Placement en cours...'
})

const teamsGrouped = computed(() => {
  const results = state.value?.finalResults
  if (!results) return []
  const map = new Map<number, Array<{ playerId: number | string; score: number; won: boolean }>>()
  for (const entry of results.teams) {
    const bucket = map.get(entry.teamNumber) ?? []
    bucket.push(entry)
    map.set(entry.teamNumber, bucket)
  }
  return [...map.entries()]
    .sort(([left], [right]) => left - right)
    .map(([teamNumber, entries]) => ({ teamNumber, entries: entries.sort((left, right) => right.score - left.score) }))
})
const usesTieBreak = computed(() => {
  const summary = state.value?.finalResults?.summary ?? []
  return summary.length > 1 && summary[0]?.victories === summary[1]?.victories && !state.value?.finalResults?.draw
})

function teamAverageLabel(average: number) {
  return Number.isFinite(average) && average > 0 ? average.toFixed(2) : '—'
}

watch([isMyTurn, () => state.value?.phase, minimumNextBid], ([myTurn, phase]) => {
  if (myTurn && phase === 'BIDDING') localBidAmount.value = minimumNextBid.value
})

function addTeam() {
  if (teamSizesArray.value.length < 6) teamSizesArray.value.push(3)
}
function removeTeam(index: number) {
  if (teamSizesArray.value.length > 1) teamSizesArray.value.splice(index, 1)
}

function createGame() {
  if (!socket.value) return
  creating.value = true
  errorMessage.value = ''
  socket.value.emit(
    'team-auction:create',
    { mode: mode.value, teamSizes: [...teamSizesArray.value], initialBudget: initialBudget.value },
    (response) => {
      creating.value = false
      if (response.ok && response.gameId) {
        gameId.value = response.gameId
        isHostLocal.value = true
        void router.replace({ path: '/team-game', query: { mode: mode.value, gameId: response.gameId } })
      } else {
        errorMessage.value = response.message ?? 'Création du salon impossible.'
      }
    },
  )
}

function joinGame() {
  if (!socket.value || !joinCode.value.trim()) return
  joining.value = true
  errorMessage.value = ''
  socket.value.emit('team-auction:join', joinCode.value.trim(), (response) => {
    joining.value = false
    if (response.ok && response.gameId) {
      gameId.value = response.gameId
      isHostLocal.value = false
      void router.replace({ path: '/team-game', query: { mode: mode.value, gameId: response.gameId } })
    } else {
      errorMessage.value = response.message ?? 'Impossible de rejoindre ce salon.'
    }
  })
}

function startGame() {
  if (gameId.value) socket.value?.emit('team-auction:start', gameId.value)
}
function submitBid() {
  if (gameId.value && canBid.value) socket.value?.emit('team-auction:action', { gameId: gameId.value, action: 'bid', amount: localBidAmount.value })
}
function passBid() {
  if (gameId.value) socket.value?.emit('team-auction:action', { gameId: gameId.value, action: 'pass' })
}
function allIn() {
  if (gameId.value) socket.value?.emit('team-auction:action', { gameId: gameId.value, action: 'allin' })
}
function placeCardIntoTeam(teamIndex: number) {
  if (gameId.value) socket.value?.emit('team-auction:action', { gameId: gameId.value, action: 'place', teamIndex })
}
function incrementBid() {
  if (canIncrement.value) localBidAmount.value += bidStep.value
}
function decrementBid() {
  if (canDecrement.value) localBidAmount.value -= bidStep.value
}

onMounted(async () => {
  await auth.loadCurrentUser()
  if (!auth.token) {
    await router.push('/connexion')
    return
  }
  const gameSocket = connectGameSocket(auth.token)
  socket.value = gameSocket
  gameSocket.on('connect', () => { socketConnected.value = true; errorMessage.value = '' })
  gameSocket.on('disconnect', () => { socketConnected.value = false })
  gameSocket.on('connect_error', () => { socketConnected.value = false; errorMessage.value = 'Connexion realtime impossible. Reconnexion...' })
  gameSocket.on('team-auction:state', (nextState) => { state.value = nextState; errorMessage.value = '' })
  gameSocket.on('team-auction:error', (error) => { errorMessage.value = error.message })
  const queryGameId = typeof route.query.gameId === 'string' ? route.query.gameId : ''
  if (queryGameId) {
    gameId.value = queryGameId
    gameSocket.emit('team-auction:request-state', queryGameId)
  }
  loading.value = false
})
onUnmounted(() => {
  if (gameId.value) socket.value?.emit('team-auction:leave', gameId.value)
  socket.value?.disconnect()
})
</script>

<template>
  <main class="ta-shell">
    <SocialHeader />
    <div class="ta-container">
      <header class="ta-header">
        <p class="kicker"><span class="kicker-dot"></span>Jeu d’équipe</p>
        <h1>Team Auction — {{ modeLabel }}</h1>
        <p class="ta-status">{{ socketConnected ? 'Realtime connecté' : loading ? 'Connexion...' : 'Realtime en reconnexion...' }}</p>
        <p v-if="errorMessage" class="ta-error">{{ errorMessage }}</p>
      </header>

      <section v-if="!state || state.phase === 'LOBBY'" class="ta-setup">
        <div v-if="!gameId" class="ta-panel">
          <h2>Configuration</h2>
          <div class="ta-team-list">
            <div v-for="(size, index) in teamSizesArray" :key="index" class="ta-team-row">
              <label>Équipe {{ index + 1 }}</label>
              <input type="number" min="1" max="20" v-model.number="teamSizesArray[index]" />
              <button type="button" class="ta-remove" :disabled="teamSizesArray.length <= 1" @click="removeTeam(index)">×</button>
            </div>
            <button type="button" class="ta-add" @click="addTeam">+ Ajouter une équipe</button>
          </div>
          <label class="ta-budget-label">
            Budget initial
            <input type="number" min="10" step="10" v-model.number="initialBudget" />
          </label>
          <p class="ta-recap">{{ teamSizesArray.length }} équipes · {{ totalCapacity }} cartes au total par joueur · budget {{ initialBudget }} M</p>
          <button type="button" class="cta-sub-btn primary" :disabled="creating || !configValid" @click="createGame">
            {{ creating ? 'Création...' : mode === '1v1-ai' ? 'Lancer la partie' : 'Créer le salon' }}
          </button>
          <template v-if="mode !== '1v1-ai'">
            <div class="ta-divider">ou</div>
            <label class="ta-join-label">
              Code du salon
              <input type="text" v-model="joinCode" placeholder="Code reçu" />
            </label>
            <button type="button" class="cta-sub-btn secondary" :disabled="!joinCode.trim() || joining" @click="joinGame">
              {{ joining ? 'Connexion...' : 'Rejoindre' }}
            </button>
          </template>
        </div>

        <div v-else class="ta-panel ta-lobby">
          <h2>Salon Team Auction</h2>
          <p class="ta-room-code">Code : <strong>{{ gameId }}</strong></p>
          <p class="ta-recap">{{ state?.teamSizes.length ?? teamSizesArray.length }} équipes · tailles {{ (state?.teamSizes ?? teamSizesArray).join(' / ') }} · budget {{ state?.initialBudget ?? initialBudget }} M</p>
          <ul class="ta-player-list">
            <li v-for="player in state?.players ?? []" :key="String(player.id)">{{ player.displayName }}<span v-if="player.isAi"> (IA)</span></li>
          </ul>
          <p class="ta-recap">{{ state?.players.length ?? 0 }} / {{ expectedPlayers }} joueurs · {{ expectedPlayers - (state?.players.length ?? 0) }} place(s) restante(s)</p>
          <button v-if="isHost" type="button" class="cta-sub-btn primary" :disabled="(state?.players.length ?? 0) < expectedPlayers" @click="startGame">
            Lancer la partie
          </button>
          <p v-else class="ta-status">En attente de l’hôte...</p>
        </div>
      </section>

      <section v-else class="ta-game">
        <div class="ta-teams-panel ta-teams-mine">
          <h3>Mes équipes</h3>
          <div v-for="team in me?.teams ?? []" :key="team.teamNumber" class="ta-team-block" :class="{ complete: team.cards.length >= team.capacity }">
            <p class="ta-team-title">Équipe {{ team.teamNumber }} — {{ team.cards.length }}/{{ team.capacity }} · reste {{ team.capacity - team.cards.length }} · moy. {{ teamAverageLabel(team.average) }}<span v-if="team.cards.length >= team.capacity"> COMPLÈTE</span></p>
            <ul class="ta-team-cards">
              <li v-for="card in team.cards" :key="card.id"><img v-if="card.imageUrl" :src="card.imageUrl" :alt="card.name" />{{ card.name }}</li>
            </ul>
          </div>
        </div>

        <div class="ta-center-panel">
          <template v-if="state?.phase === 'DRAW'">
            <p class="ta-status">Nouvelle carte en préparation...</p>
          </template>

          <template v-else-if="state?.phase === 'BIDDING' && state.currentCard">
            <div class="ta-card-reveal">
              <div class="ta-current-image">
                <img v-if="state.currentCard.imageUrl" :src="state.currentCard.imageUrl" :alt="state.currentCard.name" />
                <span v-else>{{ state.currentCard.name.slice(0, 1) }}</span>
              </div>
              <h2>{{ state.currentCard.name }}</h2>
              <p class="ta-rarity">{{ state.currentCard.rarity }} · Note {{ state.currentCard.rarityScore }}</p>
            </div>
            <div class="ta-bid-info">
              <p>Meilleure enchère : <strong>{{ state.currentBid }} M</strong><span v-if="currentBidderName"> — {{ currentBidderName }}</span></p>
              <p class="ta-turn-status">{{ turnStatusLabel }}</p>
            </div>
            <ul class="ta-player-status">
              <li v-for="player in state.players" :key="String(player.id)" :class="{ passed: player.passedCurrentRound, active: player.id === state.currentTurnId }">
                {{ player.displayName }} — {{ player.budget }} M
                <span v-if="player.passedCurrentRound"> · PASSÉ</span>
                <span v-else-if="player.id === state.currentTurnId"> · ACTIF</span>
              </li>
            </ul>

            <div v-if="isMyTurn" class="ta-bid-controls">
              <div class="ta-amount-field">
                <button type="button" @click="decrementBid" :disabled="!canDecrement">−</button>
                <input type="number" v-model.number="localBidAmount" :step="bidStep" />
                <button type="button" @click="incrementBid" :disabled="!canIncrement">+</button>
              </div>
              <p v-if="bidHint" class="ta-bid-hint">{{ bidHint }}</p>
              <div class="ta-bid-actions">
                <button type="button" class="cta-sub-btn primary" :disabled="!canBid" @click="submitBid">PARIER</button>
                <button type="button" class="cta-sub-btn secondary" :disabled="!canAllIn" @click="allIn">ALL-IN</button>
                <button type="button" class="cta-sub-btn ghost" @click="passBid">PASSER</button>
              </div>
            </div>
            <p v-else class="ta-status">{{ turnStatusLabel }}</p>
          </template>

          <template v-else-if="state?.phase === 'PLACEMENT'">
            <p v-if="state.winnerId" class="ta-status ta-winner-banner">{{ winnerAnnouncement }}</p>
            <template v-if="amWinner">
              <p class="ta-status">Choisis l’équipe qui recevra la carte.</p>
              <div class="ta-placement-grid">
                <button
                  v-for="team in me?.teams ?? []"
                  :key="team.teamNumber"
                  type="button"
                  class="ta-team-block ta-team-pick"
                  :disabled="team.cards.length >= team.capacity"
                  @click="placeCardIntoTeam(team.teamNumber - 1)"
                >
                  Équipe {{ team.teamNumber }} — {{ team.cards.length }}/{{ team.capacity }} · moy. {{ teamAverageLabel(team.average) }}<span v-if="team.cards.length >= team.capacity"> COMPLÈTE</span>
                </button>
              </div>
            </template>
            <p v-else class="ta-status">{{ placementStatusLabel }}</p>
          </template>

          <template v-else-if="state?.phase === 'RESULTS' || state?.phase === 'FINISHED'">
            <h2>Résultats finaux</h2>
            <div v-if="!state.finalResults" class="ta-status">Calcul des résultats...</div>
            <template v-else>
              <div v-for="teamGroup in teamsGrouped" :key="teamGroup.teamNumber" class="ta-result-team">
                <h3>Équipe {{ teamGroup.teamNumber }}</h3>
                <p v-for="entry in teamGroup.entries" :key="String(entry.playerId)" :class="{ won: entry.won }">
                  {{ playerName(entry.playerId) }} : {{ entry.score.toFixed(2) }}<span v-if="entry.won"> → gagne</span>
                </p>
              </div>
              <div class="ta-result-summary">
                <p v-for="entry in state.finalResults.summary" :key="String(entry.playerId)">
                  {{ playerName(entry.playerId) }} : {{ entry.victories }} équipe(s) gagnée(s) · total {{ entry.totalTeamScore.toFixed(2) }}
                </p>
                <p v-if="usesTieBreak" class="ta-status">Égalité aux équipes, départage au total des notes.</p>
                <p class="ta-final-winner">{{ state.finalResults.draw ? 'ÉGALITÉ' : `VAINQUEUR : ${playerName(state.finalResults.winnerId)}` }}</p>
              </div>
            </template>
          </template>
        </div>

        <div class="ta-teams-panel ta-teams-opponents">
          <h3>Équipes adverses</h3>
          <div v-for="opponent in opponents" :key="String(opponent.id)" class="ta-opponent-block">
            <p class="ta-opponent-name">{{ opponent.displayName }}<span v-if="opponent.isAi"> (IA)</span> · {{ opponent.budget }} M</p>
            <div v-for="team in opponent.teams" :key="team.teamNumber" class="ta-team-block" :class="{ complete: team.cards.length >= team.capacity }">
              <p class="ta-team-title">Équipe {{ team.teamNumber }} — {{ team.cards.length }}/{{ team.capacity }} · reste {{ team.capacity - team.cards.length }} · moy. {{ teamAverageLabel(team.average) }}</p>
              <ul class="ta-team-cards">
                <li v-for="card in team.cards" :key="card.id"><img v-if="card.imageUrl" :src="card.imageUrl" :alt="card.name" />{{ card.name }}</li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </div>
  </main>
</template>

<style scoped>
.ta-shell {
  min-height: 100vh;
  background: var(--bg-main);
}

.ta-container {
  max-width: 1320px;
  margin: 0 auto;
  padding: 24px 16px 60px;
  box-sizing: border-box;
}

.ta-header {
  margin-bottom: 24px;
}

.ta-header h1 {
  font-size: clamp(1.4rem, 3vw, 2.2rem);
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: -0.02em;
  margin: 0 0 8px;
}

.ta-error {
  color: var(--accent-red);
  font-size: 0.8rem;
}

.ta-panel {
  padding: 28px;
  border: 1px solid var(--border-light);
  background: var(--bg-panel-soft);
  clip-path: var(--clip-soft);
  max-width: 520px;
}

.ta-team-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.ta-team-row label {
  flex: 1;
  color: var(--text-muted);
  font-size: 0.78rem;
}

.ta-team-row input {
  width: 70px;
}

input[type='number'],
input[type='text'] {
  background: var(--bg-panel-strong);
  border: 1px solid var(--border-light);
  color: #f3f5f2;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
}

.ta-remove {
  background: none;
  border: 1px solid var(--border-light);
  color: var(--accent-red);
  border-radius: var(--radius-sm);
  width: 28px;
  height: 28px;
  cursor: pointer;
}

.ta-add {
  background: none;
  border: 1px dashed var(--border-light);
  color: var(--accent-gold);
  border-radius: var(--radius-sm);
  padding: 6px 12px;
  cursor: pointer;
  margin-top: 4px;
}

.ta-budget-label,
.ta-join-label {
  display: block;
  margin: 16px 0;
  font-size: 0.78rem;
  color: var(--text-muted);
}

.ta-budget-label input,
.ta-join-label input {
  display: block;
  margin-top: 6px;
  width: 100%;
  box-sizing: border-box;
}

.ta-recap {
  color: var(--text-muted);
  font-size: 0.74rem;
  margin: 12px 0;
}

.ta-divider {
  text-align: center;
  color: var(--text-muted);
  font-size: 0.7rem;
  margin: 16px 0;
  text-transform: uppercase;
}

.ta-room-code strong {
  color: var(--accent-gold);
  letter-spacing: 0.05em;
}

.ta-player-list {
  list-style: none;
  margin: 12px 0;
  padding: 0;
  font-size: 0.85rem;
}

.ta-status {
  color: var(--text-muted);
  font-size: 0.85rem;
}

.ta-winner-banner {
  color: var(--accent-gold);
  font-weight: 700;
  font-size: 1rem;
}

.ta-game {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.6fr) minmax(0, 1fr);
  gap: 20px;
  align-items: start;
}

.ta-teams-panel,
.ta-center-panel {
  border: 1px solid var(--border-light);
  background: var(--bg-panel-soft);
  clip-path: var(--clip-soft);
  padding: 20px;
}

.ta-team-block {
  border: 1px solid var(--border-light);
  border-radius: var(--radius-sm);
  padding: 10px 12px;
  margin-bottom: 10px;
  background: var(--bg-panel-strong);
}

.ta-team-block.complete {
  border-color: var(--accent-green);
}

.ta-team-title {
  font-size: 0.78rem;
  color: var(--text-muted);
  margin: 0 0 6px;
}

.ta-team-cards {
  list-style: none;
  margin: 0;
  padding: 0;
  font-size: 0.78rem;
}

.ta-team-cards li {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 28px;
}

.ta-team-cards img {
  width: 24px;
  height: 24px;
  border-radius: var(--radius-sm);
  object-fit: cover;
  border: 1px solid var(--border-light);
}

.ta-opponent-name {
  font-weight: 700;
  margin: 12px 0 6px;
}

.ta-card-reveal {
  text-align: center;
  margin-bottom: 16px;
}

.ta-current-image {
  width: min(260px, 70vw);
  aspect-ratio: 3 / 4;
  margin: 0 auto 14px;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--bg-panel-strong);
  display: grid;
  place-items: center;
}

.ta-current-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.ta-current-image span {
  font-size: 4rem;
  color: var(--accent-gold);
  font-weight: 800;
}

.ta-rarity {
  color: var(--accent-gold);
  font-size: 0.8rem;
}

.ta-bid-info {
  text-align: center;
  margin-bottom: 12px;
}

.ta-turn-status {
  color: var(--accent-blue);
  font-size: 0.82rem;
}

.ta-player-status {
  list-style: none;
  margin: 0 0 16px;
  padding: 0;
  font-size: 0.8rem;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: center;
}

.ta-player-status li.passed {
  color: var(--accent-red);
  opacity: 0.7;
}

.ta-player-status li.active {
  color: var(--accent-gold);
  font-weight: 700;
}

.ta-bid-controls {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.ta-amount-field {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ta-amount-field input {
  width: 100px;
  text-align: center;
  font-size: 1rem;
}

.ta-amount-field button {
  width: 40px;
  height: 40px;
  font-size: 1.2rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-light);
  background: var(--bg-panel-strong);
  color: #f3f5f2;
  cursor: pointer;
}

.ta-bid-hint {
  color: var(--accent-red);
  font-size: 0.72rem;
}

.ta-bid-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: center;
}

.ta-placement-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
}

.ta-team-pick {
  cursor: pointer;
  text-align: left;
  color: #f3f5f2;
}

.ta-team-pick:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ta-result-team {
  margin-bottom: 16px;
}

.ta-result-team p.won {
  color: var(--accent-gold);
  font-weight: 700;
}

.ta-result-summary {
  border-top: 1px solid var(--border-light);
  padding-top: 12px;
  margin-top: 12px;
}

.ta-final-winner {
  font-size: 1.1rem;
  font-weight: 800;
  color: var(--accent-gold);
  margin-top: 10px;
}

.cta-sub-btn.ghost {
  background: none;
  border: 1px solid var(--border-light);
  color: var(--text-muted);
}

@media (max-width: 960px) {
  .ta-game {
    grid-template-columns: 1fr;
  }

  .ta-teams-panel {
    order: 2;
  }

  .ta-center-panel {
    order: 1;
  }

  .ta-teams-opponents {
    order: 3;
  }
}

@media (max-width: 600px) {
  .ta-container {
    padding: 16px 12px 40px;
  }

  .ta-panel {
    max-width: none;
    padding: 20px;
  }

  .ta-amount-field input {
    width: 80px;
  }

  .ta-bid-actions {
    flex-direction: column;
    width: 100%;
  }

  .ta-bid-actions button {
    width: 100%;
  }
}
</style>
