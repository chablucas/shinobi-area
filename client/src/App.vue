<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { createGameLobby, listFriends, type ChallengeMode, type Friend } from './services/socialApi'
import { useAuthStore } from './stores/auth'
import SocialHeader from './components/SocialHeader.vue'
import type { TeamAuctionMode } from './services/realtimeApi'

const auth = useAuthStore()
const router = useRouter()
const friends = ref<Friend[]>([])
const inviteMode = ref<ChallengeMode | null>(null)
const selectedFriendIds = ref<number[]>([])
const completeWithAi = ref(false)
const inviteError = ref('')
const friendsLoading = ref(false)
const sendingInvite = ref(false)

onMounted(async () => {
  await auth.loadCurrentUser()
})

async function openInviteDialog(mode: ChallengeMode) {
  await auth.loadCurrentUser()
  if (!auth.token) {
    await router.push('/connexion')
    return
  }
  inviteMode.value = mode
  selectedFriendIds.value = []
  completeWithAi.value = false
  inviteError.value = ''
  friendsLoading.value = true
  try {
    friends.value = await listFriends(auth.token)
  } catch (exception) {
    inviteError.value = exception instanceof Error ? exception.message : 'Impossible de charger vos amis.'
  } finally {
    friendsLoading.value = false
  }
}

function requiredFriendCount() {
  if (inviteMode.value === '1v1' || inviteMode.value === 'team-1v1') return 1
  return completeWithAi.value ? 1 : 2
}

const inviteTitle = computed(() => {
  if (inviteMode.value === 'team-1v1') return 'Invite un ami en Team Auction'
  if (inviteMode.value === 'team-1v1v1') return 'Invite 2 amis en Team Auction'
  if (inviteMode.value === '1v1') return 'Invite un ami'
  return 'Envie d’un plaisir à 3 ?'
})

function toggleFriend(id: number) {
  const maximum = requiredFriendCount()
  selectedFriendIds.value = selectedFriendIds.value.includes(id)
    ? selectedFriendIds.value.filter((friendId) => friendId !== id)
    : selectedFriendIds.value.length < maximum
      ? [...selectedFriendIds.value, id]
      : selectedFriendIds.value
}

function toggleCompleteWithAi() {
  completeWithAi.value = !completeWithAi.value
  if (completeWithAi.value && selectedFriendIds.value.length > 1) {
    selectedFriendIds.value = selectedFriendIds.value.slice(0, 1)
  }
}

async function createInvite() {
  if (!auth.token || !inviteMode.value) return
  const required = requiredFriendCount()
  if (selectedFriendIds.value.length !== required) return
  sendingInvite.value = true
  inviteError.value = ''
  try {
    const isTeam = inviteMode.value.startsWith('team-')
    const currentMode = inviteMode.value
    const lobby = await createGameLobby(
      auth.token,
      currentMode,
      selectedFriendIds.value,
      currentMode === '1v1v1' && completeWithAi.value,
    )
    inviteMode.value = null
    if (isTeam) {
      const taMode = currentMode === 'team-1v1' ? '1v1-real' : '1v1v1-real'
      await router.push({ path: '/team-game', query: { mode: taMode, gameId: lobby.id } })
    } else {
      await router.push(`/lobby/${lobby.id}`)
    }
  } catch (exception) {
    inviteError.value = exception instanceof Error ? exception.message : 'Invitation impossible.'
  } finally {
    sendingInvite.value = false
  }
}

async function goTeamAuction(mode: TeamAuctionMode) {
  await auth.loadCurrentUser()
  if (!auth.token) {
    await router.push('/connexion')
    return
  }
  await router.push({ path: '/team-game', query: { mode } })
}
</script>

<template>
  <main class="site-shell">
    <div class="noise" aria-hidden="true"></div>
    <SocialHeader />

    <section id="accueil" class="hero">
      <div class="hero-copy">
        <p class="kicker"><span class="kicker-dot"></span>La voie commence ici</p>
        <h1>Shinobi Area<br /><span>Trace ta voie.</span></h1>
        <p class="intro">
          Shinobi Area est un jeu de cartes et de stratégie ninja où chaque choix forge ton combattant.
          Tire tes cartes, construis les 15 catégories de ton shinobi et triomphe dans l'arène.
        </p>

        <!-- 3 CTA Principaux bien visibles -->
        <div class="main-cta-group" aria-label="Modes de combat principaux">
          <!-- 1. Combat contre l'ordinateur -->
          <button
            type="button"
            class="cta-card cta-solo"
            @click="router.push('/solo')"
          >
            <div class="cta-card-header">
              <span class="cta-badge">MODE 01</span>
              <span class="cta-arrow" aria-hidden="true">→</span>
            </div>
            <div class="cta-card-body">
              <span class="cta-icon">◈</span>
              <div class="cta-text">
                <h2>Combat contre l’ordinateur</h2>
                <p>Mesure ton build shinobi face à une intelligence artificielle stratégique.</p>
              </div>
            </div>
            <div class="cta-card-footer">
              <span class="cta-action-label">Lancer le combat solo <span>→</span></span>
            </div>
          </button>

          <!-- 2. Combat contre un joueur réel -->
          <div class="cta-card cta-duel">
            <div class="cta-card-header">
              <span class="cta-badge">MODE 02</span>
              <span class="cta-arrow" aria-hidden="true">⚔</span>
            </div>
            <div class="cta-card-body">
              <span class="cta-icon">✦</span>
              <div class="cta-text">
                <h2>Combat contre un joueur réel</h2>
                <p>Affronte un rival en duel 1v1 en local sur le même écran ou invite un ami en salon.</p>
              </div>
            </div>
            <div class="cta-actions-dual">
              <button
                type="button"
                class="cta-sub-btn primary"
                @click="router.push('/partie')"
              >
                Duel local 1v1
              </button>
              <button
                type="button"
                class="cta-sub-btn secondary"
                @click="openInviteDialog('1v1')"
              >
                Inviter un ami
              </button>
            </div>
          </div>

          <!-- 3. Combat 1v1v1 -->
          <div class="cta-card cta-triple">
            <div class="cta-card-header">
              <span class="cta-badge">MODE 03</span>
              <span class="cta-arrow" aria-hidden="true">⌘</span>
            </div>
            <div class="cta-card-body">
              <span class="cta-icon">⌘</span>
              <div class="cta-text">
                <h2>Combat 1v1v1</h2>
                <p>Arène à trois combattants. Chacun forge son shinobi pour une bataille à 3.</p>
              </div>
            </div>
            <div class="cta-actions-dual">
              <button
                type="button"
                class="cta-sub-btn primary"
                @click="router.push('/3-joueurs')"
              >
                Combat 1v1v1 local
              </button>
              <button
                type="button"
                class="cta-sub-btn secondary"
                @click="openInviteDialog('1v1v1')"
              >
                Inviter 2 amis
              </button>
            </div>
          </div>
        </div>

        <div class="hero-meta">
          <div><strong>15</strong><span>catégories<br />par shinobi</span></div>
          <div><strong>163</strong><span>cartes<br />légendaires</span></div>
          <div><strong>∞</strong><span>combats<br />possibles</span></div>
        </div>
      </div>

      <div class="hero-art" aria-label="Emblème Shinobi Area">
        <img src="/logo.png" alt="Logo Shinobi Area" />
      </div>
    </section>

    <section id="jeu-equipe" class="hero">
      <div class="hero-copy">
        <p class="kicker"><span class="kicker-dot"></span>Nouveau mode</p>
        <h1>Jeu d’équipe<br /><span>Team Auction.</span></h1>
        <p class="intro">
          Enchéris carte par carte pour bâtir tes équipes de shinobis et affronte l'IA ou de vrais joueurs dans une bataille de gestion et de stratégie.
        </p>

        <div class="main-cta-group" aria-label="Modes Jeu d’équipe">
          <button type="button" class="cta-card cta-solo" @click="goTeamAuction('1v1-ai')">
            <div class="cta-card-header">
              <span class="cta-badge">MODE 01</span>
              <span class="cta-arrow" aria-hidden="true">→</span>
            </div>
            <div class="cta-card-body">
              <span class="cta-icon">◈</span>
              <div class="cta-text">
                <h2>1v1 IA</h2>
                <p>Enchéris seul contre une intelligence artificielle stratégique pour bâtir la meilleure équipe.</p>
              </div>
            </div>
            <div class="cta-card-footer">
              <span class="cta-action-label">Jouer <span>→</span></span>
            </div>
          </button>

          <div class="cta-card cta-duel">
            <div class="cta-card-header">
              <span class="cta-badge">MODE 02</span>
              <span class="cta-arrow" aria-hidden="true">⚔</span>
            </div>
            <div class="cta-card-body">
              <span class="cta-icon">✦</span>
              <div class="cta-text">
                <h2>1v1 joueur réel</h2>
                <p>Défie un adversaire réel en salon Team Auction et emporte les cartes les plus fortes.</p>
              </div>
            </div>
            <div class="cta-actions-dual">
              <button type="button" class="cta-sub-btn primary" @click="goTeamAuction('1v1-real')">CRÉER / JOUER</button>
              <button type="button" class="cta-sub-btn secondary" @click="openInviteDialog('team-1v1')">INVITER UN AMI</button>
            </div>
          </div>

          <div class="cta-card cta-triple">
            <div class="cta-card-header">
              <span class="cta-badge">MODE 03</span>
              <span class="cta-arrow" aria-hidden="true">⌘</span>
            </div>
            <div class="cta-card-body">
              <span class="cta-icon">⌘</span>
              <div class="cta-text">
                <h2>1v1v1 joueurs réels</h2>
                <p>Trois joueurs, une seule pioche : enchéris et compose l’équipe qui dominera les deux autres.</p>
              </div>
            </div>
            <div class="cta-actions-dual">
              <button type="button" class="cta-sub-btn primary" @click="goTeamAuction('1v1v1-real')">CRÉER / JOUER</button>
              <button type="button" class="cta-sub-btn secondary" @click="openInviteDialog('team-1v1v1')">INVITER 2 AMIS</button>
            </div>
          </div>
        </div>
      </div>

      <div class="hero-art" aria-label="Illustration Jeu d’équipe">
        <img src="/logo.png" alt="Logo Shinobi Area" />
      </div>
    </section>

    <!-- Modal d'invitation d'amis -->
    <div v-if="inviteMode" class="invite-overlay" role="presentation" @click.self="inviteMode = null">
      <section class="invite-dialog" role="dialog" aria-modal="true" aria-labelledby="invite-title">
        <div class="invite-heading">
          <div>
            <p class="kicker">Combat social</p>
            <h2 id="invite-title">{{ inviteTitle }}</h2>
          </div>
          <button class="invite-close" type="button" aria-label="Fermer" @click="inviteMode = null">×</button>
        </div>
        <p class="invite-copy">
          {{
            inviteMode === '1v1' || inviteMode === 'team-1v1'
              ? 'Sélectionne un ami pour lancer le salon.'
              : completeWithAi
                ? 'Sélectionne un ami, l’IA complètera la partie.'
                : 'Sélectionne deux amis distincts pour lancer le salon.'
          }}
        </p>
        <div v-if="inviteMode === '1v1v1'" class="invite-ai-toggle">
          <button
            type="button"
            class="friend-choice"
            :class="{ selected: completeWithAi }"
            @click="toggleCompleteWithAi"
          >
            {{ completeWithAi ? '✓ Compléter avec l’IA' : 'Compléter avec l’IA' }}
          </button>
        </div>
        <p v-if="friendsLoading" class="invite-copy">Chargement des amis...</p>
        <p v-else-if="inviteError" class="invite-error">{{ inviteError }}</p>
        <div v-else class="friend-picker">
          <button
            v-for="friend in friends"
            :key="friend.id"
            class="friend-choice"
            :class="{ selected: selectedFriendIds.includes(friend.id) }"
            type="button"
            @click="toggleFriend(friend.id)"
          >
            <span>{{ friend.displayName.slice(0, 1) }}</span>{{ friend.displayName }}
          </button>
          <p v-if="!friends.length" class="invite-copy">Aucun ami disponible.</p>
        </div>
        <button
          class="invite-submit"
          type="button"
          :disabled="friendsLoading || sendingInvite || selectedFriendIds.length !== requiredFriendCount()"
          @click="createInvite"
        >
          {{ sendingInvite ? 'Création...' : 'Créer le salon' }}
        </button>
      </section>
    </div>

    <footer>
      <span>SHINOBI AREA</span>
      <span>La nuit appartient à ceux qui osent.</span>
      <span>© 2026</span>
    </footer>
  </main>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Syne:wght@400;600;700;800&display=swap');

.site-shell {
  position: relative;
  min-height: 100vh;
  background: var(--bg-main);
  overflow-x: hidden;
}

.site-shell::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.035), transparent 38%);
  pointer-events: none;
}

.noise {
  position: absolute;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180' viewBox='0 0 180 180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.12'/%3E%3C/svg%3E");
  opacity: 0.48;
  pointer-events: none;
}

.hero,
footer {
  position: relative;
  z-index: 1;
  max-width: 1320px;
  margin: 0 auto;
  padding-left: max(16px, calc((100vw - 1320px) / 2));
  padding-right: max(16px, calc((100vw - 1320px) / 2));
  box-sizing: border-box;
}

.hero {
  display: grid;
  grid-template-columns: minmax(0, 7.5fr) minmax(260px, 3.5fr);
  align-items: start;
  gap: 32px;
  padding-top: 32px;
  padding-bottom: 50px;
}

.hero-copy {
  position: relative;
  z-index: 1;
  padding: 36px 36px 40px;
  border: 1px solid var(--border-light);
  background: var(--bg-panel-soft);
  clip-path: var(--clip-soft);
  animation: rise 0.6s ease both;
}

.kicker {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 18px;
  color: var(--accent-gold);
  font-size: 0.62rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.kicker-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--accent-orange), var(--accent-red));
  box-shadow: 0 0 18px rgba(246, 128, 72, 0.8);
}

.hero h1 {
  font-size: clamp(2.4rem, 5vw, 4.8rem);
  line-height: 0.92;
  letter-spacing: -0.06em;
  font-weight: 800;
  text-transform: uppercase;
  margin: 0 0 16px;
}

.hero h1 span {
  color: var(--accent-orange);
}

.intro {
  max-width: 620px;
  color: var(--text-muted);
  line-height: 1.7;
  font-size: 0.76rem;
  margin: 0 0 28px;
}

/* 3 Main CTA Cards */
.main-cta-group {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 24px;
}

.cta-card {
  display: flex;
  flex-direction: column;
  padding: 20px 22px;
  border: 1px solid var(--border-light);
  background: var(--bg-panel-strong);
  clip-path: var(--clip-soft);
  transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
  text-align: left;
  width: 100%;
  box-sizing: border-box;
}

.cta-card:hover {
  transform: translateY(-2px);
}

.cta-solo {
  background: linear-gradient(135deg, rgba(46, 26, 18, 0.95), rgba(26, 28, 32, 0.9));
  border-color: rgba(246, 128, 72, 0.45);
  cursor: pointer;
}

.cta-solo:hover {
  border-color: var(--accent-orange);
  box-shadow: 0 8px 24px rgba(246, 128, 72, 0.25);
}

.cta-duel {
  background: linear-gradient(135deg, rgba(16, 32, 42, 0.95), rgba(26, 28, 32, 0.9));
  border-color: rgba(84, 196, 255, 0.4);
}

.cta-duel:hover {
  border-color: var(--accent-blue);
  box-shadow: 0 8px 24px rgba(84, 196, 255, 0.2);
}

.cta-triple {
  background: linear-gradient(135deg, rgba(20, 36, 28, 0.95), rgba(26, 28, 32, 0.9));
  border-color: rgba(138, 217, 184, 0.4);
}

.cta-triple:hover {
  border-color: var(--accent-green);
  box-shadow: 0 8px 24px rgba(138, 217, 184, 0.2);
}

.cta-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.cta-badge {
  color: var(--accent-gold);
  font-size: 0.58rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.cta-arrow {
  color: var(--accent-gold);
  font-size: 1.1rem;
}

.cta-card-body {
  display: flex;
  align-items: flex-start;
  gap: 16px;
}

.cta-icon {
  font-size: 2rem;
  line-height: 1;
  color: var(--accent-orange);
  flex-shrink: 0;
}

.cta-duel .cta-icon {
  color: var(--accent-blue);
}

.cta-triple .cta-icon {
  color: var(--accent-green);
}

.cta-text h2 {
  font-size: clamp(1.15rem, 2.5vw, 1.45rem);
  letter-spacing: -0.04em;
  text-transform: uppercase;
  margin: 0 0 6px;
  color: var(--text-main);
}

.cta-text p {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.68rem;
  line-height: 1.6;
}

.cta-card-footer {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--border-light);
}

.cta-action-label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--accent-gold);
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.cta-actions-dual {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid var(--border-light);
}

.cta-sub-btn {
  flex: 1 1 calc(50% - 5px);
  min-height: 46px;
  padding: 10px 14px;
  border: 1px solid var(--border-light);
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  clip-path: var(--clip-soft);
  cursor: pointer;
  touch-action: manipulation;
  transition: all 0.2s ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.cta-sub-btn.primary {
  background: linear-gradient(135deg, var(--accent-gold), var(--accent-orange));
  color: #181a1b;
  border-color: transparent;
}

.cta-sub-btn.primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 14px rgba(246, 128, 72, 0.4);
}

.cta-sub-btn.secondary {
  background: rgba(14, 18, 22, 0.8);
  color: var(--text-soft);
}

.cta-sub-btn.secondary:hover {
  background: rgba(30, 34, 40, 0.95);
  border-color: var(--accent-gold);
  color: var(--accent-gold);
}

.hero-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 28px;
  margin-top: 36px;
  padding-top: 20px;
  border-top: 1px solid var(--border-light);
}

.hero-meta div {
  display: flex;
  align-items: center;
  gap: 12px;
}

.hero-meta strong {
  color: var(--accent-gold);
  font-size: clamp(1.4rem, 2vw, 1.8rem);
  font-family: 'Syne', 'Segoe UI', sans-serif;
}

.hero-meta span {
  color: var(--text-muted);
  font-size: 0.58rem;
  line-height: 1.4;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.hero-art {
  position: sticky;
  top: 90px;
  display: grid;
  place-items: center;
  min-height: 380px;
  border: 1px solid var(--border-light);
  background: var(--bg-panel);
  clip-path: var(--clip-strong);
  padding: 24px;
}

.hero-art img {
  width: min(85%, 320px);
  height: auto;
  object-fit: contain;
}

/* Modal dialog */
.invite-overlay {
  position: fixed;
  z-index: 1000;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgba(5, 9, 15, 0.8);
  backdrop-filter: blur(4px);
}

.invite-dialog {
  width: min(100%, 520px);
  padding: 26px;
  border: 1px solid var(--border-strong);
  background: var(--bg-panel);
  box-shadow: var(--shadow-dark);
  clip-path: var(--clip-soft);
  max-height: 90vh;
  overflow-y: auto;
}

.invite-heading {
  display: flex;
  justify-content: space-between;
  gap: 16px;
}

.invite-heading .kicker {
  margin-bottom: 6px;
}

.invite-heading h2 {
  font-size: clamp(1.4rem, 3.5vw, 2.2rem);
  line-height: 1;
  text-transform: uppercase;
  margin: 0;
}

.invite-close {
  width: 40px;
  height: 40px;
  border: 1px solid var(--border-light);
  background: transparent;
  color: var(--text-main);
  font-size: 1.6rem;
  cursor: pointer;
  display: grid;
  place-items: center;
}

.invite-copy {
  margin: 18px 0 12px;
  color: var(--text-muted);
  font-size: 0.72rem;
  line-height: 1.6;
}

.friend-picker {
  display: grid;
  gap: 8px;
  max-height: 220px;
  overflow-y: auto;
}

.friend-choice {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 46px;
  padding: 8px 12px;
  border: 1px solid var(--border-light);
  background: var(--bg-panel-soft);
  color: var(--text-main);
  text-align: left;
  font: inherit;
  font-size: 0.72rem;
  cursor: pointer;
}

.friend-choice span {
  display: grid;
  place-items: center;
  flex: 0 0 28px;
  width: 28px;
  height: 28px;
  background: var(--accent-orange);
  color: #2b2113;
  font-weight: 700;
}

.friend-choice.selected {
  border-color: var(--accent-gold);
  background: rgba(241, 212, 141, 0.12);
}

.invite-error {
  margin: 16px 0 10px;
  color: var(--accent-red);
  font-size: 0.72rem;
}

.invite-submit {
  width: 100%;
  min-height: 48px;
  margin-top: 18px;
  border: 1px solid rgba(241, 212, 141, 0.8);
  background: var(--accent-gold);
  color: #151614;
  text-transform: uppercase;
  font: 700 0.68rem 'DM Mono', monospace;
  letter-spacing: 0.08em;
  cursor: pointer;
}

.invite-submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 80px;
  border-top: 1px solid var(--border-light);
  color: rgba(154, 167, 163, 0.8);
  font-size: 0.58rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

footer span:first-child {
  color: var(--accent-orange);
}

@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Tablet / Responsive */
@media (max-width: 992px) and (min-width: 601px) {
  .hero {
    grid-template-columns: minmax(0, 1.45fr) minmax(220px, 0.75fr);
    gap: 22px;
  }

  .hero-copy {
    padding: 28px 22px 32px;
  }

  .main-cta-group {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  .main-cta-group .cta-solo {
    grid-column: 1 / -1;
  }

  .hero-art {
    position: sticky;
    top: 86px;
    min-height: 360px;
  }

  .hero-art img {
    width: min(90%, 260px);
  }
}

@media (max-width: 580px) {
  .hero {
    grid-template-columns: 1fr;
    gap: 20px;
    padding-top: 20px;
  }

  .hero-art {
    position: static;
    min-height: 180px;
    order: -1;
  }

  .hero-art img {
    width: min(50%, 160px);
  }

  .hero-copy {
    padding: 24px 16px 30px;
  }

  .hero-art {
    min-height: 180px;
  }

  .hero-art img {
    width: min(50%, 160px);
  }

  .hero h1 {
    font-size: clamp(2rem, 10vw, 3rem);
  }

  .cta-sub-btn {
    flex: 1 1 100%;
  }

  .hero-meta {
    gap: 16px;
  }

  footer {
    flex-direction: column;
    text-align: center;
    padding: 20px 16px;
    gap: 8px;
  }
}
</style>
