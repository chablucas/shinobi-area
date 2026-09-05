<script setup lang="ts">
import { computed } from 'vue'
import type { Card } from '../types/card'

type DrawCardLike = Pick<Card, 'name' | 'imageUrl' | 'clans' | 'traits'> & {
  stats?: Record<string, number | null>
}

const props = withDefaults(defineProps<{
  card: DrawCardLike | null
  title?: string
  buttonLabel?: string
  buttonDisabled?: boolean
  showButton?: boolean
  stats?: Array<{ label: string; value: string | number }>
  bonuses?: Array<{ label: string; value: string }>
  emptyText?: string
  waitingText?: string
}>(), {
  title: 'Carte piochée',
  buttonLabel: 'PIOCHER',
  buttonDisabled: false,
  showButton: false,
  stats: () => [],
  bonuses: () => [],
  emptyText: 'Aucune carte en main.',
  waitingText: 'EN ATTENTE',
})

const emit = defineEmits<{ draw: [] }>()
const statRows = computed(() => props.stats ?? [])
const bonusRows = computed(() => props.bonuses ?? [])
</script>

<template>
  <div class="combat-draw-area">
    <div class="draw-card-panel">
      <template v-if="card">
        <div class="draw-card-art">
          <img v-if="card.imageUrl" :src="card.imageUrl" :alt="card.name" />
          <span v-else>{{ card.name.slice(0, 1) }}</span>
        </div>
        <div class="draw-card-copy">
          <span class="eyebrow">{{ title }}</span>
          <strong>{{ card.name }}</strong>
        </div>
      </template>
      <template v-else>
        <div class="draw-card-placeholder">
          <span>{{ waitingText }}</span>
        </div>
      </template>
    </div>

    <div class="draw-stats-panel">
      <div class="panel-header">
        <span class="eyebrow">Stats</span>
      </div>
      <dl v-if="statRows.length" class="draw-stat-list">
        <div v-for="stat in statRows" :key="stat.label" class="draw-stat-row">
          <dt>{{ stat.label }}</dt>
          <dd>{{ stat.value }}</dd>
        </div>
      </dl>
      <p v-else class="muted-copy">{{ emptyText }}</p>
    </div>

    <div class="draw-bonus-panel">
      <div class="panel-header">
        <span class="eyebrow">Bonus</span>
      </div>
      <ul v-if="bonusRows.length" class="draw-bonus-list">
        <li v-for="bonus in bonusRows" :key="bonus.label">
          <strong>{{ bonus.label }}</strong>
          <span>{{ bonus.value }}</span>
        </li>
      </ul>
      <p v-else class="muted-copy">Aucun bonus utile</p>
    </div>

    <button v-if="showButton" type="button" class="draw-button" :disabled="buttonDisabled" @click="emit('draw')">
      {{ buttonLabel }}
    </button>
  </div>
</template>

<style scoped>
.combat-draw-area {
  display: grid;
  grid-template-columns: minmax(180px, 1.1fr) minmax(240px, 1.5fr) minmax(180px, 1fr);
  gap: 12px;
  align-items: stretch;
  padding: 12px;
  border: 1px solid rgba(240, 168, 78, 0.35);
  background: linear-gradient(135deg, rgba(24, 29, 35, 0.98), rgba(15, 19, 23, 0.94));
  border-radius: 16px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.2);
}

.draw-card-panel,
.draw-stats-panel,
.draw-bonus-panel {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  border: 1px solid rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.02);
  border-radius: 12px;
  padding: 10px;
  min-height: 160px;
}

.draw-card-art {
  display: grid;
  place-items: center;
  width: 100%;
  min-height: 112px;
  border-radius: 12px;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.25);
}

.draw-card-art img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.draw-card-copy {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 10px;
}

.draw-card-copy strong {
  font-size: 0.95rem;
  line-height: 1.2;
}

.draw-card-placeholder {
  display: grid;
  place-items: center;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-muted);
  min-height: 140px;
}

.panel-header {
  margin-bottom: 8px;
}

.eyebrow {
  text-transform: uppercase;
  letter-spacing: .14em;
  font-size: .58rem;
  color: var(--accent-gold);
}

.draw-stat-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px 10px;
  margin: 0;
}

.draw-stat-row {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  padding-bottom: 5px;
}

.draw-stat-row dt {
  color: var(--text-muted);
  font-size: 0.72rem;
}

.draw-stat-row dd {
  margin: 0;
  font-weight: 700;
  font-size: 0.82rem;
}

.draw-bonus-list {
  list-style: none;
  display: grid;
  gap: 8px;
  padding: 0;
  margin: 0;
}

.draw-bonus-list li {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px 8px;
  border-radius: 8px;
  background: rgba(246, 128, 72, 0.08);
  border: 1px solid rgba(246, 128, 72, 0.2);
}

.draw-bonus-list strong {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: .05em;
  color: var(--accent-gold);
}

.draw-bonus-list span,
.muted-copy {
  color: var(--text-muted);
  font-size: 0.72rem;
}

.draw-button {
  grid-column: 1 / -1;
  width: 100%;
  border: 1px solid rgba(246,128,72,0.7);
  background: linear-gradient(135deg, rgba(246,128,72,0.18), rgba(255,190,104,0.14));
  color: var(--text-main);
  font-weight: 800;
  letter-spacing: .12em;
  text-transform: uppercase;
  padding: 10px 14px;
  border-radius: 12px;
  cursor: pointer;
}

.draw-button:disabled {
  opacity: .55;
  cursor: not-allowed;
}

@media (max-width: 820px) {
  .combat-draw-area {
    grid-template-columns: 1fr;
  }
}
</style>
