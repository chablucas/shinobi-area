<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { acceptFriendRequest, acceptGameInvite, listFriendRequests, listGameInvites, rejectFriendRequest, rejectGameInvite, searchGlobal, sendFriendRequest, type FriendRequest, type GameInvite, type SearchResult } from '../services/socialApi'

const auth = useAuthStore()
const router = useRouter()
const query = ref('')
const results = ref<SearchResult>({ players: [], shinobis: [] })
const requests = ref<FriendRequest[]>([])
const gameInvites = ref<GameInvite[]>([])
const open = ref(false)
const notificationsOpen = ref(false)
const loading = ref(false)
let searchTimer: ReturnType<typeof setTimeout> | undefined
let notificationTimer: ReturnType<typeof setTimeout> | undefined
let notificationRefreshInFlight = false
let isMounted = false

async function refreshNotifications() {
  if (!auth.token || notificationRefreshInFlight) return
  notificationRefreshInFlight = true
  try {
    const [nextRequests, nextInvites] = await Promise.all([
      listFriendRequests(auth.token, 'received'),
      listGameInvites(auth.token),
    ])
    requests.value = nextRequests
    gameInvites.value = nextInvites
  } catch {
    // Notifications are auxiliary; a transient network error must not disrupt navigation.
  } finally {
    notificationRefreshInFlight = false
  }
}

function scheduleNotificationRefresh() {
  clearTimeout(notificationTimer)
  if (!isMounted || !auth.token) return
  notificationTimer = setTimeout(async () => {
    await refreshNotifications()
    if (isMounted) scheduleNotificationRefresh()
  }, 2500)
}

onMounted(async () => {
  isMounted = true
  await refreshNotifications()
  scheduleNotificationRefresh()
})
onUnmounted(() => {
  isMounted = false
  clearTimeout(searchTimer)
  clearTimeout(notificationTimer)
})

watch(query, (value) => {
  clearTimeout(searchTimer)
  if (!value.trim() || !auth.token) { results.value = { players: [], shinobis: [] }; open.value = false; return }
  searchTimer = setTimeout(async () => {
    if (!auth.token) return
    loading.value = true
    try { results.value = await searchGlobal(auth.token, value); open.value = true } finally { loading.value = false }
  }, 220)
})

function publicProfile(id: number) { open.value = false; void router.push(`/profil-public/${id}`) }
async function addFriend(id: number) { if (!auth.token) return; await sendFriendRequest(auth.token, id); const player = results.value.players.find((item) => item.id === id); if (player) { player.friendshipStatus = 'PENDING'; player.friendshipDirection = 'sent' } }
async function acceptSearchRequest(player: SearchResult['players'][number]) { if (!auth.token || !player.friendshipRequestId) return; await acceptFriendRequest(auth.token, player.friendshipRequestId); player.friendshipStatus = 'ACCEPTED'; player.friendshipDirection = null }
async function answer(request: FriendRequest, accepted: boolean) { if (!auth.token) return; requests.value = requests.value.filter((item) => item.id !== request.id); try { if (accepted) await acceptFriendRequest(auth.token, request.id); else await rejectFriendRequest(auth.token, request.id) } finally { await refreshNotifications() } }
async function answerGameInvite(invite: GameInvite, accepted: boolean) { if (!auth.token) return; gameInvites.value = gameInvites.value.filter((item) => item.id !== invite.id); try { const lobby = accepted ? await acceptGameInvite(auth.token, invite.id) : await rejectGameInvite(auth.token, invite.id); if (accepted) void router.push(`/lobby/${lobby.id}`) } finally { await refreshNotifications() } }
function statusLabel(player: SearchResult['players'][number]) { if (player.friendshipStatus === 'ACCEPTED') return 'AMI'; if (player.friendshipDirection === 'received') return 'ACCEPTER'; if (player.friendshipStatus === 'PENDING') return 'DEMANDE ENVOYÉE'; return 'AJOUTER EN AMI' }
</script>

<template>
  <nav class="social-header" aria-label="Navigation principale">
    <a class="social-brand" href="/" aria-label="Shinobi Area, accueil"><img src="/logo.png" alt="" aria-hidden="true" /></a>
    <div class="header-links"><a href="/personnages">Personnages</a><a href="/regles">Règles</a></div>
    <div v-if="auth.isAuthenticated" class="global-search">
      <input v-model="query" type="search" placeholder="Rechercher un joueur ou un shinobi..." aria-label="Recherche globale" @focus="open = !!query.trim()" />
      <div v-if="open" class="search-dropdown">
        <p v-if="loading" class="social-muted">Recherche...</p>
        <template v-else>
          <section v-if="results.players.length" class="search-section"><strong>JOUEURS</strong><button v-for="player in results.players" :key="player.id" type="button" class="search-row" @click="publicProfile(player.id)"><span class="social-avatar">{{ player.displayName.slice(0, 1) }}</span><span class="search-name">{{ player.displayName }}</span><span class="search-action" role="button" tabindex="0" @click.stop="player.friendshipDirection === 'received' ? acceptSearchRequest(player) : player.friendshipStatus === null ? addFriend(player.id) : undefined">{{ statusLabel(player) }}</span></button></section>
          <section v-if="results.shinobis.length" class="search-section"><strong>SHINOBIS</strong><button v-for="shinobi in results.shinobis" :key="shinobi.id" type="button" class="search-row" @click="open = false; void router.push(`/cartes/${shinobi.slug}`)"><span class="search-card-image"><img v-if="shinobi.imageUrl" :src="shinobi.imageUrl" :alt="shinobi.name" /></span><span class="search-name">{{ shinobi.name }}</span></button></section>
          <p v-if="!results.players.length && !results.shinobis.length" class="social-muted">Aucun résultat.</p>
        </template>
      </div>
    </div>
    <div class="social-actions">
      <button v-if="auth.isAuthenticated" class="notification-button" type="button" aria-label="Notifications" @click="notificationsOpen = !notificationsOpen">◉<span v-if="requests.length + gameInvites.length" class="notification-badge">{{ requests.length + gameInvites.length }}</span></button>
      <a class="social-profile-link" :href="auth.isAuthenticated ? '/profil' : '/connexion'">{{ auth.isAuthenticated ? 'Profil' : 'Connexion' }}</a>
    </div>
    <div v-if="notificationsOpen" class="notifications-panel"><strong>NOTIFICATIONS</strong><p v-if="!requests.length && !gameInvites.length" class="social-muted">Aucune notification.</p><article v-for="request in requests" :key="`friend-${request.id}`"><button type="button" @click="publicProfile(request.sender.id)">{{ request.sender.displayName }}</button><span>demande à devenir ton ami</span><div><button type="button" @click="answer(request, true)">ACCEPTER</button><button type="button" @click="answer(request, false)">REFUSER</button></div></article><article v-for="invite in gameInvites" :key="`game-${invite.id}`"><span><b>{{ invite.creator.displayName }}</b> vous défie en {{ invite.mode }}</span><div><button type="button" @click="answerGameInvite(invite, true)">ACCEPTER</button><button type="button" @click="answerGameInvite(invite, false)">REFUSER</button></div></article></div>
  </nav>
</template>

<style scoped>
.header-links { display: flex; flex: 0 0 auto; gap: 6px; }.header-links a { padding: .7rem .65rem; color: #2b2113; font-size: .58rem; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; border-bottom: 2px solid transparent; }.header-links a:hover, .header-links a:focus-visible { border-color: #2b2113; }
.social-header { position: relative; z-index: 10; display: flex; align-items: center; gap: 18px; min-height: 78px; padding: 10px max(20px, calc((100vw - 1320px) / 2)); background: var(--accent-orange); }
.social-brand { flex: 0 0 auto; }.social-brand img { width: auto; height: 52px; }.global-search { position: relative; flex: 1; max-width: 620px; margin: 0 auto; }.global-search input { width: 100%; min-height: 42px; padding: 0 14px; border: 1px solid rgba(43,33,19,.45); background: #fff0bd; color: #2b2113; outline: none; }.global-search input::placeholder { color: #756542; }.search-dropdown, .notifications-panel { position: absolute; top: calc(100% + 8px); width: min(100%, 560px); padding: 12px; border: 1px solid var(--border-strong); background: var(--bg-panel); box-shadow: var(--shadow-dark); }.search-dropdown { left: 0; }.search-section + .search-section { margin-top: 12px; }.search-section > strong, .notifications-panel > strong { display: block; padding: 6px 8px; color: var(--accent-gold); font-size: .58rem; letter-spacing: .12em; }.search-row { display: flex; align-items: center; gap: 9px; width: 100%; padding: 8px; border: 0; border-top: 1px solid var(--border-light); background: transparent; color: var(--text-main); text-align: left; }.search-row:hover { background: var(--bg-panel-strong); }.social-avatar, .search-card-image { display: grid; place-items: center; flex: 0 0 32px; width: 32px; height: 32px; background: var(--accent-orange); color: #2b2113; font-size: .72rem; font-weight: 700; }.search-card-image img { width: 100%; height: 100%; object-fit: cover; }.search-name { flex: 1; font-size: .67rem; }.search-action { color: var(--accent-gold); font-size: .52rem; white-space: nowrap; }.social-actions { display: flex; align-items: center; gap: 8px; margin-left: auto; }.social-profile-link, .notification-button { min-height: 42px; padding: .75rem 1rem; border: 1px solid rgba(76,48,15,.42); background: #2b2113; color: #fff0bd; text-transform: uppercase; font-size: .6rem; font-weight: 700; }.notification-button { position: relative; padding-inline: .8rem; }.notification-badge { position: absolute; top: -7px; right: -7px; display: grid; place-items: center; width: 18px; height: 18px; border-radius: 50%; background: var(--accent-red); color: white; font-size: .55rem; }.notifications-panel { right: 20px; width: min(360px, calc(100vw - 40px)); }.notifications-panel article { display: grid; gap: 7px; padding: 12px 8px; border-top: 1px solid var(--border-light); color: var(--text-muted); font-size: .62rem; }.notifications-panel article > button { width: max-content; padding: 0; border: 0; background: transparent; color: var(--text-main); font-weight: 700; }.notifications-panel article div { display: flex; gap: 6px; }.notifications-panel article div button { padding: 7px; border: 1px solid var(--border-light); background: var(--accent-orange); color: #2b2113; font-size: .54rem; font-weight: 700; }.social-muted { padding: 10px 8px; color: var(--text-muted); font-size: .62rem; }
@media (max-width: 720px) { .social-header { flex-wrap: wrap; gap: 8px; }.social-brand img { height: 44px; }.global-search { order: 3; flex-basis: 100%; max-width: none; }.social-actions { margin-left: auto; }.social-header { padding-bottom: 12px; } }
@media (max-width: 520px) { .header-links { order: 2; }.header-links a { padding-inline: .35rem; font-size: .5rem; }.social-actions { margin-left: auto; } }
</style>
