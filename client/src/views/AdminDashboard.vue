<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import SocialHeader from '../components/SocialHeader.vue'
import { useAuthStore } from '../stores/auth'
import { fetchAdminCards, fetchAdminOverview, type AdminCardSummary } from '../services/adminApi'

const auth = useAuthStore()
const router = useRouter()
const overview = ref<{ totalCards: number; totalUsers: number; rarityBreakdown: Array<{ rarity: string; count: number }> } | null>(null)
const cards = ref<AdminCardSummary[]>([])
const query = ref('')
const rarity = ref('')
const loading = ref(true)
const error = ref('')

const uniqueRarities = computed(() => [...new Set(cards.value.map((card) => card.rarity))].sort())

onMounted(async () => {
  await auth.loadCurrentUser()
  if (!auth.token || auth.user?.role !== 'ADMIN') {
    await router.replace('/personnages')
    return
  }

  try {
    const [nextOverview, nextCards] = await Promise.all([
      fetchAdminOverview(auth.token),
      fetchAdminCards(auth.token, query.value, rarity.value),
    ])
    overview.value = nextOverview
    cards.value = nextCards
  } catch (exception) {
    error.value = exception instanceof Error ? exception.message : 'Impossible de charger le tableau de bord.'
  } finally {
    loading.value = false
  }
})

async function refreshCards() {
  if (!auth.token) return
  try {
    cards.value = await fetchAdminCards(auth.token, query.value, rarity.value)
  } catch (exception) {
    error.value = exception instanceof Error ? exception.message : 'Recherche administrateur impossible.'
  }
}

function openCard(card: AdminCardSummary) {
  void router.push(`/admin/cards/${encodeURIComponent(card.slug)}`)
}
</script>

<template>
  <main class="admin-page">
    <SocialHeader />
    <section class="admin-shell">
      <header class="admin-header">
        <div>
          <p class="eyebrow">Administration</p>
          <h1>Dashboard</h1>
        </div>
      </header>

      <div v-if="loading" class="state-message">Chargement du dashboard...</div>
      <div v-else-if="error" class="state-message error">{{ error }}</div>
      <template v-else>
        <section class="stats-grid">
          <article class="stat-card">
            <span>Total cartes</span>
            <strong>{{ overview?.totalCards ?? 0 }}</strong>
          </article>
          <article class="stat-card">
            <span>Total utilisateurs</span>
            <strong>{{ overview?.totalUsers ?? 0 }}</strong>
          </article>
          <article class="stat-card wide">
            <span>Cartes par rareté</span>
            <ul>
              <li v-for="item in overview?.rarityBreakdown ?? []" :key="item.rarity">
                <span>{{ item.rarity }}</span><strong>{{ item.count }}</strong>
              </li>
            </ul>
          </article>
        </section>

        <section class="panel admin-tools">
          <div class="dashboard-actions">
            <button type="button" @click="router.push('/admin')">Gestion des cartes</button>
            <button type="button" @click="router.push('/simulation')">Simulation</button>
          </div>
          <h2>Gestion des cartes</h2>
          <div class="toolbar">
            <input v-model="query" class="auth-input" type="search" placeholder="Rechercher par nom" @input="refreshCards" />
            <select v-model="rarity" class="auth-input" @change="refreshCards">
              <option value="">Toutes les raretés</option>
              <option v-for="entry in uniqueRarities" :key="entry" :value="entry">{{ entry }}</option>
            </select>
          </div>

          <div class="card-list">
            <article v-for="card in cards" :key="card.slug" class="admin-card-row">
              <div class="mini-card">
                <img v-if="card.imageUrl" :src="card.imageUrl" :alt="card.name" />
                <span v-else>{{ card.name.slice(0, 1) }}</span>
              </div>
              <div class="meta">
                <strong>{{ card.name }}</strong>
                <small>{{ card.rarity }}</small>
              </div>
              <button type="button" @click="openCard(card)">MODIFIER</button>
            </article>
          </div>
        </section>
      </template>
    </section>
  </main>
</template>

<style scoped>
.admin-page {
  min-height: 100vh;
  background: var(--bg-main);
  color: var(--text-main);
}
.admin-shell {
  max-width: 1200px;
  margin: 0 auto;
  padding: 48px 20px 90px;
}
.admin-header {
  margin-bottom: 28px;
}
.admin-header h1 {
  margin: 8px 0 0;
  font-size: clamp(2.2rem, 5vw, 4rem);
  color: var(--accent-orange);
}
.eyebrow {
  margin: 0;
  color: var(--accent-gold);
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 0.7rem;
}
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}
.stat-card {
  display: grid;
  gap: 8px;
  padding: 20px;
  background: var(--bg-panel);
  border: 1px solid var(--border-strong);
}
.stat-card span {
  color: var(--text-muted);
  text-transform: uppercase;
  font-size: 0.7rem;
  letter-spacing: 0.08em;
}
.stat-card strong {
  font-size: clamp(2rem, 4vw, 3rem);
  color: var(--accent-gold);
}
.stat-card.wide ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 8px;
}
.stat-card.wide li {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  color: var(--text-main);
}
.panel {
  background: var(--bg-panel);
  border: 1px solid var(--border-strong);
  padding: 18px;
}
.admin-tools h2 {
  margin-top: 0;
  color: var(--accent-orange);
}
.toolbar {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}
.auth-input {
  min-height: 42px;
  width: 100%;
}
.card-list {
  display: grid;
  gap: 12px;
}
.admin-card-row {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr) auto;
  align-items: center;
  gap: 14px;
  padding: 10px 12px;
  border: 1px solid var(--border-light);
  background: rgba(255, 255, 255, 0.02);
}
.mini-card {
  width: 64px;
  height: 64px;
  border-radius: 8px;
  overflow: hidden;
  background: var(--bg-panel-strong);
  display: grid;
  place-items: center;
  color: var(--accent-orange);
  font-weight: 700;
}
.mini-card img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.meta {
  display: grid;
  min-width: 0;
}
.meta strong {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.meta small {
  color: var(--text-muted);
}
button {
  border: 1px solid var(--border-strong);
  background: var(--accent-orange);
  color: #241b12;
  font-weight: 700;
  min-height: 38px;
  padding: 0 16px;
}
.state-message {
  color: var(--accent-gold);
}
.state-message.error {
  color: #ffb7b7;
}
@media (max-width: 700px) {
  .toolbar {
    grid-template-columns: 1fr;
  }
  .admin-card-row {
    grid-template-columns: 54px minmax(0, 1fr);
  }
  .admin-card-row button {
    grid-column: 1 / -1;
  }
}
</style>
