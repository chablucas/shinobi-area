<script setup lang="ts">
import type { Category } from '../types/card'

defineProps<{ categories: Category[]; selected: Category | null; disabled?: boolean }>()
defineEmits<{ select: [category: Category] }>()
</script>

<template>
  <div class="category-selector">
    <button v-for="category in categories" :key="category.slug" type="button" :disabled="disabled" :class="{ selected: selected?.slug === category.slug }" @click="$emit('select', category)">
      <span>{{ category.label }}</span>
      <strong>{{ selected?.slug === category.slug ? 'Choisie' : 'Choisir' }}</strong>
    </button>
  </div>
</template>