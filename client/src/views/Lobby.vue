<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import SocialHeader from '../components/SocialHeader.vue'
import { getGameLobby, type GameLobby } from '../services/socialApi'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const lobby = ref<GameLobby | null>(null)
const error = ref('')

onMounted(async () => {
  await auth.loadCurrentUser()
  if (!auth.token) { await router.replace('/connexion'); return }
  try { lobby.value = await getGameLobby(auth.token, String(route.params.id)) } catch (exception) { error.value = exception instanceof Error ? exception.message : 'Salon introuvable.' }
})
</script>

<template>
  <main class="lobby-page"><SocialHeader /><section class="lobby-content"><p class="eyebrow">Salon de combat</p><p v-if="error" class="social-error">{{ error }}</p><template v-else-if="lobby"><h1>{{ lobby.mode }}</h1><p class="lobby-state">{{ lobby.status === 'READY' ? 'Tous les joueurs ont accepté' : 'En attente' }}</p><div class="lobby-players"><article v-for="player in lobby.players" :key="player.id"><strong>{{ player.displayName }}</strong><span>{{ player.status === 'ACCEPTED' ? 'Accepté' : player.status === 'REJECTED' ? 'Refusé' : 'En attente' }}</span></article></div><p v-if="lobby.status !== 'READY'" class="lobby-empty">La partie commencera lorsque tous les invités auront accepté.</p></template><p v-else class="lobby-empty">Chargement du salon...</p></section></main>
</template>

<style scoped>
.lobby-page { min-height: 100vh; background: var(--bg-main); }.lobby-content { max-width: 860px; margin: 0 auto; padding: 72px 20px; }.lobby-content h1 { margin: 14px 0; font-size: clamp(3rem, 8vw, 6rem); text-transform: uppercase; }.lobby-state { color: var(--accent-gold); text-transform: uppercase; }.lobby-players { display: grid; gap: 10px; max-width: 520px; margin-top: 28px; }.lobby-players article { display: flex; justify-content: space-between; gap: 16px; padding: 16px; border: 1px solid var(--border-light); background: var(--bg-panel); }.lobby-players span, .lobby-empty { color: var(--text-muted); font-size: .72rem; }.social-error { color: var(--accent-red); }
</style>
