<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import SocialHeader from '../components/SocialHeader.vue'
import { fetchAllCards } from '../services/cardApi'
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
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const cards = ref<Card[]>([])
const query = ref('')
const rarity = ref('')
const sort = ref<'name' | 'rarity-asc' | 'rarity-desc'>('rarity-asc')
const flipped = ref(new Set<string>())
const selected = ref<Card | null>(null)
const error = ref('')
const loading = ref(true)
const rarityOrder = computed(() =>
  cards.value
    .map((card) => card.rarityMetadata)
    .filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index)
    .sort((a, b) => a.rank - b.rank),
)
const filteredCards = computed(() =>
  cards.value
    .filter(
      (card) =>
        card.name.toLowerCase().includes(query.value.trim().toLowerCase()) &&
        (!rarity.value || card.effectiveRarity === rarity.value),
    )
    .sort((a, b) =>
      sort.value === 'name'
        ? a.name.localeCompare(b.name)
        : sort.value === 'rarity-asc'
          ? a.rarityMetadata.rank - b.rarityMetadata.rank
          : b.rarityMetadata.rank - a.rarityMetadata.rank,
    ),
)
const statKeys = [
  'chakra',
  'invocation',
  'iq',
  'ninjutsuAttack',
  'ninjutsuDefense',
  'genjutsu',
  'taijutsu',
  'avatar',
  'body',
  'fuinjutsu',
  'senjutsu',
  'kenjutsu',
  'speed',
  'kekkeiGenkai',
]
const statLabels: Record<string, string> = {
  chakra: 'Chakra', invocation: 'Invocation', iq: 'IQ', genjutsu: 'Genjutsu', taijutsu: 'Taijutsu',
  avatar: 'Avatar', body: 'Body', fuinjutsu: 'Fûinjutsu', senjutsu: 'Senjutsu', kenjutsu: 'Kenjutsu',
  speed: 'Vitesse', kekkeiGenkai: 'KG',
}
const editValues = ref<Record<string, number>>({})
const selectedRarity = ref('')
const modifierForm = ref({
  name: '',
  description: '',
  target: 'chakra',
  direction: 'BONUS' as CardModifier['direction'],
  operation: 'PERCENT' as CardModifier['operation'],
  value: 10,
  condition: '',
  active: true,
})
const editingModifier = ref<number | null>(null)

onMounted(async () => {
  try {
    cards.value = await fetchAllCards()
    await auth.loadCurrentUser()
  } catch (exception) {
    error.value = exception instanceof Error ? exception.message : 'Cartes indisponibles.'
  } finally {
    loading.value = false
  }
})
function toggle(slug: string) {
  const next = new Set(flipped.value)
  next.has(slug) ? next.delete(slug) : next.add(slug)
  flipped.value = next
}
function closeAdmin() {
  selected.value = null
}
function traitList(value?: string[]) {
  return value?.length ? value.join(', ') : 'Aucun'
}
function compactStats(card: Card) {
  const kekkeiMora = card.traits?.abilities?.kekkeiMora
  return [
    ...Object.entries(statLabels).map(([key, label]) => ({ label, value: card.effectiveStats[key as keyof Card['effectiveStats']] ?? 0 })),
    { label: 'Ninjutsu', value: `${card.effectiveStats.ninjutsuAttack ?? 0} / ${card.effectiveStats.ninjutsuDefense ?? 0}` },
    { label: 'Kekkei Mōra', value: kekkeiMora?.length ? kekkeiMora.join(' · ') : '—' },
  ]
}
async function openAdmin(card: Card) {
  if (!auth.token || auth.user?.role !== 'ADMIN') return
  try {
    selected.value = await fetchAdminCard(auth.token, card.slug)
    selectedRarity.value = selected.value.effectiveRarity
    editValues.value = Object.fromEntries(
      statKeys.map((key) => [key, selected.value?.effectiveStats[key] ?? 0]),
    )
  } catch (exception) {
    error.value = exception instanceof Error ? exception.message : 'Données admin indisponibles.'
  }
}
async function saveStat(key: string) {
  if (!auth.token || !selected.value) return
  await saveStatOverride(auth.token, selected.value.slug, key, editValues.value[key] ?? 0)
  selected.value = await fetchAdminCard(auth.token, selected.value.slug)
  syncCard()
}
async function resetStat(key: string) {
  if (!auth.token || !selected.value) return
  await resetStatOverride(auth.token, selected.value.slug, key)
  selected.value = await fetchAdminCard(auth.token, selected.value.slug)
  syncCard()
}
async function saveRarity() {
  if (!auth.token || !selected.value) return
  await saveRarityOverride(auth.token, selected.value.slug, selectedRarity.value)
  selected.value = await fetchAdminCard(auth.token, selected.value.slug)
  selectedRarity.value = selected.value.effectiveRarity
  syncCard()
}
async function resetRarity() {
  if (!auth.token || !selected.value) return
  await resetRarityOverride(auth.token, selected.value.slug)
  selected.value = await fetchAdminCard(auth.token, selected.value.slug)
  selectedRarity.value = selected.value.effectiveRarity
  syncCard()
}
async function addModifier() {
  if (
    !auth.token ||
    !selected.value ||
    !modifierForm.value.name.trim() ||
    !modifierForm.value.description.trim()
  )
    return
  const payload = { ...modifierForm.value, condition: modifierForm.value.condition || null }
  if (editingModifier.value) await updateCardModifier(auth.token, editingModifier.value, payload)
  else await createCardModifier(auth.token, selected.value.slug, payload)
  selected.value = await fetchAdminCard(auth.token, selected.value.slug)
  editingModifier.value = null
  modifierForm.value.name = ''
  modifierForm.value.description = ''
}
function editModifier(modifier: CardModifier) {
  editingModifier.value = modifier.id
  modifierForm.value = {
    name: modifier.name,
    description: modifier.description,
    target: modifier.target,
    direction: modifier.direction,
    operation: modifier.operation,
    value: modifier.value,
    condition: modifier.condition ?? '',
    active: modifier.active,
  }
}
async function toggleModifier(modifier: CardModifier) {
  if (!auth.token || !selected.value) return
  await updateCardModifier(auth.token, modifier.id, { ...modifier, active: !modifier.active })
  selected.value = await fetchAdminCard(auth.token, selected.value.slug)
}
async function removeModifier(modifier: CardModifier) {
  if (!auth.token || !selected.value) return
  await deleteCardModifier(auth.token, modifier.id)
  selected.value = await fetchAdminCard(auth.token, selected.value.slug)
}
function syncCard() {
  if (!selected.value) return
  const index = cards.value.findIndex((card) => card.slug === selected.value?.slug)
  if (index >= 0) cards.value[index] = selected.value
}
function modifierText(modifier: CardModifier) {
  return `${modifier.direction === 'BONUS' ? '+' : '-'}${modifier.value}${modifier.operation === 'PERCENT' ? ' %' : ' points'} ${modifier.target}`
}
</script>

<template>
  <main class="characters-page">
    <SocialHeader />
    <section class="characters-content">
      <p class="eyebrow">Collection officielle</p>
      <h1>LES SHINOBIS</h1>
      <p class="characters-intro">
        Explore les 163 cartes de Shinobi Area. Un même personnage peut exister en plusieurs
        versions, avec des statistiques, raretés, capacités et restrictions différentes.
      </p>
      <div class="characters-toolbar">
        <input
          v-model="query"
          class="auth-input"
          type="search"
          placeholder="Rechercher un nom"
          aria-label="Rechercher un personnage"
        /><select v-model="rarity" class="auth-input" aria-label="Filtrer par rareté">
          <option value="">Toutes les raretés</option>
          <option v-for="item in rarityOrder" :key="item.id" :value="item.id">
            {{ item.label }}
          </option></select
        ><select v-model="sort" class="auth-input" aria-label="Trier les cartes">
          <option value="rarity-asc">Rareté croissante</option>
          <option value="rarity-desc">Rareté décroissante</option>
          <option value="name">Nom A-Z</option></select
        ><strong
          >{{ filteredCards.length }} résultat{{ filteredCards.length > 1 ? 's' : '' }}</strong
        >
      </div>
      <p v-if="loading" class="state-message">Chargement des shinobis...</p>
      <p v-else-if="error" class="state-message">{{ error }}</p>
        <div v-else-if="filteredCards.length" class="characters-grid">
          <div v-for="card in filteredCards" :key="card.slug" class="character-tile">
          <article
          class="flip-card"
          :class="{ flipped: flipped.has(card.slug) }"
          tabindex="0"
          @click="toggle(card.slug)"
          @keydown.enter="toggle(card.slug)"
        >
          <div class="flip-inner">
            <div class="card-face card-front" :style="{ '--rarity': card.rarityMetadata.colorHex }">
              <div class="character-image">
                <img
                  v-if="card.imageUrl"
                  :src="card.imageUrl"
                  :alt="card.name"
                  loading="lazy"
                /><span v-else>{{ card.name.slice(0, 1) }}</span>
              </div>
              <p class="rarity-label">{{ card.rarityMetadata.label }}</p>
              <h2>{{ card.name }}</h2>
              <span class="card-slug">{{ card.slug }}</span>
            </div>
            <div class="card-face card-back">
              <p class="rarity-label">{{ card.rarityMetadata.label }}</p>
              <h2>{{ card.name }}</h2>
              <div class="card-facts">
                <div class="stats-section"><b>Stats</b><div class="stats-grid"><span v-for="stat in compactStats(card)" :key="stat.label"><span>{{ stat.label }}</span><strong>{{ stat.value }}</strong></span></div></div>
                <span><b>{{ (card.clans?.length ?? 0) > 1 ? 'Clans' : 'Clan' }}</b>{{ traitList(card.clans) }}</span>
                <span v-if="card.traits?.powerUps?.length"><b>Power Ups</b>{{ traitList(card.traits?.powerUps) }}</span>
                <span v-if="[...(card.traits?.abilities?.ninjutsu ?? []), ...(card.traits?.abilities?.genjutsu ?? []), ...(card.traits?.abilities?.kekkeiGenkai ?? [])].length"><b>Abilities</b>{{ traitList([...(card.traits?.abilities?.ninjutsu ?? []), ...(card.traits?.abilities?.genjutsu ?? []), ...(card.traits?.abilities?.kekkeiGenkai ?? [])]) }}</span>
                <span v-if="card.traits?.dojutsu?.length"><b>Dojutsu</b>{{ traitList(card.traits?.dojutsu) }}</span>
                <span v-if="card.traits?.avatars?.length"><b>Avatars</b>{{ traitList(card.traits?.avatars.map((avatar) => avatar.id)) }}</span>
                <span v-if="[...(card.traits?.requirements?.ninjutsu ?? []), ...(card.traits?.requirements?.genjutsu ?? []), ...(card.traits?.requirements?.avatar ?? [])].length"><b>Restrictions</b>{{ traitList([...(card.traits?.requirements?.ninjutsu ?? []), ...(card.traits?.requirements?.genjutsu ?? []), ...(card.traits?.requirements?.avatar ?? [])]) }}</span>
                <span v-if="card.modifiers.some((modifier) => modifier.active)"><b>Modificateurs</b>{{ card.modifiers.filter((modifier) => modifier.active).map(modifierText).join(' · ') }}</span>
              </div>
            </div>
          </div>
        </article>
        <button v-if="auth.user?.role === 'ADMIN'" type="button" class="edit-button" @click.stop="openAdmin(card)">MODIFIER</button>
        </div>
      </div>
      <p v-else class="state-message">Aucun shinobi ne correspond à ces critères.</p>
    </section>
    <div v-if="selected" class="admin-overlay" @click.self="closeAdmin">
      <section class="admin-panel" role="dialog" aria-modal="true">
        <button class="close-button" type="button" aria-label="Fermer" @click="closeAdmin">
          ×
        </button>
        <p class="eyebrow">Administration</p>
        <h2>{{ selected.name }}</h2>
        <h3>STATISTIQUES</h3>
        <div class="admin-stats">
          <label v-for="key in statKeys" :key="key"
            >{{ key
            }}<span
              >Canonique : {{ selected.baseStats[key] ?? 0 }} · Actuelle :
              {{ selected.effectiveStats[key] ?? 0 }}</span
            ><input v-model.number="editValues[key]" type="number" min="0" max="100" /><button
              type="button"
              @click="saveStat(key)"
            >
              ENREGISTRER</button
            ><button type="button" @click="resetStat(key)">RESET</button></label
          >
        </div>
        <h3>RARETÉ</h3>
        <p>
          Rareté de base :
          <b>{{ rarityOrder.find((item) => item.id === selected?.baseRarity)?.label }}</b>
        </p>
        <select v-model="selectedRarity" class="auth-input">
          <option v-for="item in rarityOrder" :key="item.id" :value="item.id">
            {{ item.label }}
          </option></select
        ><button type="button" @click="saveRarity">ENREGISTRER</button
        ><button type="button" @click="resetRarity">RÉINITIALISER</button>
        <h3>MODIFICATEURS</h3>
        <ul class="modifier-list">
          <li v-for="modifier in selected.modifiers" :key="modifier.id">
            <span
              >{{ modifier.name }} · {{ modifierText(modifier) }} ·
              {{ modifier.active ? 'Actif' : 'Inactif' }}</span
            ><button type="button" @click="editModifier(modifier)">MODIFIER</button
            ><button type="button" @click="toggleModifier(modifier)">{{ modifier.active ? 'DÉSACTIVER' : 'ACTIVER' }}</button
            ><button type="button" @click="removeModifier(modifier)">SUPPRIMER</button>
          </li>
        </ul>
        <div class="modifier-form">
          <input v-model="modifierForm.name" class="auth-input" placeholder="Nom" /><input
            v-model="modifierForm.description"
            class="auth-input"
            placeholder="Description"
          /><select v-model="modifierForm.target" class="auth-input">
            <option v-for="target in statKeys.concat(['kekkeiMora'])" :key="target" :value="target">
              {{ target }}
            </option></select
          ><select v-model="modifierForm.direction" class="auth-input">
            <option value="BONUS">Bonus</option>
            <option value="MALUS">Malus</option></select
          ><select v-model="modifierForm.operation" class="auth-input">
            <option value="PERCENT">Pourcentage</option>
            <option value="POINTS">Points</option></select
          ><input
            v-model.number="modifierForm.value"
            class="auth-input"
            type="number"
            min="0"
            max="100"
          /><input
            v-model="modifierForm.condition"
            class="auth-input"
            placeholder="Condition (facultative)"
          /><button type="button" @click="addModifier">AJOUTER</button>
        </div>
      </section>
    </div>
  </main>
</template>

<style scoped>
.characters-page {
  min-height: 100vh;
  background: var(--bg-main);
}
.characters-content {
  max-width: 1320px;
  margin: 0 auto;
  padding: 64px 20px 100px;
}
.characters-content h1 {
  margin: 12px 0;
  font-size: clamp(2.6rem, 7vw, 6rem);
  color: var(--accent-orange);
}
.characters-intro {
  max-width: 760px;
  color: var(--text-muted);
  line-height: 1.7;
}
.characters-toolbar {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr auto;
  align-items: center;
  gap: 10px;
  margin: 38px 0 24px;
}
.characters-toolbar strong {
  color: var(--accent-gold);
  font-size: 0.7rem;
}
.characters-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 16px;
}
.flip-card {
  min-height: 330px;
  perspective: 1000px;
  cursor: pointer;
}
.flip-inner {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 330px;
  transition: transform 0.65s ease;
  transform-style: preserve-3d;
}
.flip-card.flipped .flip-inner {
  transform: rotateY(180deg);
}
.card-face {
  position: absolute;
  inset: 0;
  backface-visibility: hidden;
  padding: 12px;
  border: 2px solid var(--rarity, var(--border-strong));
  background: var(--bg-panel);
}
.card-front {
  display: flex;
  flex-direction: column;
}
.character-image {
  height: 210px;
  display: grid;
  place-items: center;
  background: var(--bg-panel-strong);
  overflow: hidden;
  color: var(--accent-orange);
  font:
    700 3rem 'Syne',
    sans-serif;
}
.character-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.rarity-label {
  color: var(--rarity, var(--accent-gold));
  font-size: 0.58rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}
.card-front h2,
.card-back h2 {
  margin: 8px 0 2px;
  font-family: 'Syne', sans-serif;
  font-weight: 700;
  font-size: clamp(0.85rem, 2.4vw, 1.25rem);
  line-height: 1.15;
  text-transform: uppercase;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.card-slug {
  color: var(--text-muted);
  font-size: 0.55rem;
}
.card-back {
  transform: rotateY(180deg);
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: thin;
}
.card-facts {
  display: grid;
  gap: 9px;
  min-width: 0;
  margin-top: 9px;
  overflow: hidden;
  color: var(--text-muted);
  font-size: clamp(0.56rem, 1.5vw, 0.7rem);
  line-height: 1.3;
  word-break: break-word;
}
.card-facts > span {
  display: block;
  min-width: 0;
  overflow: hidden;
}
.card-facts b {
  display: block;
  margin-bottom: 4px;
  color: var(--text-soft);
  text-transform: uppercase;
  font-size: clamp(0.5rem, 1.2vw, 0.62rem);
  letter-spacing: 0.08em;
}
.stats-section > b {
  display: block;
  margin-bottom: 4px;
  color: var(--text-soft);
  text-transform: uppercase;
  font-size: clamp(0.5rem, 1.2vw, 0.62rem);
  letter-spacing: 0.08em;
}
.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2px 10px;
  padding: 5px 0;
  border-top: 1px solid var(--border-light);
  border-bottom: 1px solid var(--border-light);
}
.stats-grid > span {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 5px;
  min-width: 0;
  color: var(--text-muted);
  font-size: clamp(0.56rem, 1.4vw, 0.68rem);
}
.stats-grid > span > span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.stats-grid strong {
  flex: 0 0 auto;
  color: var(--text-main);
  font-size: clamp(0.56rem, 1.4vw, 0.68rem);
  font-weight: 700;
  white-space: nowrap;
}
.edit-button,
.admin-panel button {
  border: 1px solid var(--border-strong);
  padding: 8px;
  background: var(--accent-orange);
  color: #2b2113;
  font-size: 0.58rem;
  font-weight: 700;
}
.edit-button {
  margin-top: 12px;
}
.state-message {
  color: var(--accent-gold);
}
.admin-overlay {
  position: fixed;
  inset: 0;
  z-index: 30;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(10, 11, 12, 0.8);
}
.admin-panel {
  position: relative;
  width: min(760px, 100%);
  max-height: 92vh;
  overflow: auto;
  padding: 28px;
  background: var(--bg-panel);
  border: 1px solid var(--border-strong);
}
.admin-panel h2 {
  margin: 8px 0 22px;
  color: var(--accent-orange);
}
.admin-panel h3 {
  margin: 26px 0 12px;
  color: var(--accent-gold);
  font-size: 0.75rem;
}
.close-button {
  position: absolute;
  top: 10px;
  right: 10px;
}
.admin-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.admin-stats label {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 5px;
  color: var(--text-soft);
  font-size: 0.6rem;
}
.admin-stats label span {
  grid-column: 1 / -1;
  color: var(--text-muted);
  font-size: 0.5rem;
}
.admin-stats input {
  min-width: 0;
  background: var(--bg-panel-strong);
  color: var(--text-main);
  border: 1px solid var(--border-light);
}
.modifier-list {
  display: grid;
  gap: 8px;
  padding: 0;
  list-style: none;
  color: var(--text-muted);
  font-size: 0.6rem;
}
.modifier-list li {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  align-items: center;
}
.modifier-form {
  display: grid;
  gap: 8px;
}
.auth-input {
  min-height: 40px;
}
@media (max-width: 700px) {
  .characters-toolbar {
    grid-template-columns: 1fr;
  }
  .admin-stats {
    grid-template-columns: 1fr;
  }
}
</style>
