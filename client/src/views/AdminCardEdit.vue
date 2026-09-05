<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
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
const advancedRulesOpen = ref(false)
const selectedPowerId = ref('')
const selectedTraitId = ref('')
const selectedTransformationId = ref('')
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
  'chakra', 'invocation', 'iq', 'ninjutsuAttack', 'ninjutsuDefense', 'genjutsu', 'taijutsu', 'avatar', 'body', 'fuinjutsu', 'senjutsu', 'kenjutsu', 'speed', 'kekkeiGenkai', 'kekkeiMora',
] as const
const modifierTargets = [...statKeys, 'kekkeiMora'] as const
const statLabels: Record<string, string> = {
  chakra: 'Chakra',
  invocation: 'Invocation',
  iq: 'IQ',
  ninjutsuAttack: 'Ninjutsu Attaque',
  ninjutsuDefense: 'Ninjutsu Défense',
  genjutsu: 'Genjutsu',
  taijutsu: 'Taijutsu',
  avatar: 'Avatar',
  body: 'Body',
  fuinjutsu: 'Fūinjutsu',
  senjutsu: 'Senjutsu',
  kenjutsu: 'Kenjutsu',
  speed: 'Vitesse',
  kekkeiGenkai: 'Kekkei Genkai',
  kekkeiMora: 'Kekkei Mōra',
}
const modifierCategories = [
  'Chakra', 'Invocation', 'IQ', 'Ninjutsu Attaque', 'Ninjutsu Défense', 'Genjutsu', 'Taijutsu', 'Avatar', 'Body', 'Fuinjutsu', 'Senjutsu', 'Kenjutsu', 'Vitesse', 'Kekkei Genkai', 'Sensoriel',
]

const powerCatalog = computed(() => card.value?.catalog?.powerCatalog ?? {})
const physicalTraitCatalog = computed(() => card.value?.catalog?.physicalTraitCatalog ?? {})
const transformationCatalog = computed(() => card.value?.catalog?.transformationCatalog ?? {})
const clanCatalog = computed(() => card.value?.catalog?.clanCatalog ?? [])
const cardCatalog = computed(() => card.value?.catalog?.cardCatalog ?? [])

const relationIssues = computed(() => {
  if (!card.value) return []
  const issues: string[] = []
  const seen = new Set<string>()

  for (const powerId of card.value.powerIds ?? []) {
    if (!(powerId in powerCatalog.value)) issues.push(`powerId inconnu : ${powerId}`)
    seen.add(powerId)
  }
  for (const traitId of card.value.physicalTraitIds ?? []) {
    if (!(traitId in physicalTraitCatalog.value)) issues.push(`physicalTraitId inconnu : ${traitId}`)
    seen.add(traitId)
  }
  for (const transformationId of card.value.transformationIds ?? []) {
    if (!(transformationId in transformationCatalog.value)) issues.push(`transformationId inconnu : ${transformationId}`)
    seen.add(transformationId)
  }
  for (const avatar of card.value.avatars ?? []) {
    const known = (cardCatalog.value ?? []).some((entry) => entry.slug === card.value?.slug)
    if (!known && avatar.id) seen.add(avatar.id)
  }

  for (const clan of card.value.clans ?? []) {
    if (!clanCatalog.value.includes(clan)) issues.push(`clan inconnu : ${clan}`)
  }

  return issues
})

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

function getCatalogLabel(catalog: Record<string, { label: string }>, id: string) {
  return catalog[id]?.label ?? id
}

function addPower() {
  if (!card.value || !selectedPowerId.value) return
  if (!card.value.powerIds.includes(selectedPowerId.value)) {
    card.value.powerIds = [...card.value.powerIds, selectedPowerId.value]
  }
  selectedPowerId.value = ''
  status.value = 'Pouvoir ajouté à la carte.'
}

function removePower(powerId: string) {
  if (!card.value) return
  card.value.powerIds = card.value.powerIds.filter((id) => id !== powerId)
  status.value = 'Pouvoir supprimé de la carte.'
}

function addTrait() {
  if (!card.value || !selectedTraitId.value) return
  if (!card.value.physicalTraitIds.includes(selectedTraitId.value)) {
    card.value.physicalTraitIds = [...card.value.physicalTraitIds, selectedTraitId.value]
  }
  selectedTraitId.value = ''
  status.value = 'Trait physique ajouté.'
}

function removeTrait(traitId: string) {
  if (!card.value) return
  card.value.physicalTraitIds = card.value.physicalTraitIds.filter((id) => id !== traitId)
  status.value = 'Trait physique supprimé.'
}

function addTransformation() {
  if (!card.value || !selectedTransformationId.value) return
  if (!card.value.transformationIds.includes(selectedTransformationId.value)) {
    card.value.transformationIds = [...card.value.transformationIds, selectedTransformationId.value]
  }
  selectedTransformationId.value = ''
  status.value = 'Transformation ajoutée.'
}

function removeTransformation(transformationId: string) {
  if (!card.value) return
  card.value.transformationIds = card.value.transformationIds.filter((id) => id !== transformationId)
  status.value = 'Transformation supprimée.'
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

function validateRelations() {
  if (!card.value) return
  const issues = relationIssues.value
  if (issues.length > 0) {
    status.value = `Erreur relationnelle : ${issues.join(' ; ')}`
    return
  }
  status.value = 'Toutes les relations de la carte sont valides.'
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
            <div class="identity-grid">
              <label>
                <span>Image</span>
                <input :value="card.imageUrl ?? ''" type="text" readonly />
              </label>
              <label>
                <span>Nom</span>
                <input :value="card.name" type="text" readonly />
              </label>
              <label>
                <span>Slug principal</span>
                <input :value="card.slug" type="text" readonly />
              </label>
              <label>
                <span>Rareté</span>
                <select v-model="selectedRarity" class="auth-input">
                  <option value="common">Common</option>
                  <option value="uncommon">Uncommon</option>
                  <option value="rare">Rare</option>
                  <option value="epic">Epic</option>
                  <option value="legendary">Legendary</option>
                  <option value="mythic">Mythic</option>
                </select>
              </label>
            </div>
          </div>
          <img v-if="card.imageUrl" :src="card.imageUrl" :alt="card.name" class="card-image" />
        </header>

        <div v-if="status" class="status-banner">{{ status }}</div>

        <div class="admin-grid">
          <section class="panel panel-large">
            <h2>Identité / image</h2>
            <div class="identity-panel">
              <div class="thumb-wrap">
                <img v-if="card.imageUrl" :src="card.imageUrl" :alt="card.name" class="main-card-image" />
                <div v-else class="missing-image">Aucune image</div>
              </div>
              <div class="identity-fields">
                <div class="field-row">
                  <label>Nom</label>
                  <input :value="card.name" readonly type="text" />
                </div>
                <div class="field-row">
                  <label>Slug</label>
                  <input :value="card.slug" readonly type="text" />
                </div>
                <div class="field-row">
                  <label>Rareté</label>
                  <div class="inline-row">
                    <select v-model="selectedRarity">
                      <option value="common">Common</option>
                      <option value="uncommon">Uncommon</option>
                      <option value="rare">Rare</option>
                      <option value="epic">Epic</option>
                      <option value="legendary">Legendary</option>
                      <option value="mythic">Mythic</option>
                    </select>
                    <button type="button" @click="saveRarity">Enregistrer</button>
                    <button type="button" class="secondary" @click="resetCurrentRarity">Reset</button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section class="panel">
            <h2>Stats</h2>
            <div class="stats-grid">
              <div v-for="statKey in statKeys" :key="statKey" class="stat-row">
                <label>{{ statLabels[statKey] ?? statKey }}</label>
                <input v-model.number="editValues[statKey]" type="number" min="0" max="100" />
                <button type="button" @click="saveStat(statKey)">Save</button>
                <button type="button" class="secondary" @click="resetStat(statKey)">Reset</button>
              </div>
            </div>
          </section>

          <section class="panel">
            <h2>Clans</h2>
            <div class="badge-list">
              <span v-for="clan in card.clans ?? []" :key="clan" class="badge badge-clan">{{ clan }}</span>
              <span v-if="!(card.clans?.length)" class="empty-state">Aucun clan</span>
            </div>
            <div v-if="clanCatalog.length" class="catalog-select">
              <select disabled>
                <option>{{ clanCatalog.join(', ') }}</option>
              </select>
            </div>
          </section>

          <section class="panel">
            <h2>Pouvoirs</h2>
            <div class="badge-list" v-if="card.powerIds?.length">
              <span v-for="powerId in card.powerIds" :key="powerId" class="badge badge-power">
                {{ powerId }} — {{ getCatalogLabel(powerCatalog, powerId) }}
                <button type="button" class="mini-button" @click="removePower(powerId)">×</button>
              </span>
            </div>
            <div v-else class="empty-state">Aucun pouvoir lié</div>
            <div class="catalog-pick">
              <select v-model="selectedPowerId">
                <option value="">Choisir un powerId</option>
                <option v-for="(label, id) in powerCatalog" :key="id" :value="id">{{ id }} — {{ label.label }}</option>
              </select>
              <button type="button" @click="addPower">Ajouter</button>
            </div>
          </section>

          <section class="panel">
            <h2>Traits physiques</h2>
            <div class="badge-list" v-if="card.physicalTraitIds?.length">
              <span v-for="traitId in card.physicalTraitIds" :key="traitId" class="badge badge-trait">
                {{ traitId }} — {{ getCatalogLabel(physicalTraitCatalog, traitId) }}
                <button type="button" class="mini-button" @click="removeTrait(traitId)">×</button>
              </span>
            </div>
            <div v-else class="empty-state">Aucun trait physique</div>
            <div class="catalog-pick">
              <select v-model="selectedTraitId">
                <option value="">Choisir un trait</option>
                <option v-for="(label, id) in physicalTraitCatalog" :key="id" :value="id">{{ id }} — {{ label.label }}</option>
              </select>
              <button type="button" @click="addTrait">Ajouter</button>
            </div>
          </section>

          <section class="panel">
            <h2>Transformations</h2>
            <div class="badge-list" v-if="card.transformationIds?.length">
              <span v-for="transformationId in card.transformationIds" :key="transformationId" class="badge badge-transformation">
                {{ transformationId }} — {{ getCatalogLabel(transformationCatalog, transformationId) }}
                <button type="button" class="mini-button" @click="removeTransformation(transformationId)">×</button>
              </span>
            </div>
            <div v-else class="empty-state">Aucune transformation</div>
            <div class="catalog-pick">
              <select v-model="selectedTransformationId">
                <option value="">Choisir une transformation</option>
                <option v-for="(label, id) in transformationCatalog" :key="id" :value="id">{{ id }} — {{ label.label }}</option>
              </select>
              <button type="button" @click="addTransformation">Ajouter</button>
            </div>
          </section>

          <section class="panel panel-wide">
            <h2>Avatars</h2>
            <div v-if="card.avatars?.length" class="avatar-list">
              <article v-for="avatar in card.avatars" :key="avatar.id" class="avatar-card">
                <div><strong>ID</strong><span>{{ avatar.id }}</span></div>
                <div><strong>Type</strong><span>{{ avatar.type }}</span></div>
                <div><strong>Nom</strong><span>{{ avatar.name }}</span></div>
              </article>
            </div>
            <div v-else class="empty-state">Aucun avatar défini</div>
          </section>

          <section class="panel panel-wide">
            <h2>Règles de combat liées à cette carte</h2>
            <div v-if="card.relatedRules?.length" class="rule-list">
              <article v-for="rule in card.relatedRules" :key="rule.id" class="rule-card">
                <div class="rule-head">
                  <strong>{{ rule.id }}</strong>
                  <span class="rule-tag" :class="rule.active ? 'active' : 'inactive'">{{ rule.active ? 'Actif' : 'Inactif' }}</span>
                </div>
                <p class="rule-name">{{ rule.name }}</p>
                <div class="rule-meta">
                  <span>Phase : {{ rule.phase }}</span>
                  <span>Priorité : {{ rule.priority }}</span>
                </div>
                <p><strong>Conditions :</strong> {{ rule.conditionsSummary }}</p>
                <p><strong>Effets :</strong> {{ rule.effectsSummary }}</p>
              </article>
            </div>
            <div v-else class="empty-state">Aucune règle liée</div>
          </section>

          <section class="panel panel-wide">
            <div class="section-header">
              <h2>Édition avancée des règles</h2>
              <button type="button" class="secondary" @click="advancedRulesOpen = !advancedRulesOpen">{{ advancedRulesOpen ? 'Réduire' : 'Ouvrir' }}</button>
            </div>
            <div v-if="advancedRulesOpen" class="advanced-rule-editor">
              <div class="field-grid">
                <label>Side<select><option>SELF</option></select></label>
                <label>Slot<input value="kenjutsu" type="text" /></label>
                <label>Field<select><option>card.powerIds</option><option>card.physicalTraitIds</option><option>card.transformationIds</option><option>selectedAvatar.id</option><option>card.slug</option><option>card.clans</option></select></label>
                <label>Operator<select><option>IN</option></select></label>
                <label>Value<input value="" type="text" /></label>
              </div>
              <div class="field-grid">
                <label>Operation<select><option>PERCENT_ADD</option></select></label>
                <label>Stat<input value="ninjutsu" type="text" /></label>
                <label>Stacking<select><option>MAX_IN_GROUP</option></select></label>
                <label>Priority<input value="300" type="number" /></label>
                <label>Phase<select><option>MODIFIER</option></select></label>
              </div>
              <button type="button" @click="validateRelations">Valider les relations</button>
            </div>
          </section>

          <section class="panel panel-wide">
            <h2>Validation des relations</h2>
            <div v-if="relationIssues.length" class="validation-errors">
              <p v-for="issue in relationIssues" :key="issue">• {{ issue }}</p>
            </div>
            <div v-else class="empty-state">Aucune erreur de relation détectée.</div>
            <button type="button" class="secondary" @click="validateRelations">Vérifier</button>
          </section>

          <section class="panel panel-wide">
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
                <label>Nom<input v-model="modifierForm.name" type="text" /></label>
                <label>Description<input v-model="modifierForm.description" type="text" /></label>
              </div>
              <div class="field-grid">
                <label>Type<select v-model="modifierForm.direction"><option value="BONUS">BONUS</option><option value="MALUS">MALUS</option></select></label>
                <label>Mode<select v-model="modifierForm.operation"><option value="POINTS">POINTS</option><option value="PERCENT">PERCENTAGE</option></select></label>
                <label>Valeur<input v-model.number="modifierForm.value" type="number" /></label>
              </div>
              <div class="field-grid">
                <label>Cible<select v-model="modifierForm.target"><option v-for="target in modifierTargets" :key="target" :value="target">{{ target }}</option></select></label>
                <label>Condition type<select v-model="modifierForm.conditionType"><option value="always">toujours actif</option><option value="equals">égal à</option><option value="has">possède</option><option value="clan">clan</option><option value="card">carte</option></select></label>
                <label>Condition valeur<input v-model="modifierForm.conditionValue" type="text" /></label>
              </div>
              <div class="field-grid categories-grid"><label class="categories-label">Catégories impactées</label><div class="categories-picker"><label v-for="category in modifierCategories" :key="category" class="checkbox-item"><input v-model="modifierForm.categories" type="checkbox" :value="category" /><span>{{ category }}</span></label></div></div>
              <div class="field-grid single-row-actions"><button type="button" @click="submitModifier">{{ editingModifierId !== null ? 'Modifier l’effet' : 'Ajouter' }}</button><button type="button" class="secondary" @click="resetModifierForm">Réinitialiser</button></div>
            </div>
          </section>
        </div>
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
  max-width: 1180px;
  margin: 0 auto;
  padding: 32px 18px 80px;
}
.breadcrumb {
  margin-bottom: 18px;
}
button {
  border: 1px solid var(--border-strong);
  background: linear-gradient(180deg, #ffb142, #e08814);
  color: #1c130b;
  font-weight: 700;
  min-height: 38px;
  padding: 0 12px;
  border-radius: 10px;
  cursor: pointer;
}
button.secondary {
  background: transparent;
  color: var(--text-main);
}
button.mini-button {
  min-height: auto;
  width: 26px;
  height: 26px;
  padding: 0;
  font-size: 18px;
  border-radius: 999px;
  margin-left: 8px;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
  margin-bottom: 20px;
  padding: 24px;
  background: var(--bg-panel);
  border: 1px solid rgba(242, 161, 67, 0.5);
  border-radius: 16px;
}
.card-identity {
  flex: 1;
}
.card-identity h1 {
  margin: 0 0 18px;
  color: var(--accent-orange);
  font-size: clamp(1.8rem, 3vw, 2.6rem);
}
.identity-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(180px, 1fr));
  gap: 16px;
}
.identity-grid label,
.field-row,
.catalog-select,
.catalog-pick {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
label span,
.field-row label {
  color: var(--text-soft);
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.card-image,
.main-card-image {
  width: 160px;
  height: auto;
  border: 1px solid var(--border-strong);
  border-radius: 12px;
  object-fit: cover;
}
.status-banner {
  margin-bottom: 16px;
  padding: 12px 14px;
  border: 1px solid rgba(145, 208, 95, 0.5);
  background: rgba(145, 208, 95, 0.12);
  color: #d9f6be;
  border-radius: 10px;
}
.admin-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(260px, 1fr));
  gap: 18px;
}
.panel {
  background: var(--bg-panel);
  border: 1px solid rgba(242, 161, 67, 0.45);
  border-radius: 16px;
  padding: 18px;
}
.panel-large,
.panel-wide {
  grid-column: 1 / -1;
}
.panel h2 {
  margin: 0 0 18px;
  color: var(--accent-gold);
  font-size: 1.1rem;
}
.identity-panel {
  display: grid;
  grid-template-columns: 170px 1fr;
  gap: 20px;
  align-items: center;
}
.thumb-wrap {
  display: flex; align-items: center; justify-content: center;
  min-height: 180px;
  border: 1px solid var(--border-light);
  border-radius: 12px;
  background: rgba(255,255,255,0.02);
}
.missing-image {
  color: var(--text-muted);
}
.identity-fields {
  display: grid;
  gap: 14px;
}
.inline-row,
.catalog-pick,
.field-grid {
  display: grid;
  gap: 12px;
}
.inline-row {
  grid-template-columns: 1fr auto auto;
  align-items: center;
}
.stats-grid,
.modifier-list,
.avatar-list,
.rule-list,
.validation-errors {
  display: grid;
  gap: 12px;
}
.stat-row {
  display: grid;
  grid-template-columns: minmax(120px, 1.2fr) minmax(90px, 120px) auto auto;
  gap: 8px;
  align-items: center;
}
.badge-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.badge {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 7px 10px;
  font-size: 0.78rem;
  border: 1px solid rgba(242, 161, 67, 0.4);
  background: rgba(255, 171, 65, 0.08);
  color: var(--text-main);
}
.badge-power { border-color: rgba(114, 161, 255, 0.4); }
.badge-trait { border-color: rgba(101, 220, 177, 0.45); }
.badge-transformation { border-color: rgba(192, 137, 245, 0.45); }
.badge-clan { border-color: rgba(252, 205, 105, 0.5); }
input,
select {
  min-height: 42px;
  background: rgba(18, 20, 27, 0.7);
  border: 1px solid var(--border-light);
  color: var(--text-main);
  border-radius: 10px;
  padding: 0 10px;
}
input[readonly] { opacity: 0.9; }
.empty-state {
  color: var(--text-muted);
  margin: 0;
}
.avatar-card,
.rule-card,
.modifier-item {
  padding: 12px 14px;
  border: 1px solid rgba(242, 161, 67, 0.25);
  background: rgba(255,255,255,0.02);
  border-radius: 12px;
}
.avatar-card {
  display: grid;
  grid-template-columns: repeat(3, minmax(120px, 1fr));
  gap: 12px;
}
.avatar-card div {
  display: grid;
  gap: 4px;
}
.avatar-card strong,
.rule-head,
.rule-meta,
.modifier-summary {
  color: var(--text-soft);
}
.rule-head,
.rule-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}
.rule-tag {
  border-radius: 999px;
  padding: 4px 8px;
  font-size: 0.72rem;
  border: 1px solid;
}
.rule-tag.active { border-color: rgba(118, 204, 92, 0.7); color: #baf0a0; }
.rule-tag.inactive { border-color: rgba(195, 94, 94, 0.7); color: #ffb0b0; }
.rule-name {
  margin: 8px 0;
  color: var(--text-main);
  font-weight: 600;
}
.modifier-item {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  align-items: center;
}
.modifier-summary {
  display: grid;
  gap: 6px;
}
.modifier-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}
.field-grid {
  grid-template-columns: repeat(5, minmax(120px, 1fr));
}
.categories-grid {
  grid-template-columns: 1fr;
}
.categories-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.checkbox-item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid var(--border-light);
  border-radius: 10px;
  background: rgba(255,255,255,0.02);
}
.validation-errors {
  padding: 10px 0;
}
@media (max-width: 830px) {
  .admin-grid { grid-template-columns: 1fr; }
  .identity-panel { grid-template-columns: 1fr; }
  .field-grid { grid-template-columns: 1fr; }
  .inline-row { grid-template-columns: 1fr; }
  .card-header { flex-direction: column; }
  .identity-grid { grid-template-columns: 1fr; }
}
</style>
