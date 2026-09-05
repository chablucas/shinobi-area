<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import SocialHeader from '../components/SocialHeader.vue'
import { getGameLobby, startGameLobby, type GameLobby } from '../services/socialApi'
import { isTeamAuctionMode, teamAuctionGameRoute } from '../services/teamAuctionMode'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const lobby = ref<GameLobby | null>(null)
const error = ref('')
const starting = ref(false)
const joining = ref(false)
let pollTimer: ReturnType<typeof setTimeout> | undefined
let pollInFlight = false
let isMounted = false

const isTeamAuctionLobby = computed(() => isTeamAuctionMode(lobby.value?.mode))
const isHost = computed(() => Boolean(lobby.value && auth.user && lobby.value.creatorId === auth.user.id))
const isAcceptedParticipant = computed(() => Boolean(lobby.value && auth.user && lobby.value.players.some((player) => player.id === auth.user!.id && player.status === 'ACCEPTED')))
const guestCanJoin = computed(() => Boolean(isTeamAuctionLobby.value && !isHost.value && isAcceptedParticipant.value && (lobby.value!.status === 'READY' || lobby.value!.status === 'PLAYING')))

type TeamGameQuery = { path: string; query: { mode: string; gameId: string } }
function teamAuctionRoute(mode: string, gameId: string): TeamGameQuery {
  return teamAuctionGameRoute(mode as 'team-1v1' | 'team-1v1v1', gameId)
}

onMounted(async () => {
  isMounted = true
  await auth.loadCurrentUser()
  if (!auth.token) { await router.replace('/connexion'); return }
  try { await refreshLobby(); schedulePoll(); debugLobbyState() } catch (exception) { error.value = exception instanceof Error ? exception.message : 'Salon introuvable.' }
})
function debugLobbyState() {
  if (!lobby.value) return
  console.debug('[Lobby] état rendu', { route: route.fullPath, lobbyId: lobby.value.id, mode: lobby.value.mode, status: lobby.value.status, canStart: lobby.value.canStart, isHost: isHost.value, isAcceptedParticipant: isAcceptedParticipant.value, guestCanJoin: guestCanJoin.value, userId: auth.user?.id })
}
onUnmounted(() => { isMounted = false; if (pollTimer) clearTimeout(pollTimer) })
async function refreshLobby() { if (!auth.token || pollInFlight) return; pollInFlight = true; try { lobby.value = await getGameLobby(auth.token, String(route.params.id)); error.value = '' } finally { pollInFlight = false } }
function schedulePoll() { if (!isMounted || !auth.token || lobby.value?.status === 'PLAYING') return; pollTimer = setTimeout(async () => { try { await refreshLobby() } catch (exception) { error.value = exception instanceof Error ? exception.message : 'Salon indisponible.' } if (isMounted && lobby.value?.status !== 'PLAYING') schedulePoll() }, 2000) }
async function start() {
  if (!auth.token || !lobby.value || !lobby.value.canStart || lobby.value.creatorId !== auth.user?.id) return
  starting.value = true
  error.value = ''
  try {
    const currentLobby = lobby.value
    if (isTeamAuctionLobby.value) {
      await router.push(teamAuctionRoute(currentLobby.mode, currentLobby.id))
      return
    }
    const started = await startGameLobby(auth.token, currentLobby.id)
    lobby.value = started.lobby
    if (pollTimer) clearTimeout(pollTimer)
    await router.push({ path: `/partie/${started.lobby.id}`, query: { mode: started.lobby.mode } })
  } catch (exception) { error.value = exception instanceof Error ? exception.message : 'Impossible de démarrer le combat.' } finally { starting.value = false }
}
async function joinTeamAuction() {
  if (!auth.token || !lobby.value || joining.value) return
  joining.value = true
  error.value = ''
  console.debug('[Lobby] clic REJOINDRE LA PARTIE', { lobbyId: lobby.value.id, mode: lobby.value.mode })
  try {
    const currentLobby = await getGameLobby(auth.token, lobby.value.id)
    lobby.value = currentLobby
    const target = teamAuctionRoute(currentLobby.mode, currentLobby.id)
    console.debug('[Lobby] navigation vers', target)
    await router.push(target)
  } catch (exception) { error.value = exception instanceof Error ? exception.message : 'Impossible de rejoindre le salon.' } finally { joining.value = false }
}
</script>

<template>
  <main class="lobby-page"><SocialHeader /><section class="lobby-content"><p class="eyebrow">Salon de combat</p><p v-if="error" class="social-error">{{ error }}</p><template v-else-if="lobby"><h1>{{ lobby.mode }}</h1><p class="lobby-state">{{ lobby.status === 'READY' ? 'Tous les joueurs ont accepté' : lobby.status === 'PLAYING' ? 'Combat en cours' : 'En attente' }} · {{ lobby.playerCount }} / {{ lobby.expectedPlayers }} joueurs</p><div class="lobby-players"><article v-for="player in lobby.players" :key="player.isAi ? 'ai' : player.id"><strong>{{ player.displayName }}<span v-if="player.isAi" class="ai-badge">IA</span></strong><span>{{ player.status === 'ACCEPTED' ? 'Accepté' : player.status === 'REJECTED' ? 'Refusé' : 'En attente' }}</span></article></div><button v-if="lobby.canStart && lobby.creatorId === auth.user?.id" class="start-button" type="button" :disabled="starting" @click="start">{{ starting ? 'DÉMARRAGE...' : isTeamAuctionLobby ? 'LANCER LA PARTIE' : 'ENTAMER LE COMBAT' }}</button><template v-else-if="lobby.canStart"><p class="lobby-empty">{{ isTeamAuctionLobby ? 'Le salon est prêt. Rejoins la partie et attends son lancement.' : 'Le créateur peut maintenant lancer le combat.' }}</p></template><button v-if="guestCanJoin" class="start-button" type="button" :disabled="joining" @click="joinTeamAuction">{{ joining ? 'CONNEXION AU SALON...' : 'REJOINDRE LA PARTIE' }}</button><button v-if="!isTeamAuctionLobby && lobby.status === 'PLAYING'" class="start-button" type="button" @click="router.push({ path: `/partie/${lobby.id}`, query: { mode: lobby.mode } })">REJOINDRE LE COMBAT</button><p v-if="lobby.status === 'WAITING'" class="lobby-empty">La partie commencera lorsque tous les invités auront accepté.</p></template><p v-else class="lobby-empty">Chargement du salon...</p></section></main>
</template>

<style scoped>
.lobby-page { min-height: 100vh; background: var(--bg-main); }.lobby-content { max-width: 860px; margin: 0 auto; padding: 72px 20px; }.lobby-content h1 { margin: 14px 0; font-size: clamp(3rem, 8vw, 6rem); text-transform: uppercase; }.lobby-state { color: var(--accent-gold); text-transform: uppercase; }.lobby-players { display: grid; gap: 10px; max-width: 520px; margin-top: 28px; }.lobby-players article { display: flex; justify-content: space-between; gap: 16px; padding: 16px; border: 1px solid var(--border-light); background: var(--bg-panel); }.lobby-players span, .lobby-empty { color: var(--text-muted); font-size: .72rem; }.ai-badge { margin-left: 8px; padding: 2px 6px; border: 1px solid var(--border-light); color: var(--accent-gold); font-size: .6rem; }.social-error { color: var(--accent-red); }
.start-button { display: inline-block; margin-top: 28px; padding: 16px 28px; background: var(--accent-orange); color: #1a1207; border: 0; font-weight: 800; font-size: .9rem; letter-spacing: .08em; text-transform: uppercase; cursor: pointer; transition: transform .15s ease, box-shadow .15s ease; }
.start-button:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(245, 166, 35, 0.35); }
.start-button:disabled { opacity: .55; cursor: wait; }
</style>
