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
          <div v-if="!card.imageUrl || failedImages.has(card.slug)" class="image-fallback" aria-hidden="true">{{ card.name.slice(0, 1) }}</div>
          <img v-else :src="card.imageUrl" :alt="`Carte ${card.name}`" loading="lazy" @error="markImageAsFailed(card.slug)" />
          <h3>{{ card.name }}</h3>
        </article>
      </div>
    </section>
    <footer><span>SHINOBI AREA</span><span>La nuit appartient à ceux qui osent.</span><span>© 2026</span></footer>
  </main>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Syne:wght@400;600;700;800&display=swap');
:root { font-family: 'DM Mono', monospace; color: #f2eee7; background: #111312; font-synthesis: none; } * { box-sizing: border-box; } html { scroll-behavior: smooth; } body { margin: 0; min-width: 320px; } a { color: inherit; text-decoration: none; }
.site-shell { min-height: 100vh; overflow: hidden; position: relative; background: #111312; } .noise { position: absolute; inset: 0; pointer-events: none; opacity: .08; background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.28'/%3E%3C/svg%3E"); }
.topbar, .hero, .modes-section, footer { max-width: 1320px; margin: auto; position: relative; z-index: 1; } .topbar { height: 92px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #303430; } .brand { display: flex; align-items: center; gap: 12px; font: 700 17px 'Syne', sans-serif; letter-spacing: -.04em; } .brand em { color: #ee7860; font-style: normal; } .brand-mark { width: 29px; height: 29px; display: flex; gap: 3px; align-items: center; justify-content: center; border: 1px solid #ee7860; transform: rotate(45deg); } .brand-mark i { width: 2px; height: 15px; display: block; background: #ee7860; transform: skew(-22deg); } .brand-mark i:nth-child(2) { height: 20px; background: #e7c57e; }
.nav-links { display: flex; gap: 36px; margin-left: 12%; color: #929890; font-size: 11px; } .nav-links a:hover { color: #f2eee7; } .nav-cta { border: 1px solid #4b514d; padding: 12px 15px; font-size: 10px; transition: .2s; } .nav-cta span { color: #ee7860; margin-left: 10px; } .nav-cta:hover { border-color: #ee7860; }
.hero { min-height: 610px; display: grid; grid-template-columns: 1fr .9fr; align-items: center; } .hero-copy { padding: 76px 0 58px 7%; animation: rise .7s ease both; } .kicker { color: #e7c57e; text-transform: uppercase; font-size: 10px; letter-spacing: .14em; display: flex; align-items: center; gap: 9px; } .kicker-dot { width: 6px; height: 6px; background: #ee7860; display: inline-block; border-radius: 50%; box-shadow: 0 0 14px #ee7860; } h1, h2, h3 { font-family: 'Syne', sans-serif; } h1 { font-size: clamp(48px, 6vw, 86px); line-height: .96; letter-spacing: -.075em; margin: 27px 0; font-weight: 700; } h1 span { color: #ee7860; } .intro { max-width: 390px; color: #a4aaa3; font-size: 12px; line-height: 1.8; } .hero-actions { display: flex; gap: 12px; margin-top: 33px; flex-wrap: wrap; } .button { font: 500 11px 'DM Mono', monospace; padding: 15px 18px; display: inline-flex; align-items: center; gap: 22px; } .button-primary { color: #191a17; background: #e7c57e; } .button-primary:hover { background: #f0d995; } .button-quiet { border: 1px solid #4a504b; color: #e4e7df; gap: 10px; } .button-quiet:hover { border-color: #e7c57e; } .play-icon { color: #ee7860; font-size: 9px; }
.hero-meta { border-top: 1px solid #303430; max-width: 480px; margin-top: 63px; padding-top: 18px; display: flex; gap: 45px; } .hero-meta div { display: flex; align-items: center; gap: 9px; } .hero-meta strong { color: #e7c57e; font: 700 22px 'Syne', sans-serif; } .hero-meta span { color: #7f867f; font-size: 9px; line-height: 1.4; text-transform: uppercase; }
.hero-art { height: 530px; position: relative; display: flex; align-items: center; justify-content: center; } .sun-disc { width: min(34vw, 400px); aspect-ratio: 1; background: #d76450; border-radius: 50%; opacity: .92; } .crest { width: min(23vw, 275px); aspect-ratio: 1; position: absolute; display: grid; place-items: center; border: 1px solid rgba(242,238,231,.75); transform: rotate(45deg); } .crest:before, .crest:after { content: ''; position: absolute; width: 140%; height: 1px; background: rgba(242,238,231,.25); } .crest:after { transform: rotate(90deg); } .crest span { color: #f2eee7; font: 100px 'Syne', sans-serif; transform: rotate(-45deg); opacity: .9; } .orbit { position: absolute; width: 95%; height: 35%; border: 1px solid rgba(231,197,126,.4); border-radius: 50%; transform: rotate(-32deg); } .orbit-two { width: 78%; height: 55%; transform: rotate(58deg); border-color: rgba(242,238,231,.18); } .art-label { position: absolute; color: #f0d995; font-size: 9px; letter-spacing: .16em; } .label-top { top: 17%; right: 4%; } .label-bottom { bottom: 11%; left: 10%; color: #9b6a5f; }
.modes-section { border-top: 1px solid #303430; padding: 70px 0 85px; } .section-heading { position: relative; padding-left: 7%; margin-bottom: 44px; } .section-heading h2 { font-size: clamp(30px, 4vw, 55px); line-height: .98; letter-spacing: -.07em; margin: 21px 0 0; } .section-heading h2 i { color: #aeb5ad; font-style: normal; } .section-index { position: absolute; right: 7%; bottom: 0; color: #656c65; font-size: 11px; } .mode-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; } .mode-card { min-height: 315px; border: 1px solid #383e39; padding: 21px 22px; display: flex; flex-direction: column; transition: transform .25s, border-color .25s; } .mode-card:hover { transform: translateY(-6px); border-color: #e7c57e; } .mode-coral { background: #302421; } .mode-mint { background: #202b28; } .mode-gold { background: #302c20; } .card-top { display: flex; justify-content: space-between; color: #969e96; font-size: 10px; } .arrow { color: #e7c57e; font-size: 18px; } .card-symbol { margin: 33px 0 25px; font-size: 38px; color: #ee7860; } .mode-mint .card-symbol { color: #a6d0b8; } .mode-gold .card-symbol { color: #e7c57e; } .mode-card p { color: #a9b0a8; font-size: 10px; margin: auto 0 8px; text-transform: uppercase; letter-spacing: .08em; } .mode-card h3 { font-size: 22px; letter-spacing: -.06em; margin: 0 0 15px; } .card-description { color: #969e96; font-size: 10px; line-height: 1.7; max-width: 270px; }
.cards-section { border-top: 1px solid #303430; padding: 70px 0 85px; } .cards-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 14px; } .character-card { border: 1px solid #383e39; background: #202421; overflow: hidden; } .character-card img, .image-fallback { display: block; width: 100%; aspect-ratio: 2 / 3; object-fit: cover; } .image-fallback { display: grid; place-items: center; color: #e7c57e; background: #302421; font: 700 42px 'Syne', sans-serif; } .character-card h3 { margin: 14px; font-size: 14px; letter-spacing: -.03em; }
footer { border-top: 1px solid #303430; padding: 24px 0; display: flex; justify-content: space-between; color: #707770; font-size: 9px; letter-spacing: .12em; } footer span:first-child { color: #ee7860; } @keyframes rise { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
@media (max-width: 800px) { .topbar, .hero, .modes-section, .cards-section, footer { margin-left: 20px; margin-right: 20px; } .nav-links { display: none; } .hero { grid-template-columns: 1fr; } .hero-copy { padding: 70px 0 20px; } .hero-art { height: 390px; } .sun-disc { width: 300px; } .crest { width: 210px; } .hero-meta { margin-top: 45px; gap: 20px; } .modes-section, .cards-section { padding-top: 52px; } .mode-grid { grid-template-columns: 1fr; } .cards-grid { grid-template-columns: repeat(2, 1fr); } .mode-card { min-height: 250px; } .card-symbol { margin: 20px 0 18px; } footer { gap: 16px; flex-wrap: wrap; } }
@media (max-width: 430px) { .topbar { height: 75px; } .nav-cta { padding: 10px; font-size: 9px; } .hero-copy { padding-top: 57px; } h1 { font-size: 48px; } .hero-meta { gap: 11px; } .hero-meta strong { font-size: 18px; } .hero-meta span { font-size: 8px; } .label-top { right: 0; } .label-bottom { left: 0; } .section-index { right: 0; } }
</style>
