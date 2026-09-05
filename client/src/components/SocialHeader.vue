<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import {
  acceptFriendRequest,
  acceptGameInvite,
  listFriendRequests,
  listGameInvites,
  rejectFriendRequest,
  rejectGameInvite,
  searchGlobal,
  sendFriendRequest,
  type FriendRequest,
  type GameInvite,
  type SearchResult,
} from '../services/socialApi'
import MobileSidebar from './MobileSidebar.vue'

const auth = useAuthStore()
const router = useRouter()
const query = ref('')
const results = ref<SearchResult>({ players: [], shinobis: [] })
const requests = ref<FriendRequest[]>([])
const gameInvites = ref<GameInvite[]>([])
const open = ref(false)
const notificationsOpen = ref(false)
const sidebarOpen = ref(false)
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

function handleBrandClick(event: MouseEvent) {
  if (typeof window !== 'undefined' && window.innerWidth <= 1024) {
    event.preventDefault()
    sidebarOpen.value = true
  }
}

function publicProfile(id: number) { open.value = false; void router.push(`/profil-public/${id}`) }
async function addFriend(id: number) { if (!auth.token) return; await sendFriendRequest(auth.token, id); const player = results.value.players.find((item) => item.id === id); if (player) { player.friendshipStatus = 'PENDING'; player.friendshipDirection = 'sent' } }
async function acceptSearchRequest(player: SearchResult['players'][number]) { if (!auth.token || !player.friendshipRequestId) return; await acceptFriendRequest(auth.token, player.friendshipRequestId); player.friendshipStatus = 'ACCEPTED'; player.friendshipDirection = null }
async function answer(request: FriendRequest, accepted: boolean) { if (!auth.token) return; requests.value = requests.value.filter((item) => item.id !== request.id); try { if (accepted) await acceptFriendRequest(auth.token, request.id); else await rejectFriendRequest(auth.token, request.id) } finally { await refreshNotifications() } }
async function answerGameInvite(invite: GameInvite, accepted: boolean) { if (!auth.token) return; gameInvites.value = gameInvites.value.filter((item) => item.id !== invite.id); try { const lobby = accepted ? await acceptGameInvite(auth.token, invite.id) : await rejectGameInvite(auth.token, invite.id); if (accepted) void router.push(`/lobby/${lobby.id}`) } finally { await refreshNotifications() } }
function statusLabel(player: SearchResult['players'][number]) { if (player.friendshipStatus === 'ACCEPTED') return 'AMI'; if (player.friendshipDirection === 'received') return 'ACCEPTER'; if (player.friendshipStatus === 'PENDING') return 'DEMANDE ENVOYÉE'; return 'AJOUTER EN AMI' }
</script>

<template>
  <nav class="social-header" aria-label="Navigation principale">
    <a
      class="social-brand"
      href="/"
      aria-label="Shinobi Area, ouvrir le menu ou accueil"
      @click="handleBrandClick"
    >
      <img src="/logo.png" alt="Logo Shinobi Area" />
      <span class="mobile-menu-indicator" aria-hidden="true">
        <span class="indicator-bar"></span>
        <span class="indicator-bar"></span>
        <span class="indicator-bar"></span>
      </span>
    </a>

    <div class="header-links desktop-only">
      <a href="/personnages">Cartes</a>
      <a href="/jouer">Créer</a>
      <a href="/partie">Combat</a>
      <a href="/regles">Règles</a>
    </div>

    <div v-if="auth.isAuthenticated" class="global-search">
      <input
        v-model="query"
        type="search"
        placeholder="Rechercher un joueur ou un shinobi..."
        aria-label="Recherche globale"
        @focus="open = !!query.trim()"
      />
      <div v-if="open" class="search-dropdown">
        <p v-if="loading" class="social-muted">Recherche...</p>
        <template v-else>
          <section v-if="results.players.length" class="search-section">
            <strong>JOUEURS</strong>
            <button
              v-for="player in results.players"
              :key="player.id"
              type="button"
              class="search-row"
              @click="publicProfile(player.id)"
            >
              <span class="social-avatar">{{ player.displayName.slice(0, 1) }}</span>
              <span class="search-name">{{ player.displayName }}</span>
              <span
                class="search-action"
                role="button"
                tabindex="0"
                @click.stop="
                  player.friendshipDirection === 'received'
                    ? acceptSearchRequest(player)
                    : player.friendshipStatus === null
                      ? addFriend(player.id)
                      : undefined
                "
              >
                {{ statusLabel(player) }}
              </span>
            </button>
          </section>
          <section v-if="results.shinobis.length" class="search-section">
            <strong>SHINOBIS</strong>
            <button
              v-for="shinobi in results.shinobis"
              :key="shinobi.id"
              type="button"
              class="search-row"
              @click="open = false; void router.push(`/cartes/${shinobi.slug}`)"
            >
              <span class="search-card-image">
                <img v-if="shinobi.imageUrl" :src="shinobi.imageUrl" :alt="shinobi.name" />
              </span>
              <span class="search-name">{{ shinobi.name }}</span>
            </button>
          </section>
          <p v-if="!results.players.length && !results.shinobis.length" class="social-muted">
            Aucun résultat.
          </p>
        </template>
      </div>
    </div>

    <div class="social-actions">
      <button
        v-if="auth.isAuthenticated"
        class="notification-button"
        type="button"
        aria-label="Notifications"
        @click="notificationsOpen = !notificationsOpen"
      >
        <span class="notif-icon">◉</span>
        <span v-if="requests.length + gameInvites.length" class="notification-badge">
          {{ requests.length + gameInvites.length }}
        </span>
      </button>
      <a
        class="social-profile-link"
        :href="auth.isAuthenticated ? '/profil' : '/connexion'"
      >
        {{ auth.isAuthenticated ? (auth.user?.displayName || 'Profil') : 'Connexion' }}
      </a>
    </div>

    <div v-if="notificationsOpen" class="notifications-panel">
      <strong>NOTIFICATIONS</strong>
      <p v-if="!requests.length && !gameInvites.length" class="social-muted">Aucune notification.</p>
      <article v-for="request in requests" :key="`friend-${request.id}`" class="notif-item">
        <button type="button" class="notif-sender" @click="publicProfile(request.sender.id)">
          {{ request.sender.displayName }}
        </button>
        <span class="notif-desc">demande à devenir ton ami</span>
        <div class="notif-actions">
          <button type="button" class="btn-accept" @click="answer(request, true)">ACCEPTER</button>
          <button type="button" class="btn-reject" @click="answer(request, false)">REFUSER</button>
        </div>
      </article>
      <article v-for="invite in gameInvites" :key="`game-${invite.id}`" class="notif-item">
        <span class="notif-desc">
          <b>{{ invite.creator.displayName }}</b> vous défie en {{ invite.mode }}
        </span>
        <div class="notif-actions">
          <button type="button" class="btn-accept" @click="answerGameInvite(invite, true)">ACCEPTER</button>
          <button type="button" class="btn-reject" @click="answerGameInvite(invite, false)">REFUSER</button>
        </div>
      </article>
    </div>

    <MobileSidebar :open="sidebarOpen" @close="sidebarOpen = false" />
  </nav>
</template>

<style scoped>
.social-header {
  position: relative;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  min-height: 70px;
  padding: 10px max(16px, calc((100vw - 1320px) / 2));
  background: var(--accent-orange);
  border-bottom: 1px solid rgba(84, 48, 12, 0.35);
  box-sizing: border-box;
}

.social-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
  text-decoration: none;
  cursor: pointer;
  touch-action: manipulation;
  padding: 4px;
  border-radius: var(--radius-sm);
}

.social-brand img {
  display: block;
  width: auto;
  height: 48px;
  object-fit: contain;
}

.mobile-menu-indicator {
  display: none;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  width: 20px;
  height: 20px;
  padding: 2px;
}

.indicator-bar {
  display: block;
  height: 2px;
  background: #2b2113;
  border-radius: 2px;
  width: 100%;
}

.header-links {
  display: flex;
  flex: 0 0 auto;
  gap: 6px;
}

.header-links a {
  padding: 0.65rem 0.85rem;
  color: #2b2113;
  font-size: 0.62rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  border: 1px solid rgba(76, 48, 15, 0.35);
  background: rgba(255, 214, 102, 0.34);
  clip-path: var(--clip-soft);
  transition: background 0.2s ease, transform 0.2s ease;
}

.header-links a:hover,
.header-links a:focus-visible {
  background: #fff0bd;
  transform: translateY(-1px);
}

.global-search {
  position: relative;
  flex: 1;
  max-width: 480px;
  margin: 0 8px;
}

.global-search input {
  width: 100%;
  min-height: 40px;
  padding: 0 14px;
  border: 1px solid rgba(43, 33, 19, 0.45);
  background: #fff0bd;
  color: #2b2113;
  font-size: 0.72rem;
  outline: none;
  clip-path: var(--clip-soft);
  box-sizing: border-box;
}

.global-search input::placeholder {
  color: #756542;
}

.global-search input:focus-visible {
  box-shadow: 0 0 0 2px rgba(43, 33, 19, 0.4);
}

.search-dropdown,
.notifications-panel {
  position: absolute;
  top: calc(100% + 8px);
  width: min(calc(100vw - 32px), 480px);
  max-height: 70vh;
  overflow-y: auto;
  padding: 12px;
  border: 1px solid var(--border-strong);
  background: var(--bg-panel);
  box-shadow: var(--shadow-dark);
  z-index: 120;
}

.search-dropdown {
  left: 0;
}

.notifications-panel {
  right: 16px;
  width: min(calc(100vw - 32px), 360px);
}

.search-section + .search-section {
  margin-top: 12px;
}

.search-section > strong,
.notifications-panel > strong {
  display: block;
  padding: 6px 8px;
  color: var(--accent-gold);
  font-size: 0.58rem;
  letter-spacing: 0.12em;
}

.search-row {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  padding: 8px;
  border: 0;
  border-top: 1px solid var(--border-light);
  background: transparent;
  color: var(--text-main);
  text-align: left;
  cursor: pointer;
}

.search-row:hover {
  background: var(--bg-panel-strong);
}

.social-avatar,
.search-card-image {
  display: grid;
  place-items: center;
  flex: 0 0 32px;
  width: 32px;
  height: 32px;
  background: var(--accent-orange);
  color: #2b2113;
  font-size: 0.72rem;
  font-weight: 700;
}

.search-card-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.search-name {
  flex: 1;
  font-size: 0.67rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.search-action {
  color: var(--accent-gold);
  font-size: 0.52rem;
  white-space: nowrap;
  font-weight: 700;
}

.social-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
}

.social-profile-link,
.notification-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  padding: 0.65rem 0.95rem;
  border: 1px solid rgba(76, 48, 15, 0.42);
  background: #2b2113;
  color: #fff0bd;
  text-transform: uppercase;
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  clip-path: var(--clip-soft);
  cursor: pointer;
  touch-action: manipulation;
  transition: background 0.2s ease, transform 0.2s ease;
  white-space: nowrap;
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.social-profile-link:hover,
.notification-button:hover {
  background: #473316;
  transform: translateY(-1px);
}

.notification-button {
  position: relative;
  padding-inline: 0.75rem;
}

.notif-icon {
  font-size: 0.85rem;
}

.notification-badge {
  position: absolute;
  top: -6px;
  right: -6px;
  display: grid;
  place-items: center;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  background: var(--accent-red);
  color: #fff;
  font-size: 0.52rem;
  font-weight: 800;
  border-radius: 9px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
}

.notif-item {
  padding: 10px 0;
  border-top: 1px solid var(--border-light);
  display: grid;
  gap: 6px;
}

.notif-sender {
  background: transparent;
  border: 0;
  color: var(--accent-gold);
  font-weight: 700;
  font-size: 0.65rem;
  text-align: left;
  padding: 0;
  cursor: pointer;
}

.notif-desc {
  font-size: 0.6rem;
  color: var(--text-soft);
}

.notif-actions {
  display: flex;
  gap: 6px;
}

.btn-accept,
.btn-reject {
  padding: 4px 8px;
  font-size: 0.52rem;
  font-weight: 700;
  border: 1px solid var(--border-light);
  cursor: pointer;
}

.btn-accept {
  background: var(--accent-green);
  color: #122419;
}

.btn-reject {
  background: rgba(255, 91, 91, 0.2);
  color: var(--accent-red);
}

.social-muted {
  font-size: 0.62rem;
  color: var(--text-muted);
  padding: 6px;
}

/* Responsive Breakpoints */
@media (max-width: 1024px) {
  .desktop-only {
    display: none !important;
  }

  .mobile-menu-indicator {
    display: flex;
  }
}

@media (max-width: 768px) {
  .social-header {
    flex-wrap: wrap;
    min-height: auto;
    padding: 8px 14px 12px;
    gap: 8px;
  }

  .social-brand img {
    height: 40px;
  }

  .global-search {
    order: 3;
    flex-basis: 100%;
    max-width: 100%;
    margin: 4px 0 0;
  }

  .global-search input {
    min-height: 38px;
    font-size: 0.7rem;
  }

  .social-actions {
    margin-left: auto;
  }

  .social-profile-link {
    max-width: 120px;
    font-size: 0.58rem;
    padding: 0.55rem 0.75rem;
  }
}

@media (max-width: 430px) {
  .social-brand img {
    height: 36px;
  }

  .social-profile-link {
    max-width: 95px;
    font-size: 0.55rem;
    padding: 0.5rem 0.6rem;
  }
}
</style>
