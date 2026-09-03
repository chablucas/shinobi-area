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
      <div v-if="!card.imageUrl || imageFailed" class="card-image-fallback">{{ card.name.slice(0, 1) }}</div>
      <img v-else :src="card.imageUrl" :alt="`Carte ${card.name}`" @error="imageFailed = true" />
      <div class="game-card-copy">
        <span>Carte révélée</span>
        <h3>{{ card.name }}</h3>
      </div>
    </template>
  </article>
</template>