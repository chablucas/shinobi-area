<script setup lang="ts">
import SocialHeader from '../components/SocialHeader.vue'
import type { GameLobby } from '../services/socialApi'

const lobby: GameLobby | null = null
</script>

<template>
  <main class="lobby-page"><SocialHeader /><section class="lobby-content"><p class="eyebrow">Salon de combat</p><h1>Lobby</h1><p v-if="!lobby" class="lobby-empty">Les invitations de combat seront disponibles à l’étape 3.</p></section></main>
</template>

<style scoped>
.lobby-page { min-height: 100vh; background: var(--bg-main); }.lobby-content { max-width: 860px; margin: 0 auto; padding: 72px 20px; }.lobby-content h1 { margin: 14px 0; font-size: clamp(3rem, 8vw, 6rem); text-transform: uppercase; }.lobby-empty { color: var(--text-muted); font-size: .72rem; }
</style>
