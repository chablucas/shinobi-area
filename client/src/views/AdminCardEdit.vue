<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import SocialHeader from '../components/SocialHeader.vue'
import { useAuthStore } from '../stores/auth'
import {
  createCardModifier,
  deleteCardModifier,
  fetchAdminCard,
  resetRarityOverride,
  resetStatOverride,
  saveRarityOverride,
  saveStatOverride,
  updateCardModifier,
} from '../services/cardAdminApi'
import type { Card, CardModifier } from '../types/card'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const card = ref<Card | null>(null)
const selectedRarity = ref('')
const editValues = ref<Record<string, number>>({})
const status = ref('')
const loading = ref(true)
const modifierForm = ref({
  name: '',
  description: '',
  target: 'chakra',
  categories: [] as string[],
  direction: 'BONUS' as CardModifier['direction'],
  operation: 'PERCENT' as CardModifier['operation'],
  value: 10,
  condition: '',
  conditionType: 'always',
  conditionValue: '',
  active: true,
})
const editingModifierId = ref<number | null>(null)

const statKeys = [
  'chakra', 'invocation', 'iq', 'ninjutsuAttack', 'ninjutsuDefense', 'genjutsu', 'taijutsu', 'avatar', 'body', 'fuinjutsu', 'senjutsu', 'kenjutsu', 'speed', 'kekkeiGenkai',
] as const
const modifierTargets = [...statKeys, 'kekkeiMora'] as const
const modifierCategories = [
  'Chakra', 'Invocation', 'IQ', 'Ninjutsu Attaque', 'Ninjutsu Défense', 'Genjutsu', 'Taijutsu', 'Avatar', 'Body', 'Fuinjutsu', 'Senjutsu', 'Kenjutsu', 'Vitesse', 'Kekkei Genkai', 'Sensoriel',
]

function fillModifierForm(modifier: CardModifier | null) {
  const next = modifier ?? {
    id: 0,
    name: '',
    description: '',
    target: 'chakra',
    categories: [],
    direction: 'BONUS',
    operation: 'PERCENT',
    value: 10,
    condition: '',
    conditionType: 'always',
    conditionValue: '',
    active: true,
  }

  modifierForm.value = {
    name: next.name,
    description: next.description,
    target: next.target,
    categories: next.categories ?? [],
    direction: next.direction,
    operation: next.operation,
    value: next.value,
    condition: next.condition ?? '',
    conditionType: next.conditionType ?? 'always',
    conditionValue: next.conditionValue ?? '',
    active: next.active,
  }
}

function resetModifierForm() {
  editingModifierId.value = null
  fillModifierForm(null)
}

onMounted(async () => {
  if (!auth.token || auth.user?.role !== 'ADMIN') {
    await router.replace('/personnages')
    return
  }

  const slug = String(route.params.slug ?? '')
  try {
    const nextCard = await fetchAdminCard(auth.token, decodeURIComponent(slug))
    card.value = nextCard
    selectedRarity.value = nextCard.effectiveRarity
    editValues.value = Object.fromEntries(statKeys.map((key) => [key, nextCard.effectiveStats[key] ?? 0]))
    fillModifierForm(null)
  } catch (exception) {
    status.value = exception instanceof Error ? exception.message : 'Carte introuvable.'
  } finally {
    loading.value = false
  }
})

async function saveStat(key: keyof Card['effectiveStats']) {
  if (!auth.token || !card.value) return
  await saveStatOverride(auth.token, card.value.slug, key, editValues.value[key] ?? 0)
  card.value = await fetchAdminCard(auth.token, card.value.slug)
  editValues.value = Object.fromEntries(statKeys.map((statKey) => [statKey, card.value?.effectiveStats[statKey] ?? 0]))
  status.value = 'Statistique enregistrée.'
}

async function saveRarity() {
  if (!auth.token || !card.value) return
  await saveRarityOverride(auth.token, card.value.slug, selectedRarity.value)
  card.value = await fetchAdminCard(auth.token, card.value.slug)
  status.value = 'Rareté enregistrée.'
}

async function resetStat(key: keyof Card['effectiveStats']) {
  if (!auth.token || !card.value) return
  await resetStatOverride(auth.token, card.value.slug, key)
  card.value = await fetchAdminCard(auth.token, card.value.slug)
  editValues.value = Object.fromEntries(statKeys.map((statKey) => [statKey, card.value?.effectiveStats[statKey] ?? 0]))
  status.value = 'Statistique réinitialisée.'
}

async function resetCurrentRarity() {
  if (!auth.token || !card.value) return
  await resetRarityOverride(auth.token, card.value.slug)
  card.value = await fetchAdminCard(auth.token, card.value.slug)
  selectedRarity.value = card.value.effectiveRarity
  status.value = 'Rareté réinitialisée.'
}

async function submitModifier() {
  if (!auth.token || !card.value) return
  const payload = {
    ...modifierForm.value,
    name: modifierForm.value.name.trim(),
    description: modifierForm.value.description.trim(),
    categories: modifierForm.value.categories,
    condition: modifierForm.value.condition.trim() || null,
    conditionType: modifierForm.value.conditionType || 'always',
    conditionValue: modifierForm.value.conditionValue.trim() || null,
  }

  if (!payload.name || !payload.description) {
    status.value = 'Le nom et la description sont requis.'
    return
  }

  try {
    if (editingModifierId.value) {
      await updateCardModifier(auth.token, editingModifierId.value, payload)
      status.value = 'Effet modifié.'
    } else {
      await createCardModifier(auth.token, card.value.slug, payload)
      status.value = 'Effet ajouté.'
    }
    card.value = await fetchAdminCard(auth.token, card.value.slug)
    resetModifierForm()
  } catch (exception) {
    status.value = exception instanceof Error ? exception.message : 'Action impossible.'
  }
}

async function deleteModifier(modifier: CardModifier) {
  if (!auth.token || !card.value) return
  try {
    await deleteCardModifier(auth.token, modifier.id)
    card.value = await fetchAdminCard(auth.token, card.value.slug)
    status.value = 'Effet supprimé.'
  } catch (exception) {
    status.value = exception instanceof Error ? exception.message : 'Suppression impossible.'
  }
}

function editModifier(modifier: CardModifier) {
  editingModifierId.value = modifier.id
  fillModifierForm(modifier)
}
</script>

<template>
  <main class="admin-card-page">
    <SocialHeader />
    <section class="page-shell">
      <nav class="breadcrumb"><button type="button" @click="router.push('/admin')">← Retour dashboard</button></nav>
      <div v-if="loading" class="state-message">Chargement de la carte...</div>
      <div v-else-if="!card" class="state-message error">{{ status || 'Carte introuvable.' }}</div>
      <template v-else>
        <header class="card-header">
          <div class="card-identity">
            <h1>{{ card.name }}</h1>
            <p>Slug : {{ card.slug }}</p>
            <p>Rareté : {{ card.effectiveRarity }}</p>
          </div>
          <img v-if="card.imageUrl" :src="card.imageUrl" :alt="card.name" class="card-image" />
        </header>

        <div v-if="status" class="status-banner">{{ status }}</div>

        <section class="panel">
          <h2>Statistiques</h2>
          <div class="stats-grid">
            <div v-for="statKey in statKeys" :key="statKey" class="stat-row">
              <label>{{ statKey }}</label>
              <input v-model.number="editValues[statKey]" type="number" min="0" max="100" />
              <button type="button" @click="saveStat(statKey)">Enregistrer</button>
              <button type="button" class="secondary" @click="resetStat(statKey)">Reset</button>
            </div>
          </div>
        </section>

        <section class="panel">
          <h2>Rareté</h2>
          <div class="rarity-actions">
            <select v-model="selectedRarity" class="auth-input">
              <option value="common">Common</option>
              <option value="uncommon">Uncommon</option>
              <option value="rare">Rare</option>
              <option value="epic">Epic</option>
              <option value="legendary">Legendary</option>
              <option value="mythic">Mythic</option>
            </select>
            <button type="button" @click="saveRarity">Enregistrer</button>
            <button type="button" class="secondary" @click="resetCurrentRarity">Réinitialiser</button>
          </div>
        </section>

        <section class="panel">
          <h2>Effets / Power-ups / Malus</h2>
          <div class="modifier-list">
            <div v-for="modifier in card.modifiers" :key="modifier.id" class="modifier-item">
              <div class="modifier-summary">
                <strong>{{ modifier.name }}</strong>
                <span>{{ modifier.direction }} · {{ modifier.operation }} · {{ modifier.value }}</span>
                <small>{{ modifier.description }}</small>
                <small>Catégories : {{ modifier.categories.length ? modifier.categories.join(', ') : '—' }}</small>
                <small>Condition : {{ modifier.conditionType ?? 'always' }} / {{ modifier.conditionValue || '—' }}</small>
              </div>
              <div class="modifier-actions">
                <button type="button" @click="editModifier(modifier)">Modifier</button>
                <button type="button" class="secondary" @click="deleteModifier(modifier)">Supprimer</button>
              </div>
            </div>
            <p v-if="!card.modifiers.length" class="empty-state">Aucun effet pour cette carte.</p>
          </div>

          <div class="modifier-form">
            <div class="field-grid">
              <label>
                Nom
                <input v-model="modifierForm.name" class="auth-input" type="text" />
              </label>
              <label>
                Description
                <input v-model="modifierForm.description" class="auth-input" type="text" />
              </label>
            </div>

            <div class="field-grid">
              <label>
                Type
                <select v-model="modifierForm.direction" class="auth-input">
                  <option value="BONUS">BONUS</option>
                  <option value="MALUS">MALUS</option>
                </select>
              </label>
              <label>
                Mode
                <select v-model="modifierForm.operation" class="auth-input">
                  <option value="POINTS">POINTS</option>
                  <option value="PERCENT">PERCENTAGE</option>
                </select>
              </label>
              <label>
                Valeur
                <input v-model.number="modifierForm.value" class="auth-input" type="number" />
              </label>
            </div>

            <div class="field-grid">
              <label>
                Cible
                <select v-model="modifierForm.target" class="auth-input">
                  <option v-for="target in modifierTargets" :key="target" :value="target">{{ target }}</option>
                </select>
              </label>
              <label>
                Condition type
                <select v-model="modifierForm.conditionType" class="auth-input">
                  <option value="always">toujours actif</option>
                  <option value="equals">égal à</option>
                  <option value="has">possède</option>
                  <option value="clan">clan</option>
                  <option value="card">carte</option>
                </select>
              </label>
              <label>
                Condition valeur
                <input v-model="modifierForm.conditionValue" class="auth-input" type="text" placeholder="Ex: IQ = 100" />
              </label>
            </div>

            <div class="field-grid categories-grid">
              <label class="categories-label">Catégories impactées</label>
              <div class="categories-picker">
                <label v-for="category in modifierCategories" :key="category" class="checkbox-item">
                  <input v-model="modifierForm.categories" type="checkbox" :value="category" />
                  <span>{{ category }}</span>
                </label>
              </div>
            </div>

            <div class="field-grid single-row-actions">
              <button type="button" @click="submitModifier">{{ editingModifierId !== null ? 'Modifier l’effet' : 'Ajouter' }}</button>
              <button type="button" class="secondary" @click="resetModifierForm">Réinitialiser</button>
            </div>
          </div>
        </section>
      </template>
    </section>
  </main>
</template>

<style scoped>
.admin-card-page {
  min-height: 100vh;
  background: var(--bg-main);
  color: var(--text-main);
}
.page-shell {
  max-width: 1100px;
  margin: 0 auto;
  padding: 36px 20px 90px;
}
.breadcrumb {
  margin-bottom: 20px;
}
button {
  border: 1px solid var(--border-strong);
  background: var(--accent-orange);
  color: #241b12;
  font-weight: 700;
  min-height: 38px;
  padding: 0 12px;
}
button.secondary {
  background: transparent;
  color: var(--text-main);
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
  margin-bottom: 20px;
  padding: 20px;
  background: var(--bg-panel);
  border: 1px solid var(--border-strong);
}
.card-header h1 {
  margin: 0 0 8px;
  color: var(--accent-orange);
}
.card-identity p {
  margin: 4px 0;
  color: var(--text-muted);
}
.card-image {
  width: 150px;
  height: auto;
  border: 1px solid var(--border-strong);
}
.panel {
  margin-top: 20px;
  background: var(--bg-panel);
  border: 1px solid var(--border-strong);
  padding: 20px;
}
.panel h2 {
  margin-top: 0;
  color: var(--accent-gold);
}
.stats-grid,
.modifier-list,
.modifier-form {
  display: grid;
  gap: 12px;
}
.stat-row {
  display: grid;
  grid-template-columns: minmax(130px, 180px) minmax(120px, 160px) auto auto;
  gap: 10px;
  align-items: center;
}
.stat-row label,
label {
  color: var(--text-soft);
  text-transform: capitalize;
}
input,
select {
  min-height: 40px;
  background: var(--bg-panel-strong);
  color: var(--text-main);
  border: 1px solid var(--border-light);
}
.status-banner {
  margin-top: 12px;
  padding: 12px 14px;
  background: rgba(145, 208, 95, 0.12);
  border: 1px solid rgba(145, 208, 95, 0.5);
  color: #d9f6be;
}
.rarity-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.modifier-item {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  padding: 12px;
  border: 1px solid var(--border-light);
  background: rgba(255, 255, 255, 0.02);
}
.modifier-summary {
  display: grid;
  gap: 4px;
  min-width: 0;
}
.modifier-summary strong {
  color: var(--text-main);
}
.modifier-summary span,
.modifier-summary small {
  color: var(--text-muted);
}
.modifier-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.field-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}
.field-grid label {
  display: grid;
  gap: 6px;
}
.categories-grid {
  align-items: start;
}
.categories-picker {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 8px;
  padding: 10px;
  border: 1px solid var(--border-light);
  background: var(--bg-panel-strong);
}
.checkbox-item {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-main);
}
.single-row-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.empty-state {
  color: var(--text-muted);
}
.state-message {
  color: var(--accent-gold);
}
.state-message.error {
  color: #ffb7b7;
}
@media (max-width: 700px) {
  .card-header {
    flex-direction: column;
    align-items: flex-start;
  }
  .stat-row,
  .modifier-item {
    grid-template-columns: 1fr;
    display: grid;
  }
}
</style>
