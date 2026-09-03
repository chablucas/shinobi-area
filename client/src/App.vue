<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { fetchAllCards } from './services/cardApi'
import { useAuthStore } from './stores/auth'

const modes = [
  { number: '01', eyebrow: 'Forge ton identité', title: 'Création de personnage', description: 'Compose un shinobi qui te ressemble, de son clan à sa technique signature.', accent: 'coral' },
  { number: '02', eyebrow: 'Lis le terrain', title: 'Combat 1v1', description: 'Affronte un rival en duel tactique et retourne la situation au bon moment.', accent: 'mint' },
  { number: '03', eyebrow: 'Pense plusieurs coups', title: 'Défi de cartes', description: 'Mets ton deck à l’épreuve dans des défis courts, imprévisibles et nerveux.', accent: 'gold' },
]

const cards = ref<Awaited<ReturnType<typeof fetchAllCards>>>([])
const failedImages = ref(new Set<string>())
const auth = useAuthStore()

onMounted(async () => {
  await auth.loadCurrentUser()
  try {
    cards.value = await fetchAllCards()
  } catch {
    cards.value = []
  }
})

function markImageAsFailed(slug: string) {
  failedImages.value = new Set(failedImages.value).add(slug)
}
</script>

<template>
  <main class="site-shell">
    <div class="noise" aria-hidden="true"></div>
    <nav class="topbar" aria-label="Navigation principale">
      <a class="brand" href="#accueil" aria-label="Shinobi Area, accueil"><img class="brand-logo" src="/logo.png" alt="" aria-hidden="true" /></a>
      <div class="nav-links"><a class="nav-tab active" href="/solo">Solo</a><a class="nav-tab" href="/partie">2 joueurs</a><a class="nav-tab" href="/3-joueurs">3 joueurs</a></div>
      <a class="profile-link" :href="auth.isAuthenticated ? '/profil' : '/connexion'">{{ auth.isAuthenticated ? 'Profil' : 'Connexion' }}</a>
    </nav>

    <section id="accueil" class="hero">
      <div class="hero-copy">
        <p class="kicker"><span class="kicker-dot"></span>La voie commence ici</p>
        <h1>Trace ta voie.<br /><span>Défie le monde.</span></h1>
        <p class="intro">Shinobi Area est un jeu de stratégie où chaque choix forge ta légende. Crée ton guerrier, maîtrise tes cartes et impose ton style.</p>
        <div id="creer" class="hero-actions"><a class="button button-primary" href="/partie">Jouer à 2 <span>→</span></a><a class="button button-quiet" href="/solo">Jouer en solo <span>→</span></a></div>
        <div class="hero-meta"><div><strong>03</strong><span>voies à<br />explorer</span></div><div><strong>∞</strong><span>combats<br />possibles</span></div><div><strong>01</strong><span>légende<br />à écrire</span></div></div>
      </div>
      <div class="hero-art" aria-label="Logo Shinobi Area"><img src="/logo.png" alt="Logo Shinobi Area" /></div>
    </section>

    <section id="modes" class="modes-section"><div class="section-heading" id="univers"><p class="kicker"><span class="kicker-dot"></span>Choisis ton terrain</p><h2>Trois façons<br /><i>de devenir légende.</i></h2><span class="section-index">/ 03</span></div>
      <div class="mode-grid"><a v-for="mode in modes" :id="mode.number === '02' ? 'combat' : undefined" :key="mode.number" class="mode-card" :class="`mode-${mode.accent}`" :href="mode.number === '01' ? '/solo' : mode.number === '02' ? '/partie' : '/3-joueurs'"><div class="card-top"><span>{{ mode.number }}</span><span class="arrow">↗</span></div><div class="card-symbol" aria-hidden="true"><span v-if="mode.number === '01'">◈</span><span v-else-if="mode.number === '02'">✦</span><span v-else>⌘</span></div><p>{{ mode.eyebrow }}</p><h3>{{ mode.title }}</h3><span class="card-description">{{ mode.description }}</span></a></div>
    </section>
    <section v-if="cards.length" class="cards-section" aria-labelledby="cards-title">
      <div class="section-heading"><p class="kicker"><span class="kicker-dot"></span>Le catalogue</p><h2 id="cards-title">Les cartes<br /><i>de l’arène.</i></h2><span class="section-index">/ {{ cards.length }}</span></div>
      <div class="cards-grid">
        <article v-for="card in cards" :key="card.id" class="character-card">
          <div class="card-image-surface character-card-media">
            <div v-if="!card.imageUrl || failedImages.has(card.slug)" class="image-fallback card-image-fallback" aria-hidden="true">{{ card.name.slice(0, 1) }}</div>
            <img v-else class="card-image-inner" :src="card.imageUrl" :alt="`Carte ${card.name}`" loading="lazy" @error="markImageAsFailed(card.slug)" />
          </div>
          <h3>{{ card.name }}</h3>
        </article>
      </div>
    </section>
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

.topbar,
.hero,
.modes-section,
.cards-section,
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

.modes-section,
.cards-section {
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
  min-height: 310px;
  padding: 20px 22px 18px;
  background: rgba(18, 24, 31, 0.86);
  border: 1px solid var(--border-light);
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
