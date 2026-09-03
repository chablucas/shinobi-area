<script setup lang="ts">
const statistics = [
  { label: 'Parties', value: '0' },
  { label: 'Victoires', value: '0' },
  { label: 'Défaites', value: '0' },
  { label: 'Ratio', value: '0 %' },
]
</script>

<template>
  <main class="profile-page">
    <nav class="profile-nav" aria-label="Navigation principale">
      <a class="brand" href="/" aria-label="Shinobi Area, accueil"><img class="brand-logo" src="/logo.png" alt="" aria-hidden="true" /></a>
      <div class="profile-nav-links"><a href="/solo">Solo</a><a href="/partie">2 joueurs</a><a href="/3-joueurs">3 joueurs</a></div>
      <a class="profile-link active" href="/profil">Profil</a>
    </nav>

    <section class="profile-content" aria-labelledby="profile-title">
      <header class="profile-heading"><p class="eyebrow">Dossier shinobi</p><h1 id="profile-title">Profil</h1><p>Ton parcours apparaîtra ici au fil des parties.</p></header>
      <div class="profile-grid">
        <article class="profile-card profile-identity"><div class="profile-avatar"><img src="/logo.png" alt="" aria-hidden="true" /></div><p class="eyebrow">Joueur local</p><h2>Shinobi</h2><p class="profile-empty">Aucun pseudo enregistré.</p></article>
        <article class="profile-card profile-statistics"><p class="eyebrow">Statistiques</p><div class="stat-grid"><div v-for="stat in statistics" :key="stat.label"><strong>{{ stat.value }}</strong><span>{{ stat.label }}</span></div></div></article>
        <article class="profile-card profile-history"><p class="eyebrow">Historique récent</p><h2>Aucune partie</h2><p>Les résultats de tes combats seront affichés ici.</p></article>
      </div>
    </section>
  </main>
</template>

<style>
.profile-page { min-height: 100vh; background: var(--bg-main); }
.profile-nav { display: flex; align-items: center; justify-content: space-between; gap: 18px; min-height: 78px; padding: 10px max(20px, calc((100vw - 1320px) / 2)); background: var(--accent-orange); }
.profile-nav .brand-logo { display: block; width: auto; height: 52px; object-fit: contain; }
.profile-nav-links { display: flex; gap: 8px; color: #2b2113; text-transform: uppercase; font-size: .68rem; letter-spacing: .1em; }
.profile-nav-links a, .profile-link { padding: .75rem 1.05rem; border: 1px solid rgba(76, 48, 15, .35); background: rgba(255, 214, 102, .34); clip-path: var(--clip-soft); }
.profile-link { color: #fff0bd; background: #2b2113; text-transform: uppercase; letter-spacing: .12em; font-size: .64rem; }
.profile-link.active, .profile-nav-links a:hover, .profile-nav-links a:focus-visible { background: #fff0bd; color: #2b2113; }
.profile-content { max-width: 1180px; margin: 0 auto; padding: 64px max(20px, calc((100vw - 1180px) / 2)) 84px; }
.profile-heading { text-align: center; }
.profile-heading h1 { margin: 14px 0 12px; font-size: clamp(3rem, 7vw, 5.8rem); line-height: .9; text-transform: uppercase; }
.profile-heading > p:last-child, .profile-card > p:last-child { color: var(--text-muted); font-size: .7rem; line-height: 1.7; }
.profile-grid { display: grid; grid-template-columns: .85fr 1.15fr; gap: 18px; margin-top: 42px; }
.profile-card { padding: 26px; border: 1px solid var(--border-light); background: var(--bg-panel); clip-path: var(--clip-soft); }
.profile-identity { grid-row: span 2; text-align: center; }
.profile-avatar { display: grid; place-items: center; width: 150px; height: 150px; margin: 0 auto 24px; border: 1px solid var(--border-strong); background: var(--bg-panel-strong); clip-path: var(--clip-strong); }
.profile-avatar img { width: 76%; height: 76%; object-fit: contain; }
.profile-card h2 { margin: 12px 0 8px; font-size: clamp(1.5rem, 3vw, 2.2rem); text-transform: uppercase; }
.profile-empty { color: var(--text-muted); font-size: .65rem; }
.stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 24px; }
.stat-grid div { padding: 16px 10px; border-left: 2px solid var(--accent-orange); background: var(--bg-panel-strong); }
.stat-grid strong, .stat-grid span { display: block; }
.stat-grid strong { color: var(--accent-gold); font-size: 1.6rem; }
.stat-grid span { margin-top: 6px; color: var(--text-muted); font-size: .55rem; text-transform: uppercase; letter-spacing: .08em; }
.profile-history { min-height: 150px; }
.profile-history h2 { color: var(--text-muted); font-size: 1.2rem; }
@media (max-width: 680px) { .profile-nav-links { gap: 3px; font-size: .55rem; } .profile-nav-links a, .profile-link { padding: .6rem .45rem; } .profile-nav .brand-logo { height: 44px; } .profile-grid { grid-template-columns: 1fr; } .profile-identity { grid-row: auto; } .stat-grid { grid-template-columns: repeat(2, 1fr); } }
</style>
