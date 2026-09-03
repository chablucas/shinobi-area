<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { CATEGORY_DEFINITIONS } from '../game/gameEngine'
import { deleteBuild, fetchBuilds, type SavedBuild } from '../services/buildApi'
import { useAuthStore } from '../stores/auth'
import SocialHeader from '../components/SocialHeader.vue'
import { listFriends, type Friend } from '../services/socialApi'

const auth = useAuthStore()
const router = useRouter()
const builds = ref<SavedBuild[]>([])
const selectedBuild = ref<SavedBuild | null>(null)
const editing = ref(false)
const displayName = ref('')
const error = ref('')
const total = computed(() => (auth.user?.wins ?? 0) + (auth.user?.losses ?? 0))
const winRate = computed(() => total.value ? Math.round(((auth.user?.wins ?? 0) / total.value) * 100) : 0)
const friends = ref<Friend[]>([])
const friendsOpen = ref(false)

onMounted(async () => {
  await auth.loadCurrentUser()
  if (!auth.isAuthenticated || !auth.token) { await router.replace('/connexion'); return }
  displayName.value = auth.user?.displayName ?? ''
  try { builds.value = await fetchBuilds(auth.token) } catch (exception) { error.value = exception instanceof Error ? exception.message : 'Impossible de charger les compositions.' }
  friends.value = await listFriends(auth.token).catch(() => [])
})

async function saveName() { try { await auth.updateProfile(displayName.value); editing.value = false } catch (exception) { error.value = exception instanceof Error ? exception.message : 'Impossible de modifier le profil.' } }
function logout() { auth.logout(); void router.push('/') }
async function removeBuild(build: SavedBuild) { if (!auth.token || !window.confirm('Supprimer cette composition ?')) return; try { await deleteBuild(auth.token, build.id); builds.value = builds.value.filter((item) => item.id !== build.id); if (selectedBuild.value?.id === build.id) selectedBuild.value = null } catch (exception) { error.value = exception instanceof Error ? exception.message : 'Suppression impossible.' } }
function categoryLabel(slug: string) { return CATEGORY_DEFINITIONS.find(([, itemSlug]) => itemSlug === slug)?.[0] ?? slug }
</script>

<template>
  <main class="profile-page">
    <SocialHeader />

    <section class="profile-content" aria-labelledby="profile-title">
      <header class="profile-heading"><p class="eyebrow">Dossier shinobi</p><h1 id="profile-title">Profil</h1><p>Ton parcours apparaîtra ici au fil des parties.</p></header>
      <div v-if="auth.user" class="profile-grid">
        <article class="profile-card profile-identity"><div class="profile-avatar"><img src="/logo.png" alt="" aria-hidden="true" /></div><p class="eyebrow">Joueur local</p><h2>{{ auth.user.displayName }}</h2><p class="profile-email">{{ auth.user.email }}</p><button v-if="!editing" class="profile-action" type="button" @click="editing = true">Modifier le profil</button><div v-else class="edit-profile"><input v-model.trim="displayName" aria-label="Nom du profil" /><div><button class="profile-action" type="button" @click="saveName">Sauvegarder</button><button class="profile-cancel" type="button" @click="editing = false">Annuler</button></div></div></article>
        <article class="profile-card profile-statistics"><p class="eyebrow">Statistiques</p><div class="stat-grid"><div><strong>{{ auth.user.wins }}</strong><span>Victoires</span></div><div><strong>{{ auth.user.losses }}</strong><span>Défaites</span></div><div><strong>{{ total }}</strong><span>Parties</span></div><div><strong>{{ winRate }} %</strong><span>Taux de victoire</span></div></div></article>
        <article class="profile-card saved-builds"><p class="eyebrow">Persos sauvegardés</p><p v-if="!builds.length" class="profile-empty">Aucune composition sauvegardée.</p><div v-for="build in builds" :key="build.id" class="saved-build"><div><strong>{{ build.name }}</strong><small>{{ new Date(build.createdAt).toLocaleDateString('fr-FR') }}</small><div class="build-preview"><img v-for="slot in build.slots.slice(0, 4)" :key="slot.id" :src="slot.card.imageUrl ?? '/logo.png'" :alt="slot.card.name" /></div></div><div class="saved-actions"><button class="profile-action" type="button" @click="selectedBuild = build">Voir</button><button class="profile-cancel" type="button" @click="removeBuild(build)">Supprimer</button></div></div></article>
        <article class="profile-card social-card"><div class="social-card-heading"><div><p class="eyebrow">Réseau</p><h2>Amis ({{ friends.length }})</h2></div><button class="profile-action" type="button" @click="friendsOpen = !friendsOpen">{{ friendsOpen ? 'Fermer' : 'Voir' }}</button></div><div v-if="friendsOpen" class="friends-list"><div v-for="friend in friends" :key="friend.id" class="friend-row"><span class="profile-friend-avatar">{{ friend.displayName.slice(0, 1) }}</span><strong>{{ friend.displayName }}</strong><a class="profile-cancel" :href="`/profil-public/${friend.id}`">Voir le profil</a></div><p v-if="!friends.length" class="profile-empty">Aucun ami pour le moment.</p></div></article>
      </div>
      <p v-if="error" class="profile-error">{{ error }}</p>
      <article v-if="selectedBuild" class="profile-card build-detail"><div class="detail-heading"><div><p class="eyebrow">Composition sauvegardée</p><h2>{{ selectedBuild.name }}</h2></div><button class="profile-cancel" type="button" @click="selectedBuild = null">Fermer</button></div><div class="detail-grid"><div v-for="[label, slug] in CATEGORY_DEFINITIONS" :key="slug" class="detail-slot"><span>{{ label }}</span><img v-if="selectedBuild.slots.find((slot) => slot.categorySlug === slug)?.card.imageUrl" :src="selectedBuild.slots.find((slot) => slot.categorySlug === slug)?.card.imageUrl ?? undefined" :alt="selectedBuild.slots.find((slot) => slot.categorySlug === slug)?.card.name" /><strong>{{ selectedBuild.slots.find((slot) => slot.categorySlug === slug)?.card.name ?? 'Carte introuvable' }}</strong></div></div></article>
    </section>
  </main>
</template>

<style>
.profile-page { min-height: 100vh; background: var(--bg-main); }
.profile-nav { display: flex; align-items: center; justify-content: space-between; gap: 18px; min-height: 78px; padding: 10px max(20px, calc((100vw - 1320px) / 2)); background: var(--accent-orange); }
.profile-nav .brand-logo { display: block; width: auto; height: 52px; object-fit: contain; }
.profile-nav .create-link { display: inline-flex; align-items: center; justify-content: center; min-height: 42px; padding: .75rem 1.2rem; border: 1px solid rgba(76,48,15,.42); background: #fff0bd; color: #2b2113; clip-path: var(--clip-soft); text-transform: uppercase; letter-spacing: .1em; font-size: .64rem; font-weight: 700; }
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
.profile-email { color: var(--text-muted); font-size: .65rem; }
.profile-action, .profile-cancel { min-height: 38px; padding: .65rem .8rem; border: 1px solid var(--border-strong); background: var(--accent-orange); color: #242629; font-size: .58rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
.profile-cancel { border-color: var(--border-light); background: var(--bg-panel-strong); color: var(--text-main); }
.edit-profile { display: grid; gap: 10px; margin-top: 18px; }
.edit-profile input { padding: 11px; border: 1px solid var(--border-light); background: var(--bg-panel-strong); color: var(--text-main); }
.edit-profile div, .saved-actions, .detail-heading { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; justify-content: space-between; }
.saved-build { display: flex; justify-content: space-between; gap: 16px; padding: 16px 0; border-top: 1px solid var(--border-light); }
.saved-build strong, .saved-build small { display: block; }
.saved-build small { margin-top: 5px; color: var(--text-muted); font-size: .58rem; }
.build-preview { display: flex; gap: 5px; margin-top: 10px; }
.build-preview img { width: 34px; height: 48px; object-fit: cover; border: 1px solid var(--border-light); }
.profile-error { margin-top: 18px; color: var(--accent-red); font-size: .68rem; }
.build-detail { margin-top: 18px; }
.detail-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; margin-top: 22px; }
.detail-slot { min-width: 0; padding: 9px; background: var(--bg-panel-strong); border: 1px solid var(--border-light); }
.detail-slot span, .detail-slot strong { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.detail-slot span { color: var(--accent-gold); font-size: .5rem; text-transform: uppercase; }
.detail-slot img { width: 100%; height: 130px; margin: 8px 0; object-fit: cover; }
.detail-slot strong { color: var(--text-main); font-size: .58rem; }
.profile-card h2 { margin: 12px 0 8px; font-size: clamp(1.5rem, 3vw, 2.2rem); text-transform: uppercase; }
.profile-empty { color: var(--text-muted); font-size: .65rem; }
.stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 24px; }
.stat-grid div { padding: 16px 10px; border-left: 2px solid var(--accent-orange); background: var(--bg-panel-strong); }
.stat-grid strong, .stat-grid span { display: block; }
.stat-grid strong { color: var(--accent-gold); font-size: 1.6rem; }
.stat-grid span { margin-top: 6px; color: var(--text-muted); font-size: .55rem; text-transform: uppercase; letter-spacing: .08em; }
.profile-history { min-height: 150px; }
.profile-history h2 { color: var(--text-muted); font-size: 1.2rem; }
@media (max-width: 680px) { .profile-nav-links { gap: 3px; font-size: .55rem; } .profile-nav-links a, .profile-link { padding: .6rem .45rem; } .profile-nav .brand-logo { height: 44px; } .profile-grid { grid-template-columns: 1fr; } .profile-identity { grid-row: auto; } .stat-grid { grid-template-columns: repeat(2, 1fr); } .detail-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } .saved-build { display: grid; } }
</style>
