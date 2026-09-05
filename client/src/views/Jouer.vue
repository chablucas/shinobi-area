<script setup lang="ts">
import { onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import SocialHeader from '../components/SocialHeader.vue'

const auth = useAuthStore()

const modes = [
  { title: '1 VS ORDI', description: 'Construis ton personnage contre l’ordinateur.', href: '/solo', className: 'mode-solo' },
  { title: '1 VS 1', description: 'Construisez chacun votre personnage sur le même appareil.', href: '/partie', className: 'mode-duel' },
  { title: '1 VS 1 VS 1', description: 'Trois joueurs construisent chacun leur personnage.', href: '/3-joueurs', className: 'mode-triple' },
]

onMounted(() => auth.loadCurrentUser())
</script>

<template>
  <main class="mode-page">
    <SocialHeader />
    <section class="mode-content" aria-labelledby="mode-title">
      <header class="mode-heading"><p class="eyebrow">Sélection de mission</p><h1 id="mode-title">Crée ton perso</h1><p>Choisis ton terrain avant d’entrer dans l’arène.</p></header>
      <div class="mode-choice-grid">
        <article v-for="mode in modes" :key="mode.href" class="mode-choice" :class="mode.className"><p class="mode-number">0{{ modes.indexOf(mode) + 1 }}</p><h2>{{ mode.title }}</h2><p>{{ mode.description }}</p><a class="mode-play" :href="mode.href">Jouer <span>→</span></a></article>
      </div>
    </section>
  </main>
</template>

<style scoped>
.mode-page { min-height: 100vh; background: var(--bg-main); overflow-x: hidden; }
.mode-content { max-width: 1240px; margin: 0 auto; padding: 48px max(16px, calc((100vw - 1240px) / 2)) 80px; box-sizing: border-box; }
.mode-heading { text-align: center; }
.mode-heading h1 { margin: 10px 0 8px; font-size: clamp(2.4rem, 6vw, 4.5rem); line-height: .95; text-transform: uppercase; letter-spacing: -0.04em; }
.mode-heading > p:last-child { color: var(--text-muted); font-size: .72rem; line-height: 1.6; }
.mode-choice-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px; margin-top: 36px; }
.mode-choice { display: flex; min-height: 320px; flex-direction: column; padding: 24px; border: 1px solid var(--border-light); background: var(--bg-panel); clip-path: var(--clip-strong); box-sizing: border-box; transition: transform 0.2s ease, border-color 0.2s ease; }
.mode-choice:hover { transform: translateY(-3px); }
.mode-solo { border-color: rgba(245,166,35,.58); background: linear-gradient(135deg, rgba(46, 26, 18, 0.9), rgba(26, 28, 32, 0.95)); }
.mode-duel { border-color: rgba(84,196,255,.5); background: linear-gradient(135deg, rgba(16, 32, 42, 0.9), rgba(26, 28, 32, 0.95)); }
.mode-triple { border-color: rgba(138,217,184,.5); background: linear-gradient(135deg, rgba(20, 36, 28, 0.9), rgba(26, 28, 32, 0.95)); }
.mode-number { color: var(--accent-gold); font-size: .62rem; letter-spacing: .14em; font-weight: 700; }
.mode-choice h2 { margin-top: auto; font-size: clamp(1.6rem, 3vw, 2.4rem); text-transform: uppercase; letter-spacing: -0.03em; }
.mode-choice > p:not(.mode-number) { max-width: 280px; min-height: 44px; margin-top: 10px; color: var(--text-muted); font-size: .7rem; line-height: 1.6; }
.mode-play { display: flex; align-items: center; justify-content: space-between; margin-top: 24px; min-height: 46px; padding: 12px 18px; background: var(--accent-orange); color: #1a150e; font-size: .68rem; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; clip-path: var(--clip-soft); text-decoration: none; touch-action: manipulation; transition: transform 0.2s ease, background 0.2s ease; }
.mode-play:hover { background: var(--accent-gold); transform: translateY(-1px); }
.mode-play span { font-size: 1.1rem; }
@media (max-width: 860px) { .mode-choice-grid { grid-template-columns: 1fr; margin-top: 28px; } .mode-choice { min-height: auto; } .mode-choice > p:not(.mode-number) { min-height: auto; } }
</style>
