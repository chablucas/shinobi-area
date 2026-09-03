<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { fetchAllCards } from './services/cardApi'

const modes = [
  { number: '01', eyebrow: 'Forge ton identité', title: 'Création de personnage', description: 'Compose un shinobi qui te ressemble, de son clan à sa technique signature.', accent: 'coral' },
  { number: '02', eyebrow: 'Lis le terrain', title: 'Combat 1v1', description: 'Affronte un rival en duel tactique et retourne la situation au bon moment.', accent: 'mint' },
  { number: '03', eyebrow: 'Pense plusieurs coups', title: 'Défi de cartes', description: 'Mets ton deck à l’épreuve dans des défis courts, imprévisibles et nerveux.', accent: 'gold' },
]

const cards = ref<Awaited<ReturnType<typeof fetchAllCards>>>([])
const failedImages = ref(new Set<string>())

onMounted(async () => {
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
      <a class="brand" href="#accueil" aria-label="Shinobi Area, accueil"><span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span><span>Shinobi <em>Area</em></span></a>
      <div class="nav-links"><a href="#univers">L’univers</a><a href="#modes">Modes de jeu</a></div>
      <a class="nav-cta" href="/partie">Entrer dans l’arène <span>↗</span></a>
    </nav>

    <section id="accueil" class="hero">
      <div class="hero-copy">
        <p class="kicker"><span class="kicker-dot"></span>La voie commence ici</p>
        <h1>Trace ta voie.<br /><span>Défie le monde.</span></h1>
        <p class="intro">Shinobi Area est un jeu de stratégie où chaque choix forge ta légende. Crée ton guerrier, maîtrise tes cartes et impose ton style.</p>
        <div id="creer" class="hero-actions"><a class="button button-primary" href="/partie">Créer mon shinobi <span>→</span></a><a class="button button-quiet" href="/partie"><span class="play-icon">▶</span> Lancer un combat</a></div>
        <div class="hero-meta"><div><strong>03</strong><span>voies à<br />explorer</span></div><div><strong>∞</strong><span>combats<br />possibles</span></div><div><strong>01</strong><span>légende<br />à écrire</span></div></div>
      </div>
      <div class="hero-art" aria-label="Emblème abstrait de Shinobi Area"><div class="sun-disc"></div><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div><div class="crest"><span>影</span></div><span class="art-label label-top">N° 001 / SECTOR</span><span class="art-label label-bottom">DISCIPLINE · INSTINCT · HONNEUR</span></div>
    </section>

    <section id="modes" class="modes-section"><div class="section-heading" id="univers"><p class="kicker"><span class="kicker-dot"></span>Choisis ton terrain</p><h2>Trois façons<br /><i>de devenir légende.</i></h2><span class="section-index">/ 03</span></div>
      <div class="mode-grid"><a v-for="mode in modes" :id="mode.number === '02' ? 'combat' : undefined" :key="mode.number" class="mode-card" :class="`mode-${mode.accent}`" href="#creer"><div class="card-top"><span>{{ mode.number }}</span><span class="arrow">↗</span></div><div class="card-symbol" aria-hidden="true"><span v-if="mode.number === '01'">◈</span><span v-else-if="mode.number === '02'">✦</span><span v-else>⌘</span></div><p>{{ mode.eyebrow }}</p><h3>{{ mode.title }}</h3><span class="card-description">{{ mode.description }}</span></a></div>
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
  background:
    radial-gradient(circle at 18% 10%, rgba(246, 128, 72, 0.18), transparent 18%),
    radial-gradient(circle at 82% 4%, rgba(84, 196, 255, 0.12), transparent 20%),
    linear-gradient(180deg, var(--bg-main) 0%, #0b1015 100%);
  overflow: hidden;
}

.site-shell::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.015), transparent 36%),
    linear-gradient(315deg, rgba(84, 196, 255, 0.05), transparent 30%);
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
  align-items: center;
  justify-content: space-between;
  min-height: 94px;
  border-bottom: 1px solid var(--border-light);
  padding-top: 16px;
  padding-bottom: 16px;
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  font-size: 1.05rem;
  letter-spacing: -0.04em;
  text-transform: uppercase;
}

.brand em {
  color: var(--accent-orange);
  font-style: normal;
}

.brand-mark {
  position: relative;
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border: 1px solid rgba(246, 128, 72, 0.9);
  box-shadow: var(--shadow-glow-orange);
  transform: rotate(45deg);
}

.brand-mark i {
  display: block;
  width: 2px;
  height: 16px;
  background: linear-gradient(180deg, var(--accent-orange), rgba(246, 128, 72, 0.4));
  transform: skewX(-22deg);
}

.brand-mark i:nth-child(2) {
  height: 22px;
  background: linear-gradient(180deg, var(--accent-gold), rgba(241, 212, 141, 0.4));
}

.nav-links {
  display: flex;
  align-items: center;
  gap: 30px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 0.62rem;
}

.nav-links a {
  opacity: 0.8;
  transition: opacity 0.2s ease, color 0.2s ease;
}

.nav-links a:hover,
.nav-links a:focus-visible {
  color: var(--text-main);
  opacity: 1;
}

.nav-cta,
.button,
.button-primary,
.button-quiet {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.9rem;
  min-height: 46px;
  padding: 0.85rem 1.1rem;
  border: 1px solid rgba(161, 176, 175, 0.28);
  background: rgba(15, 20, 27, 0.72);
  color: var(--text-main);
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 0.64rem;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}

.nav-cta:hover,
.button:hover,
.button-primary:hover,
.button-quiet:hover {
  transform: translateY(-1px);
  border-color: rgba(246, 128, 72, 0.8);
  box-shadow: var(--shadow-glow-orange);
}

.nav-cta span,
.button span,
.button-primary span,
.button-quiet span {
  color: var(--accent-orange);
}

.hero {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 0.8fr);
  align-items: center;
  gap: 36px;
  min-height: 630px;
}

.hero-copy {
  position: relative;
  z-index: 1;
  padding: 76px 0 56px;
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
  height: 560px;
}

.sun-disc {
  width: min(32vw, 400px);
  aspect-ratio: 1;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, rgba(255, 248, 224, 0.9), rgba(246, 128, 72, 0.95) 26%, rgba(101, 28, 18, 0.8) 72%, rgba(15, 24, 32, 0.9) 100%);
  box-shadow: 0 0 30px rgba(246, 128, 72, 0.34), 0 0 80px rgba(246, 128, 72, 0.18);
}

.orbit {
  position: absolute;
  width: 88%;
  height: 42%;
  border: 1px solid rgba(138, 233, 255, 0.3);
  border-radius: 50%;
  transform: rotate(-28deg);
}

.orbit-two {
  width: 72%;
  height: 62%;
  border-color: rgba(241, 212, 141, 0.22);
  transform: rotate(36deg);
}

.crest {
  position: absolute;
  display: grid;
  place-items: center;
  width: min(25vw, 290px);
  aspect-ratio: 1;
  border: 1px solid rgba(243, 245, 242, 0.65);
  background: rgba(9, 12, 16, 0.14);
  transform: rotate(45deg);
  box-shadow: inset 0 0 0 1px rgba(243, 245, 242, 0.15);
}

.crest::before,
.crest::after {
  content: '';
  position: absolute;
  width: 120%;
  height: 1px;
  background: rgba(243, 245, 242, 0.26);
}

.crest::after {
  transform: rotate(90deg);
}

.crest span {
  font-family: 'Syne', 'Segoe UI', sans-serif;
  font-size: clamp(4rem, 5vw, 6.2rem);
  font-weight: 700;
  transform: rotate(-45deg);
  color: rgba(243, 245, 242, 0.9);
  text-shadow: 0 0 20px rgba(84, 196, 255, 0.25);
}

.art-label {
  position: absolute;
  color: var(--accent-gold);
  font-size: 0.58rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.label-top {
  top: 12%;
  right: 5%;
}

.label-bottom {
  bottom: 10%;
  left: 8%;
  color: rgba(255, 255, 255, 0.65);
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
  .nav-links {
    display: none;
  }

  .hero {
    grid-template-columns: 1fr;
    min-height: auto;
  }

  .hero-copy {
    padding-top: 48px;
  }

  .hero-art {
    height: 440px;
  }

  .mode-grid {
    grid-template-columns: 1fr;
  }

  .cards-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 560px) {
  .topbar {
    min-height: 78px;
  }

  .nav-cta {
    min-height: 42px;
    padding-inline: 0.8rem;
    letter-spacing: 0.08em;
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
