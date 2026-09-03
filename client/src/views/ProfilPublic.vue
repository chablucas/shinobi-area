<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import SocialHeader from '../components/SocialHeader.vue'
import { getPublicUser, listFriends, type Friend, type PublicUser, type ChallengeMode } from '../services/socialApi'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const profile = ref<PublicUser | null>(null)
const friends = ref<Friend[]>([])
const selectedMode = ref<ChallengeMode | null>(null)
const error = ref('')

onMounted(async () => {
  await auth.loadCurrentUser()
  if (!auth.token) { await router.replace('/connexion'); return }
  try { profile.value = await getPublicUser(auth.token, Number(route.params.id)); friends.value = await listFriends(auth.token) } catch (exception) { error.value = exception instanceof Error ? exception.message : 'Profil introuvable.' }
})

function chooseMode(mode: ChallengeMode) { selectedMode.value = mode }
function chooseThirdPlayer(friend: Friend) { if (profile.value) void router.push({ path: `/profil-public/${profile.value.id}`, query: { mode: '1v1v1', opponent: String(friend.id), third: String(friend.id) } }) }
</script>

<template>
  <main class="public-profile-page">
    <SocialHeader />
    <section class="public-profile-content">
      <p class="eyebrow">Dossier public</p>
      <p v-if="error" class="social-error">{{ error }}</p>
      <article v-else-if="profile" class="public-profile-card">
        <div class="public-avatar">{{ profile.displayName.slice(0, 1) }}</div>
        <p class="eyebrow">Joueur</p><h1>{{ profile.displayName }}</h1>
        <p class="friendship-state">{{ profile.friendshipStatus === 'ACCEPTED' ? 'AMI' : profile.friendshipStatus === 'PENDING' ? 'DEMANDE EN COURS' : 'PAS ENCORE AMI' }}</p>
        <div v-if="profile.friendshipStatus === 'ACCEPTED'" class="challenge-area">
          <p class="eyebrow">Défi</p>
          <div v-if="!selectedMode" class="challenge-buttons"><button type="button" @click="chooseMode('1v1')">DÉFIER · 1V1</button><button type="button" @click="chooseMode('1v1v1')">DÉFIER · 1V1V1</button></div>
          <div v-else-if="selectedMode === '1v1'" class="challenge-confirm"><strong>COMBAT 1V1</strong><p>Moi <b>VS</b> {{ profile.displayName }}</p><button type="button" disabled>ENVOYER L’INVITATION · ÉTAPE 3</button></div>
          <div v-else class="challenge-confirm"><strong>CHOISIR LE TROISIÈME JOUEUR</strong><button v-for="friend in friends.filter((item) => item.id !== profile?.id && item.id !== auth.user?.id)" :key="friend.id" type="button" @click="chooseThirdPlayer(friend)">{{ friend.displayName }}</button><p v-if="!friends.some((item) => item.id !== profile?.id && item.id !== auth.user?.id)">Aucun ami disponible.</p></div>
        </div>
      </article>
    </section>
  </main>
</template>

<style scoped>
.public-profile-page { min-height: 100vh; background: var(--bg-main); }.public-profile-content { max-width: 860px; margin: 0 auto; padding: 72px 20px; }.public-profile-card { max-width: 520px; margin: 24px auto 0; padding: 36px; border: 1px solid var(--border-strong); background: var(--bg-panel); text-align: center; clip-path: var(--clip-soft); }.public-avatar { display: grid; place-items: center; width: 120px; height: 120px; margin: 0 auto 24px; background: var(--accent-orange); color: #2b2113; font: 700 3rem 'Syne', sans-serif; clip-path: var(--clip-strong); }.public-profile-card h1 { margin: 12px 0; font-size: clamp(2rem, 6vw, 4rem); text-transform: uppercase; }.friendship-state { color: var(--accent-gold); font-size: .65rem; letter-spacing: .12em; }.challenge-area { margin-top: 32px; padding-top: 22px; border-top: 1px solid var(--border-light); }.challenge-buttons, .challenge-confirm { display: grid; gap: 9px; margin-top: 14px; }.challenge-buttons button, .challenge-confirm button { padding: 12px; border: 1px solid var(--border-light); background: var(--accent-orange); color: #2b2113; font-size: .6rem; font-weight: 700; }.challenge-confirm { color: var(--text-soft); font-size: .72rem; }.challenge-confirm b { margin: 0 10px; color: var(--accent-orange); }.challenge-confirm button:disabled { opacity: .65; }.social-error { color: var(--accent-red); }
</style>
