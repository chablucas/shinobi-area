<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import SocialHeader from '../components/SocialHeader.vue'
import { getGameLobby, startGameLobby, type GameLobby } from '../services/socialApi'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const lobby = ref<GameLobby | null>(null)
const error = ref('')
const starting = ref(false)
let pollTimer: ReturnType<typeof setInterval> | undefined

onMounted(async () => {
  await auth.loadCurrentUser()
  if (!auth.token) { await router.replace('/connexion'); return }
  try { await refreshLobby(); pollTimer = setInterval(() => { void refreshLobby() }, 5000) } catch (exception) { error.value = exception instanceof Error ? exception.message : 'Salon introuvable.' }
})
onUnmounted(() => { if (pollTimer) clearInterval(pollTimer) })
async function refreshLobby() { if (!auth.token) return; lobby.value = await getGameLobby(auth.token, String(route.params.id)) }
async function start() { if (!auth.token || !lobby.value || lobby.value.status !== 'READY' || lobby.value.creatorId !== auth.user?.id) return; starting.value = true; error.value = ''; try { const started = await startGameLobby(auth.token, lobby.value.id); lobby.value = started; await router.push({ path: `/partie/${started.id}`, query: { mode: started.mode } }) } catch (exception) { error.value = exception instanceof Error ? exception.message : 'Impossible de démarrer le combat.' } finally { starting.value = false } }
</script>

<template>
  <main class="lobby-page"><SocialHeader /><section class="lobby-content"><p class="eyebrow">Salon de combat</p><p v-if="error" class="social-error">{{ error }}</p><template v-else-if="lobby"><h1>{{ lobby.mode }}</h1><p class="lobby-state">{{ lobby.status === 'READY' ? 'Tous les joueurs ont accepté' : lobby.status === 'PLAYING' ? 'Combat en cours' : 'En attente' }}</p><div class="lobby-players"><article v-for="player in lobby.players" :key="player.isAi ? 'ai' : player.id"><strong>{{ player.displayName }}<span v-if="player.isAi" class="ai-badge">IA</span></strong><span>{{ player.status === 'ACCEPTED' ? 'Accepté' : player.status === 'REJECTED' ? 'Refusé' : 'En attente' }}</span></article></div><button v-if="lobby.status === 'READY' && lobby.creatorId === auth.user?.id" class="start-button" type="button" :disabled="starting" @click="start">{{ starting ? 'DÉMARRAGE...' : 'ENTAMER LE COMBAT' }}</button><template v-else-if="lobby.status === 'READY'"><p class="lobby-empty">Le créateur peut maintenant lancer le combat.</p></template><button v-if="lobby.status === 'PLAYING'" class="start-button" type="button" @click="router.push({ path: `/partie/${lobby.id}`, query: { mode: lobby.mode } })">REJOINDRE LE COMBAT</button><p v-if="lobby.status === 'WAITING'" class="lobby-empty">La partie commencera lorsque tous les invités auront accepté.</p></template><p v-else class="lobby-empty">Chargement du salon...</p></section></main>
</template>

<style scoped>
.lobby-page { min-height: 100vh; background: var(--bg-main); }.lobby-content { max-width: 860px; margin: 0 auto; padding: 72px 20px; }.lobby-content h1 { margin: 14px 0; font-size: clamp(3rem, 8vw, 6rem); text-transform: uppercase; }.lobby-state { color: var(--accent-gold); text-transform: uppercase; }.lobby-players { display: grid; gap: 10px; max-width: 520px; margin-top: 28px; }.lobby-players article { display: flex; justify-content: space-between; gap: 16px; padding: 16px; border: 1px solid var(--border-light); background: var(--bg-panel); }.lobby-players span, .lobby-empty { color: var(--text-muted); font-size: .72rem; }.ai-badge { margin-left: 8px; padding: 2px 6px; border: 1px solid var(--border-light); color: var(--accent-gold); font-size: .6rem; }.social-error { color: var(--accent-red); }
</style>
