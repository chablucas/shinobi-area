<script setup lang="ts">
import { onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'

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
    <nav class="mode-nav" aria-label="Navigation principale">
      <a class="brand" href="/" aria-label="Shinobi Area, accueil"><img class="brand-logo" src="/logo.png" alt="" aria-hidden="true" /></a>
      <a class="create-link active" href="/jouer">Créer ton perso</a>
      <a class="profile-link" :href="auth.isAuthenticated ? '/profil' : '/connexion'">{{ auth.isAuthenticated ? 'Profil' : 'Connexion' }}</a>
    </nav>
    <section class="mode-content" aria-labelledby="mode-title">
      <header class="mode-heading"><p class="eyebrow">Sélection de mission</p><h1 id="mode-title">Crée ton perso</h1><p>Choisis ton terrain avant d’entrer dans l’arène.</p></header>
      <div class="mode-choice-grid">
        <article v-for="mode in modes" :key="mode.href" class="mode-choice" :class="mode.className"><p class="mode-number">0{{ modes.indexOf(mode) + 1 }}</p><h2>{{ mode.title }}</h2><p>{{ mode.description }}</p><a class="mode-play" :href="mode.href">Jouer <span>→</span></a></article>
      </div>
    </section>
  </main>
</template>

<style>
.mode-page { min-height: 100vh; background: var(--bg-main); }
.mode-nav { display: flex; align-items: center; justify-content: space-between; gap: 20px; min-height: 78px; padding: 10px max(20px, calc((100vw - 1320px) / 2)); background: var(--accent-orange); }
.mode-nav .brand-logo { width: auto; height: 52px; object-fit: contain; }
.create-link, .mode-nav .profile-link { display: inline-flex; align-items: center; justify-content: center; min-height: 42px; padding: .75rem 1.2rem; border: 1px solid rgba(76,48,15,.42); background: #fff0bd; color: #2b2113; clip-path: var(--clip-soft); text-transform: uppercase; letter-spacing: .1em; font-size: .64rem; font-weight: 700; }
.mode-nav .profile-link { background: #2b2113; color: #fff0bd; }
.mode-content { max-width: 1240px; margin: 0 auto; padding: 68px max(20px, calc((100vw - 1240px) / 2)) 90px; }
.mode-heading { text-align: center; }
.mode-heading h1 { margin: 14px 0; font-size: clamp(3rem, 8vw, 6rem); line-height: .9; text-transform: uppercase; }
.mode-heading > p:last-child { color: var(--text-muted); font-size: .7rem; }
.mode-choice-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px; margin-top: 52px; }
.mode-choice { display: flex; min-height: 350px; flex-direction: column; padding: 24px; border: 1px solid var(--border-light); background: var(--bg-panel); clip-path: var(--clip-strong); }
.mode-solo { border-color: rgba(245,166,35,.58); }
.mode-duel { border-color: rgba(84,196,255,.5); }
.mode-triple { border-color: rgba(138,217,184,.5); }
.mode-number { color: var(--accent-gold); font-size: .62rem; letter-spacing: .14em; }
.mode-choice h2 { margin-top: auto; font-size: clamp(1.7rem, 3vw, 2.8rem); text-transform: uppercase; }
.mode-choice > p:not(.mode-number) { max-width: 250px; min-height: 48px; margin-top: 14px; color: var(--text-muted); font-size: .68rem; line-height: 1.7; }
.mode-play { display: flex; align-items: center; justify-content: space-between; margin-top: 28px; padding: 14px 16px; background: var(--accent-orange); color: #2b2113; font-size: .65rem; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
.mode-play span { font-size: 1.2rem; }
@media (max-width: 680px) { .mode-nav .brand-logo { height: 44px; } .mode-nav { gap: 8px; } .create-link, .mode-nav .profile-link { padding-inline: .55rem; font-size: .54rem; } .mode-content { padding-top: 48px; } .mode-choice-grid { grid-template-columns: 1fr; margin-top: 36px; } .mode-choice { min-height: 260px; } }
</style>
