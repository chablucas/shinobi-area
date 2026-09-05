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
const friendsOpen = ref(true)

onMounted(async () => {
  await auth.loadCurrentUser()
  if (!auth.isAuthenticated || !auth.token) {
    await router.replace('/connexion')
    return
  }
  displayName.value = auth.user?.displayName ?? ''
  try {
    builds.value = await fetchBuilds(auth.token)
  } catch (exception) {
    error.value = exception instanceof Error ? exception.message : 'Impossible de charger les compositions.'
  }
  friends.value = await listFriends(auth.token).catch(() => [])
})

async function saveName() {
  try {
    await auth.updateProfile(displayName.value)
    editing.value = false
  } catch (exception) {
    error.value = exception instanceof Error ? exception.message : 'Impossible de modifier le profil.'
  }
}

function handleLogout() {
  auth.logout()
  void router.push('/connexion')
}

async function removeBuild(build: SavedBuild) {
  if (!auth.token || !window.confirm('Supprimer cette composition ?')) return
  try {
    await deleteBuild(auth.token, build.id)
    builds.value = builds.value.filter((item) => item.id !== build.id)
    if (selectedBuild.value?.id === build.id) selectedBuild.value = null
  } catch (exception) {
    error.value = exception instanceof Error ? exception.message : 'Suppression impossible.'
  }
}

function categoryLabel(slug: string) {
  return CATEGORY_DEFINITIONS.find(([, itemSlug]) => itemSlug === slug)?.[0] ?? slug
}
</script>

<template>
  <main class="profile-page">
    <SocialHeader />

    <section class="profile-content" aria-labelledby="profile-title">
      <header class="profile-heading">
        <p class="eyebrow">Dossier shinobi</p>
        <h1 id="profile-title">Profil</h1>
        <p>Ton parcours et tes statistiques de combat ninja.</p>
      </header>

      <div v-if="auth.user" class="profile-layout">
        <!-- 1. En haut : Avatar & Identité -->
        <article class="profile-card profile-identity">
          <div class="identity-wrapper">
            <div class="profile-avatar">
              <span class="avatar-letter">{{ auth.user.displayName.slice(0, 1).toUpperCase() }}</span>
            </div>
            <div class="identity-info">
              <p class="eyebrow">Guerrier Shinobi</p>
              <h2>{{ auth.user.displayName }}</h2>
              <p class="profile-email">{{ auth.user.email }}</p>

              <div class="identity-actions">
                <button
                  v-if="!editing"
                  class="profile-action"
                  type="button"
                  @click="editing = true"
                >
                  Modifier le profil
                </button>
                <button
                  class="profile-logout-btn"
                  type="button"
                  @click="handleLogout"
                >
                  <span>⏻</span> Déconnexion
                </button>
              </div>

              <div v-if="editing" class="edit-profile">
                <input
                  v-model.trim="displayName"
                  aria-label="Nom du profil"
                  placeholder="Nouveau pseudonyme"
                />
                <div class="edit-buttons">
                  <button class="profile-action" type="button" @click="saveName">Enregistrer</button>
                  <button class="profile-cancel" type="button" @click="editing = false">Annuler</button>
                </div>
              </div>
            </div>
          </div>
        </article>

        <!-- 2. Statistiques du joueur -->
        <article class="profile-card profile-statistics">
          <div class="card-header-row">
            <div>
              <p class="eyebrow">Performances</p>
              <h2>Statistiques</h2>
            </div>
            <span class="stat-summary-badge">{{ total }} COMBATS</span>
          </div>
          <div class="stat-grid">
            <div class="stat-box wins">
              <strong>{{ auth.user.wins }}</strong>
              <span>Victoires</span>
            </div>
            <div class="stat-box losses">
              <strong>{{ auth.user.losses }}</strong>
              <span>Défaites</span>
            </div>
            <div class="stat-box total">
              <strong>{{ total }}</strong>
              <span>Parties jouées</span>
            </div>
            <div class="stat-box rate">
              <strong>{{ winRate }}%</strong>
              <span>Taux de victoire</span>
            </div>
          </div>
        </article>

        <!-- 3. Section Amis -->
        <article class="profile-card social-card">
          <div class="social-card-heading">
            <div>
              <p class="eyebrow">Réseau social</p>
              <h2>Amis ({{ friends.length }})</h2>
            </div>
            <button
              class="profile-toggle-btn"
              type="button"
              @click="friendsOpen = !friendsOpen"
            >
              {{ friendsOpen ? 'Masquer' : 'Afficher' }}
            </button>
          </div>

          <div v-if="friendsOpen" class="friends-list">
            <div v-for="friend in friends" :key="friend.id" class="friend-row">
              <span class="profile-friend-avatar">{{ friend.displayName.slice(0, 1).toUpperCase() }}</span>
              <div class="friend-info">
                <strong>{{ friend.displayName }}</strong>
              </div>
              <a class="profile-action-link" :href="`/profil-public/${friend.id}`">Voir profil</a>
            </div>
            <p v-if="!friends.length" class="profile-empty">Aucun ami pour le moment. Recherche un joueur dans la barre du haut pour l'ajouter.</p>
          </div>
        </article>

        <!-- 4. Persos & Compositions sauvegardées -->
        <article class="profile-card saved-builds">
          <div class="card-header-row">
            <div>
              <p class="eyebrow">Arsenal</p>
              <h2>Compositions ({{ builds.length }})</h2>
            </div>
          </div>
          <p v-if="!builds.length" class="profile-empty">
            Aucune composition sauvegardée. Termine un combat avec tes 15 cartes pour enregistrer ton build.
          </p>
          <div v-for="build in builds" :key="build.id" class="saved-build">
            <div class="build-summary">
              <strong>{{ build.name }}</strong>
              <small>{{ new Date(build.createdAt).toLocaleDateString('fr-FR') }} · {{ build.slots.length }} cartes</small>
              <div class="build-preview">
                <img
                  v-for="slot in build.slots.slice(0, 5)"
                  :key="slot.id"
                  :src="slot.card.imageUrl ?? '/logo.png'"
                  :alt="slot.card.name"
                  loading="lazy"
                />
              </div>
            </div>
            <div class="saved-actions">
              <button class="profile-action" type="button" @click="selectedBuild = build">Voir</button>
              <button class="profile-cancel delete" type="button" @click="removeBuild(build)">Supprimer</button>
            </div>
          </div>
        </article>
      </div>

      <p v-if="error" class="profile-error">{{ error }}</p>

      <!-- Détail de la composition sélectionnée -->
      <article v-if="selectedBuild" class="profile-card build-detail">
        <div class="detail-heading">
          <div>
            <p class="eyebrow">Détail du build</p>
            <h2>{{ selectedBuild.name }}</h2>
          </div>
          <button class="profile-cancel" type="button" @click="selectedBuild = null">Fermer</button>
        </div>
        <div class="detail-grid">
          <div
            v-for="[label, slug] in CATEGORY_DEFINITIONS"
            :key="slug"
            class="detail-slot"
          >
            <span class="detail-category-label">{{ label }}</span>
            <img
              v-if="selectedBuild.slots.find((slot) => slot.categorySlug === slug)?.card.imageUrl"
              :src="selectedBuild.slots.find((slot) => slot.categorySlug === slug)?.card.imageUrl ?? undefined"
              :alt="selectedBuild.slots.find((slot) => slot.categorySlug === slug)?.card.name"
            />
            <div v-else class="detail-fallback-art">?</div>
            <strong>
              {{ selectedBuild.slots.find((slot) => slot.categorySlug === slug)?.card.name ?? 'Libre' }}
            </strong>
          </div>
        </div>
      </article>
    </section>
  </main>
</template>

<style scoped>
.profile-page {
  min-height: 100vh;
  background: var(--bg-main);
  overflow-x: hidden;
}

.profile-content {
  max-width: 1180px;
  margin: 0 auto;
  padding: 40px max(16px, calc((100vw - 1180px) / 2)) 80px;
  box-sizing: border-box;
}

.profile-heading {
  text-align: center;
  margin-bottom: 32px;
}

.profile-heading h1 {
  margin: 10px 0 8px;
  font-size: clamp(2.4rem, 6vw, 4.5rem);
  line-height: 0.95;
  text-transform: uppercase;
  letter-spacing: -0.04em;
}

.profile-heading > p:last-child {
  color: var(--text-muted);
  font-size: 0.72rem;
  line-height: 1.6;
}

.profile-layout {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.profile-card {
  padding: 24px;
  border: 1px solid var(--border-light);
  background: var(--bg-panel);
  clip-path: var(--clip-soft);
  box-sizing: border-box;
}

.card-header-row,
.social-card-heading,
.detail-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 18px;
}

.card-header-row h2,
.social-card-heading h2,
.detail-heading h2 {
  margin: 6px 0 0;
  font-size: clamp(1.3rem, 3vw, 1.8rem);
  text-transform: uppercase;
  letter-spacing: -0.03em;
}

/* Identité */
.identity-wrapper {
  display: flex;
  align-items: center;
  gap: 24px;
  flex-wrap: wrap;
}

.profile-avatar {
  display: grid;
  place-items: center;
  width: 96px;
  height: 96px;
  background: linear-gradient(135deg, var(--accent-orange), var(--accent-red));
  border: 2px solid var(--border-strong);
  clip-path: var(--clip-strong);
  flex-shrink: 0;
  box-shadow: 0 8px 24px rgba(246, 128, 72, 0.3);
}

.avatar-letter {
  font-family: 'Syne', sans-serif;
  font-size: 2.8rem;
  font-weight: 800;
  color: #1a150e;
}

.identity-info {
  flex: 1;
  min-width: 220px;
}

.identity-info h2 {
  margin: 4px 0;
  font-size: clamp(1.5rem, 3.5vw, 2.2rem);
  text-transform: uppercase;
}

.profile-email {
  color: var(--text-muted);
  font-size: 0.68rem;
  margin: 0 0 16px;
}

.identity-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.profile-action,
.profile-cancel,
.profile-logout-btn,
.profile-action-link,
.profile-toggle-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 42px;
  padding: 0.65rem 1.1rem;
  border: 1px solid var(--border-strong);
  background: var(--accent-orange);
  color: #242629;
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  clip-path: var(--clip-soft);
  cursor: pointer;
  touch-action: manipulation;
  transition: all 0.2s ease;
  text-decoration: none;
}

.profile-action:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 14px rgba(246, 128, 72, 0.4);
}

.profile-cancel {
  border-color: var(--border-light);
  background: var(--bg-panel-strong);
  color: var(--text-main);
}

.profile-cancel:hover {
  background: rgba(255, 255, 255, 0.1);
}

.profile-cancel.delete:hover {
  border-color: var(--accent-red);
  color: var(--accent-red);
}

.profile-toggle-btn {
  background: rgba(255, 255, 255, 0.08);
  border-color: var(--border-light);
  color: var(--text-soft);
  min-height: 36px;
  padding: 0.5rem 0.85rem;
  font-size: 0.58rem;
}

.profile-action-link {
  background: rgba(245, 166, 35, 0.15);
  border-color: rgba(245, 166, 35, 0.4);
  color: var(--accent-gold);
  min-height: 36px;
  padding: 0.5rem 0.85rem;
  font-size: 0.58rem;
}

.profile-action-link:hover {
  background: var(--accent-orange);
  color: #1a150e;
}

/* Bouton Déconnexion */
.profile-logout-btn {
  border-color: rgba(255, 91, 91, 0.5);
  background: rgba(255, 91, 91, 0.15);
  color: var(--accent-red);
}

.profile-logout-btn:hover {
  background: rgba(255, 91, 91, 0.3);
  border-color: var(--accent-red);
  transform: translateY(-1px);
}

.edit-profile {
  display: grid;
  gap: 10px;
  margin-top: 16px;
}

.edit-profile input {
  padding: 12px 14px;
  border: 1px solid var(--border-light);
  background: var(--bg-panel-strong);
  color: var(--text-main);
  font-size: 0.75rem;
  clip-path: var(--clip-soft);
  outline: none;
}

.edit-profile input:focus {
  border-color: var(--accent-orange);
}

.edit-buttons {
  display: flex;
  gap: 10px;
}

/* Statistiques */
.stat-summary-badge {
  color: var(--accent-gold);
  font-size: 0.6rem;
  letter-spacing: 0.12em;
  font-weight: 700;
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.stat-box {
  padding: 16px 14px;
  background: var(--bg-panel-strong);
  border: 1px solid var(--border-light);
  border-left: 3px solid var(--accent-orange);
}

.stat-box.wins {
  border-left-color: var(--accent-green);
}

.stat-box.losses {
  border-left-color: var(--accent-red);
}

.stat-box.total {
  border-left-color: var(--accent-blue);
}

.stat-box.rate {
  border-left-color: var(--accent-gold);
}

.stat-box strong {
  display: block;
  font-family: 'Syne', sans-serif;
  font-size: clamp(1.6rem, 3vw, 2.2rem);
  color: var(--text-main);
  line-height: 1;
}

.stat-box.wins strong {
  color: var(--accent-green);
}

.stat-box.losses strong {
  color: var(--accent-red);
}

.stat-box.rate strong {
  color: var(--accent-gold);
}

.stat-box span {
  display: block;
  margin-top: 8px;
  color: var(--text-muted);
  font-size: 0.58rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

/* Amis */
.friends-list {
  display: grid;
  gap: 8px;
}

.friend-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
  border: 1px solid var(--border-light);
  background: var(--bg-panel-strong);
}

.profile-friend-avatar {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  background: var(--accent-orange);
  color: #2b2113;
  font-weight: 700;
  font-size: 0.85rem;
  flex-shrink: 0;
}

.friend-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.friend-info strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.75rem;
}

.friend-info small {
  color: var(--text-muted);
  font-size: 0.58rem;
}

/* Compositions sauvegardées */
.saved-build {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 0;
  border-top: 1px solid var(--border-light);
  flex-wrap: wrap;
}

.build-summary strong {
  display: block;
  font-size: 0.85rem;
}

.build-summary small {
  display: block;
  margin: 4px 0 8px;
  color: var(--text-muted);
  font-size: 0.6rem;
}

.build-preview {
  display: flex;
  gap: 6px;
}

.build-preview img {
  width: 36px;
  height: 50px;
  object-fit: cover;
  border: 1px solid var(--border-light);
}

.saved-actions {
  display: flex;
  gap: 8px;
}

.profile-empty {
  color: var(--text-muted);
  font-size: 0.7rem;
  line-height: 1.6;
  margin: 0;
}

.profile-error {
  margin-top: 18px;
  color: var(--accent-red);
  font-size: 0.72rem;
}

/* Détail d'un build */
.build-detail {
  margin-top: 24px;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
  margin-top: 16px;
}

.detail-slot {
  min-width: 0;
  padding: 10px 8px;
  background: var(--bg-panel-strong);
  border: 1px solid var(--border-light);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.detail-category-label {
  display: block;
  color: var(--accent-gold);
  font-size: 0.52rem;
  text-transform: uppercase;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  letter-spacing: 0.08em;
}

.detail-slot img {
  width: 100%;
  height: 110px;
  margin: 6px 0;
  object-fit: cover;
  border: 1px solid var(--border-light);
}

.detail-fallback-art {
  display: grid;
  place-items: center;
  height: 110px;
  margin: 6px 0;
  background: rgba(0, 0, 0, 0.3);
  color: var(--text-muted);
  font-size: 1.5rem;
}

.detail-slot strong {
  display: block;
  color: var(--text-main);
  font-size: 0.6rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Tablet & Mobile Responsive */
@media (max-width: 900px) {
  .stat-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .detail-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 600px) {
  .profile-content {
    padding-top: 24px;
    padding-bottom: 60px;
  }

  .profile-card {
    padding: 18px 16px;
  }

  .identity-wrapper {
    flex-direction: column;
    text-align: center;
    gap: 16px;
  }

  .identity-actions {
    justify-content: center;
  }

  .identity-actions .profile-action,
  .identity-actions .profile-logout-btn {
    width: 100%;
  }

  .detail-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .saved-build {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .saved-actions {
    width: 100%;
  }

  .saved-actions button {
    flex: 1;
  }
}
</style>
