<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { fetchCard } from '../services/cardApi'
import type { Card } from '../types/card'
import SocialHeader from '../components/SocialHeader.vue'

const route = useRoute()
const card = ref<Card | null>(null)
const error = ref('')
onMounted(async () => { try { card.value = await fetchCard(String(route.params.slug)) } catch (exception) { error.value = exception instanceof Error ? exception.message : 'Carte introuvable.' } })
</script>

<template><main class="card-detail-page"><SocialHeader /><section class="card-detail-content"><p v-if="error" class="card-error">{{ error }}</p><article v-else-if="card" class="card-detail"><div class="card-detail-image"><img v-if="card.imageUrl" :src="card.imageUrl" :alt="card.name" /></div><div><p class="eyebrow">Shinobi</p><h1>{{ card.name }}</h1><div class="stat-list"><span v-for="(value, key) in card.stats" :key="key"><b>{{ key }}</b><i>{{ value ?? 0 }}</i></span></div></div></article></section></main></template>

<style scoped>
.card-detail-page { min-height: 100vh; background: var(--bg-main); }.card-detail-content { max-width: 980px; margin: 0 auto; padding: 72px 20px; }.card-detail { display: grid; grid-template-columns: minmax(220px, 340px) 1fr; gap: 28px; padding: 28px; border: 1px solid var(--border-strong); background: var(--bg-panel); }.card-detail-image { min-height: 320px; background: var(--bg-panel-strong); }.card-detail-image img { width: 100%; height: 100%; min-height: 320px; object-fit: cover; }.card-detail h1 { margin: 12px 0 26px; font-size: clamp(2rem, 6vw, 4.5rem); text-transform: uppercase; }.stat-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }.stat-list span { display: flex; justify-content: space-between; gap: 12px; padding: 9px; background: var(--bg-panel-strong); color: var(--text-muted); font-size: .58rem; text-transform: uppercase; }.stat-list b { color: var(--text-soft); }.stat-list i { color: var(--accent-gold); font-style: normal; }.card-error { color: var(--accent-red); }@media (max-width: 680px) { .card-detail { grid-template-columns: 1fr; }.card-detail-image { min-height: 240px; } }
</style>
