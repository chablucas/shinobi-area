<script setup lang="ts">
import { ref } from 'vue'
import type { Card } from '../types/card'

defineProps<{ card: Card; revealed?: boolean; active?: boolean }>()
const imageFailed = ref(false)
</script>

<template>
  <article class="game-card" :class="{ 'is-active': active }">
    <div v-if="!revealed" class="card-back"><span>影</span><small>SHINOBI AREA</small></div>
    <template v-else>
      <div class="card-image-frame">
        <div v-if="!card.imageUrl || imageFailed" class="card-image-fallback">{{ card.name.slice(0, 1) }}</div>
        <img v-else :src="card.imageUrl" :alt="`Carte ${card.name}`" @error="imageFailed = true" />
      </div>
      <div class="game-card-copy">
        <span>Carte révélée</span>
        <h3>{{ card.name }}</h3>
      </div>
    </template>
  </article>
</template>

<style>
.game-card {
  width: 100%;
  background: rgba(15, 20, 27, 0.9);
  border: 1px solid rgba(160, 174, 175, 0.2);
  box-shadow: 0 18px 32px rgba(0, 0, 0, 0.22);
  overflow: hidden;
  transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
}

.game-card.is-active {
  border-color: rgba(241, 212, 141, 0.7);
  box-shadow: 0 18px 34px rgba(246, 128, 72, 0.12);
}

.card-back {
  display: grid;
  place-items: center;
  min-height: 280px;
  background: linear-gradient(135deg, rgba(18, 25, 31, 0.96), rgba(31, 18, 19, 0.96));
  color: var(--accent-gold);
  text-align: center;
}

.card-back span {
  font-family: 'Syne', 'Segoe UI', sans-serif;
  font-size: clamp(2.4rem, 4vw, 4rem);
  font-weight: 700;
}

.card-back small {
  display: block;
  margin-top: 0.5rem;
  color: rgba(243, 245, 242, 0.72);
  letter-spacing: 0.16em;
  font-size: 0.5rem;
  text-transform: uppercase;
}

.card-image-frame {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: min(280px, 42vh);
  overflow: hidden;
  background: linear-gradient(180deg, rgba(17, 20, 24, 0.96), rgba(22, 18, 17, 0.92));
}

.card-image-frame img,
.card-image-fallback {
  width: calc(100% - 4px);
  height: calc(100% - 10px);
  object-fit: cover;
  display: block;
  margin: 0;
}

.card-image-fallback {
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, rgba(50, 31, 20, 0.9), rgba(17, 20, 24, 0.9));
  color: var(--accent-gold);
  font-family: 'Syne', 'Segoe UI', sans-serif;
  font-size: 2.7rem;
  font-weight: 700;
}

.game-card-copy {
  padding: 10px 12px 12px;
}

.game-card-copy span {
  display: block;
  color: var(--text-muted);
  font-size: 0.52rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.game-card-copy h3 {
  margin-top: 8px;
  color: var(--text-main);
  font-size: 0.8rem;
  line-height: 1.45;
  letter-spacing: -0.03em;
}
</style>