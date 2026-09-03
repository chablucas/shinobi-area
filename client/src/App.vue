<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { createGameLobby, listFriends, type ChallengeMode, type Friend } from './services/socialApi'
import { useAuthStore } from './stores/auth'
import SocialHeader from './components/SocialHeader.vue'

const modes: Array<{ number: string; eyebrow: string; title: string; description: string; accent: string; action: 'solo' | ChallengeMode }> = [
  { number: '01', eyebrow: 'Forge ta légende', title: 'Défier l’IA', description: 'Construis ton shinobi et mesure-le à un rival stratégique.', accent: 'coral', action: 'solo' },
  { number: '02', eyebrow: 'Combat social', title: 'Invite un ami', description: 'Lance un duel 1v1 avec un ami et retrouvez-vous dans le salon.', accent: 'mint', action: '1v1' },
  { number: '03', eyebrow: 'Combat social', title: 'Envie d’un plaisir à 3 ?', description: 'Choisis deux amis distincts pour un combat 1v1v1.', accent: 'gold', action: '1v1v1' },
]

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

async function chooseMode(action: 'solo' | ChallengeMode) {
  if (action === 'solo') { await router.push('/solo'); return }
  await auth.loadCurrentUser()
  if (!auth.token) { await router.push('/connexion'); return }
  inviteMode.value = action
  selectedFriendIds.value = []
  completeWithAi.value = false
  inviteError.value = ''
  friendsLoading.value = true
  try { friends.value = await listFriends(auth.token) } catch (exception) { inviteError.value = exception instanceof Error ? exception.message : 'Impossible de charger vos amis.' } finally { friendsLoading.value = false }
}

function requiredFriendCount() {
  if (inviteMode.value === '1v1') return 1
  return completeWithAi.value ? 1 : 2
}

function toggleFriend(id: number) {
  const maximum = requiredFriendCount()
  selectedFriendIds.value = selectedFriendIds.value.includes(id) ? selectedFriendIds.value.filter((friendId) => friendId !== id) : selectedFriendIds.value.length < maximum ? [...selectedFriendIds.value, id] : selectedFriendIds.value
}

function toggleCompleteWithAi() {
  completeWithAi.value = !completeWithAi.value
  if (completeWithAi.value && selectedFriendIds.value.length > 1) selectedFriendIds.value = selectedFriendIds.value.slice(0, 1)
}

async function createInvite() {
  if (!auth.token || !inviteMode.value) return
  const required = requiredFriendCount()
  if (selectedFriendIds.value.length !== required) return
  sendingInvite.value = true
  inviteError.value = ''
  try { const lobby = await createGameLobby(auth.token, inviteMode.value, selectedFriendIds.value, inviteMode.value === '1v1v1' && completeWithAi.value); inviteMode.value = null; await router.push(`/lobby/${lobby.id}`) } catch (exception) { inviteError.value = exception instanceof Error ? exception.message : 'Invitation impossible.' } finally { sendingInvite.value = false }
}
</script>

<template>
  <main class="site-shell">
    <div class="noise" aria-hidden="true"></div>
    <SocialHeader />

    <section id="accueil" class="hero">
      <div class="hero-copy">
        <p class="kicker"><span class="kicker-dot"></span>La voie commence ici</p>
        <h1>Trace ta voie.<br /><span>Défie le monde.</span></h1>
        <p class="intro">Shinobi Area est un jeu de stratégie où chaque choix forge ta légende. Crée ton guerrier, maîtrise tes cartes et impose ton style.</p>
        <div id="creer" class="hero-actions"><a class="button button-primary" href="/jouer">Créer ton perso <span>→</span></a></div>
        <div class="hero-meta"><div><strong>03</strong><span>voies à<br />explorer</span></div><div><strong>∞</strong><span>combats<br />possibles</span></div><div><strong>01</strong><span>légende<br />à écrire</span></div></div>
      </div>
      <div class="hero-art" aria-label="Logo Shinobi Area"><img src="/logo.png" alt="Logo Shinobi Area" /></div>
    </section>

    <section id="modes" class="modes-section"><div class="section-heading" id="univers"><p class="kicker"><span class="kicker-dot"></span>Choisis ton terrain</p><h2>Trois façons<br /><i>de devenir légende.</i></h2><span class="section-index">/ 03</span></div>
      <div class="mode-grid"><button v-for="mode in modes" :id="mode.number === '02' ? 'combat' : undefined" :key="mode.number" type="button" class="mode-card" :class="`mode-${mode.accent}`" @click="chooseMode(mode.action)"><div class="card-top"><span>{{ mode.number }}</span><span class="arrow">↗</span></div><div class="card-symbol" aria-hidden="true"><span v-if="mode.number === '01'">◈</span><span v-else-if="mode.number === '02'">✦</span><span v-else>⌘</span></div><p>{{ mode.eyebrow }}</p><h3>{{ mode.title }}</h3><span class="card-description">{{ mode.description }}</span></button></div>
    </section>
    <div v-if="inviteMode" class="invite-overlay" role="presentation" @click.self="inviteMode = null">
      <section class="invite-dialog" role="dialog" aria-modal="true" :aria-labelledby="'invite-title'">
        <div class="invite-heading"><div><p class="kicker">Combat social</p><h2 id="invite-title">{{ inviteMode === '1v1' ? 'Invite un ami' : 'Envie d’un plaisir à 3 ?' }}</h2></div><button class="invite-close" type="button" aria-label="Fermer" @click="inviteMode = null">×</button></div>
        <p class="invite-copy">{{ inviteMode === '1v1' ? 'Sélectionne un ami pour lancer le salon 1v1.' : completeWithAi ? 'Sélectionne un ami, l’IA complètera le combat.' : 'Sélectionne deux amis distincts pour lancer le salon 1v1v1.' }}</p>
        <div v-if="inviteMode === '1v1v1'" class="invite-ai-toggle"><button type="button" class="friend-choice" :class="{ selected: completeWithAi }" @click="toggleCompleteWithAi">{{ completeWithAi ? '✓ Compléter avec l’IA' : 'Compléter avec l’IA' }}</button></div>
        <p v-if="friendsLoading" class="invite-copy">Chargement des amis...</p>
        <p v-else-if="inviteError" class="invite-error">{{ inviteError }}</p>
        <div v-else class="friend-picker"><button v-for="friend in friends" :key="friend.id" class="friend-choice" :class="{ selected: selectedFriendIds.includes(friend.id) }" type="button" @click="toggleFriend(friend.id)"><span>{{ friend.displayName.slice(0, 1) }}</span>{{ friend.displayName }}</button><p v-if="!friends.length" class="invite-copy">Aucun ami disponible.</p></div>
        <button class="invite-submit" type="button" :disabled="friendsLoading || sendingInvite || selectedFriendIds.length !== requiredFriendCount()" @click="createInvite">{{ sendingInvite ? 'Création...' : 'Créer le salon' }}</button>
      </section>
    </div>

    <footer><span>SHINOBI AREA</span><span>La nuit appartient à ceux qui osent.</span><span>© 2026</span></footer>
  </main>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Syne:wght@400;600;700;800&display=swap');

.site-shell {
  position: relative;
  min-height: 100vh;
  background: var(--bg-main);
  overflow: hidden;
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
.modes-section,
footer {
  position: relative;
  z-index: 1;
  max-width: 1320px;
  margin: 0 auto;
  padding-left: max(20px, calc((100vw - 1320px) / 2));
  padding-right: max(20px, calc((100vw - 1320px) / 2));
}

.topbar {
  display: flex;
  max-width: none;
  align-items: center;
  justify-content: space-between;
  min-height: 78px;
  border-bottom: 1px solid rgba(84, 48, 12, 0.35);
  padding-top: 10px;
  padding-bottom: 10px;
  background: var(--accent-orange);
}

.brand {
  display: inline-flex;
  align-items: center;
}

.brand-logo {
  display: block;
  width: auto;
  height: 52px;
  object-fit: contain;
}

.create-link {
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

.nav-links {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #2b2113;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 0.68rem;
}

.nav-links a {
  padding: 0.75rem 1.15rem;
  border: 1px solid rgba(76, 48, 15, 0.35);
  background: rgba(255, 214, 102, 0.34);
  clip-path: var(--clip-soft);
  transition: background 0.2s ease, transform 0.2s ease;
}

.nav-links a:hover,
.nav-links a:focus-visible {
  background: rgba(255, 236, 174, 0.58);
  transform: translateY(-1px);
}

.nav-tab.active {
  background: #fff0bd;
  font-weight: 700;
}

.profile-link,
.button,
.button-primary,
.button-quiet {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.9rem;
  min-height: 42px;
  padding: 0.75rem 1.25rem;
  border: 1px solid rgba(76, 48, 15, 0.42);
  background: #2b2113;
  color: #fff0bd;
  clip-path: var(--clip-soft);
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 0.64rem;
  transition: transform 0.2s ease, background 0.2s ease;
}

.profile-link:hover,
.profile-link:focus-visible,
.button:hover,
.button-primary:hover,
.button-quiet:hover {
  transform: translateY(-1px);
  background: #473316;
}

.button span,
.button-primary span,
.button-quiet span {
  color: var(--accent-orange);
}

.hero {
  display: grid;
  grid-template-columns: minmax(0, 7fr) minmax(260px, 3fr);
  align-items: center;
  gap: 36px;
  min-height: 560px;
  padding-top: 34px;
  padding-bottom: 34px;
}

.hero-copy {
  position: relative;
  z-index: 1;
  padding: 42px 42px 46px;
  border: 1px solid var(--border-light);
  background: var(--bg-panel-soft);
  clip-path: var(--clip-soft);
  animation: rise 0.7s ease both;
}

.kicker {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 22px;
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
  font-size: clamp(3.2rem, 6vw, 6rem);
  line-height: 0.88;
  letter-spacing: -0.08em;
  font-weight: 800;
  text-transform: uppercase;
}

.hero h1 span {
  color: var(--accent-orange);
}

.intro {
  max-width: 460px;
  margin-top: 22px;
  color: var(--text-muted);
  line-height: 1.8;
  font-size: 0.76rem;
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  margin-top: 32px;
}

.button-primary {
  background: linear-gradient(135deg, var(--accent-gold), var(--accent-orange));
  color: #151614;
  border-color: rgba(241, 212, 141, 0.8);
  box-shadow: 0 18px 40px rgba(246, 128, 72, 0.2);
  font-weight: 700;
}

.button-primary:hover,
.button-primary:focus-visible {
  box-shadow: 0 18px 52px rgba(246, 128, 72, 0.38);
}

.button-quiet {
  background: rgba(12, 18, 23, 0.82);
}

.play-icon {
  display: inline-grid;
  place-items: center;
  width: 1.3rem;
  height: 1.3rem;
  border-radius: 999px;
  background: rgba(246, 128, 72, 0.14);
  color: var(--accent-orange);
}

.hero-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 32px;
  max-width: 520px;
  margin-top: 44px;
  padding-top: 18px;
  border-top: 1px solid var(--border-light);
}

.hero-meta div {
  display: flex;
  align-items: center;
  gap: 12px;
}

.hero-meta strong {
  color: var(--accent-gold);
  font-size: clamp(1.5rem, 2vw, 2rem);
  font-family: 'Syne', 'Segoe UI', sans-serif;
}

.hero-meta span {
  color: var(--text-muted);
  font-size: 0.58rem;
  line-height: 1.4;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.hero-art {
  position: relative;
  display: grid;
  place-items: center;
  min-height: 420px;
  border: 1px solid var(--border-light);
  background: var(--bg-panel);
  clip-path: var(--clip-strong);
}

.hero-art img {
  width: min(82%, 360px);
  height: min(82%, 360px);
  object-fit: contain;
}

.modes-section {
  border-top: 1px solid var(--border-light);
  padding-top: 70px;
  padding-bottom: 78px;
}

.section-heading {
  position: relative;
  padding-left: 4%;
  margin-bottom: 36px;
}

.section-heading h2 {
  margin-top: 18px;
  font-size: clamp(2.1rem, 4vw, 4rem);
  line-height: 0.94;
  letter-spacing: -0.08em;
  text-transform: uppercase;
}

.section-heading h2 i {
  color: var(--text-muted);
  font-style: normal;
}

.section-index {
  position: absolute;
  right: 4%;
  bottom: 0;
  color: rgba(154, 167, 163, 0.9);
  font-size: 0.64rem;
  letter-spacing: 0.12em;
}

.mode-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--grid-gap);
}

.mode-card {
  display: flex;
  flex-direction: column;
  width: 100%;
  min-height: 310px;
  padding: 20px 22px 18px;
  background: rgba(18, 24, 31, 0.86);
  border: 1px solid var(--border-light);
  color: var(--text-main);
  text-align: left;
  font: inherit;
  cursor: pointer;
  clip-path: var(--clip-strong);
  transition: transform 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease;
}

.mode-card:hover,
.mode-card:focus-visible {
  transform: translateY(-5px);
  border-color: rgba(241, 212, 141, 0.7);
  box-shadow: 0 16px 35px rgba(5, 9, 15, 0.45);
}

.mode-coral {
  background: linear-gradient(135deg, rgba(43, 25, 18, 0.96), rgba(20, 24, 27, 0.9));
}

.mode-mint {
  background: linear-gradient(135deg, rgba(15, 27, 26, 0.96), rgba(20, 24, 27, 0.9));
}

.mode-gold {
  background: linear-gradient(135deg, rgba(34, 31, 21, 0.98), rgba(20, 24, 27, 0.9));
}

.card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.58rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.arrow {
  color: var(--accent-gold);
  font-size: 1.1rem;
}

.card-symbol {
  margin: 34px 0 24px;
  font-size: 2.8rem;
  color: var(--accent-orange);
}

.mode-mint .card-symbol {
  color: var(--accent-green);
}

.mode-gold .card-symbol {
  color: var(--accent-gold);
}

.mode-card p {
  margin-top: auto;
  color: var(--text-muted);
  font-size: 0.58rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.mode-card h3 {
  margin: 10px 0 12px;
  font-size: clamp(1.2rem, 2vw, 2rem);
  letter-spacing: -0.05em;
  text-transform: uppercase;
}

.card-description {
  display: block;
  color: rgba(218, 224, 219, 0.8);
  font-size: 0.68rem;
  line-height: 1.7;
}

.invite-overlay { position: fixed; z-index: 30; inset: 0; display: grid; place-items: center; padding: 20px; background: rgba(5, 9, 15, 0.72); }
.invite-dialog { width: min(100%, 560px); padding: 28px; border: 1px solid var(--border-strong); background: var(--bg-panel); box-shadow: var(--shadow-dark); clip-path: var(--clip-soft); }
.invite-heading { display: flex; justify-content: space-between; gap: 20px; }.invite-heading .kicker { margin-bottom: 8px; }.invite-heading h2 { font-size: clamp(1.7rem, 4vw, 2.8rem); line-height: 1; text-transform: uppercase; }.invite-close { width: 42px; height: 42px; border: 1px solid var(--border-light); background: transparent; color: var(--text-main); font-size: 1.8rem; cursor: pointer; }.invite-copy { margin: 22px 0 14px; color: var(--text-muted); font-size: .72rem; line-height: 1.6; }.friend-picker { display: grid; gap: 8px; max-height: 250px; overflow-y: auto; }.friend-choice { display: flex; align-items: center; gap: 12px; width: 100%; min-height: 48px; padding: 8px; border: 1px solid var(--border-light); background: var(--bg-panel-soft); color: var(--text-main); text-align: left; font: inherit; font-size: .72rem; cursor: pointer; }.friend-choice span { display: grid; place-items: center; flex: 0 0 30px; width: 30px; height: 30px; background: var(--accent-orange); color: #2b2113; font-weight: 700; }.friend-choice.selected { border-color: var(--accent-gold); background: rgba(241, 212, 141, .12); }.invite-error { margin: 22px 0 14px; color: var(--accent-red); font-size: .72rem; }.invite-submit { width: 100%; min-height: 46px; margin-top: 18px; border: 1px solid rgba(241, 212, 141, .8); background: var(--accent-gold); color: #151614; text-transform: uppercase; font: 700 .65rem 'DM Mono', monospace; letter-spacing: .08em; cursor: pointer; }.invite-submit:disabled { opacity: .5; cursor: not-allowed; }

.cards-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: var(--grid-gap);
}

.character-card {
  overflow: hidden;
  background: rgba(15, 20, 27, 0.86);
  border: 1px solid var(--border-light);
  transition: transform 0.25s ease, border-color 0.25s ease;
}

.character-card:hover {
  transform: translateY(-3px);
  border-color: rgba(84, 196, 255, 0.5);
}

.character-card-media {
  aspect-ratio: 2 / 3;
}

.character-card img,
.image-fallback {
  width: calc(100% - 6px);
  height: calc(100% - 2px);
  object-fit: cover;
}

.image-fallback {
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, rgba(29, 38, 41, 0.9), rgba(20, 24, 27, 0.9));
  color: var(--accent-gold);
  font-family: 'Syne', 'Segoe UI', sans-serif;
  font-size: 2.8rem;
  font-weight: 700;
}

.character-card h3 {
  padding: 12px 14px 16px;
  font-size: 0.72rem;
  line-height: 1.5;
  letter-spacing: -0.03em;
}

footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  min-height: 92px;
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
    transform: translateY(18px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 960px) {
  .topbar {
    gap: 12px;
  }

  .nav-links {
    gap: 4px;
  }

  .nav-links a {
    padding-inline: 0.75rem;
  }

  .hero-copy {
    padding-inline: 28px;
  }

  .hero-art {
    min-height: 360px;
  }

  .mode-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .cards-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .hero {
    grid-template-columns: 1fr;
  }

  .hero-copy {
    padding-top: 36px;
    padding-bottom: 38px;
  }

  .hero-art {
    min-height: 300px;
  }

  .mode-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 560px) {
  .topbar {
    min-height: 78px;
  }

  .brand-logo {
    height: 44px;
  }

  .nav-links a {
    padding: 0.55rem 0.45rem;
    font-size: 0.55rem;
    letter-spacing: 0.06em;
  }

  .profile-link {
    min-height: 42px;
    padding-inline: 0.65rem;
    font-size: 0.55rem;
    letter-spacing: 0.06em;
  }

  .hero h1 {
    font-size: clamp(2.6rem, 14vw, 4rem);
  }

  .invite-dialog { padding: 22px; }

  .hero-meta {
    gap: 18px 24px;
  }

  .section-heading {
    padding-left: 0;
  }

  .section-index {
    right: 0;
  }

  footer {
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    padding-top: 24px;
    padding-bottom: 24px;
  }
}
</style>
