<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const auth = useAuthStore()
const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)
async function submit() { error.value = ''; loading.value = true; try { await auth.login(email.value, password.value); await router.push('/profil') } catch (exception) { error.value = exception instanceof Error ? exception.message : 'Connexion impossible.' } finally { loading.value = false } }
</script>

<template>
  <main class="auth-page"><nav class="auth-nav"><a class="brand" href="/"><img class="brand-logo" src="/logo.png" alt="Shinobi Area" /></a><a class="profile-link" href="/inscription">Créer un compte</a></nav><form class="auth-panel" @submit.prevent="submit"><p class="eyebrow">Accès shinobi</p><h1>Connexion</h1><label>Email<input v-model.trim="email" type="email" autocomplete="email" required /></label><label>Mot de passe<input v-model="password" type="password" autocomplete="current-password" required /></label><p v-if="error" class="auth-error">{{ error }}</p><button class="auth-submit" type="submit" :disabled="loading">{{ loading ? 'Connexion...' : 'Se connecter' }}</button></form></main>
</template>

<style scoped>
.auth-page { min-height: 100vh; background: var(--bg-main); }.auth-nav { display: flex; align-items: center; justify-content: space-between; padding: 10px max(20px, calc((100vw - 1180px) / 2)); background: var(--accent-orange); }.auth-nav .brand-logo { width: auto; height: 52px; object-fit: contain; }.auth-panel { display: grid; gap: 16px; max-width: 500px; margin: 80px auto; padding: 34px; background: var(--bg-panel); border: 1px solid var(--border-light); clip-path: var(--clip-soft); }.auth-panel h1 { margin: 10px 0 18px; font-size: clamp(2.5rem, 7vw, 4.5rem); text-transform: uppercase; }.auth-panel label { display: grid; gap: 7px; color: var(--text-muted); font-size: .62rem; letter-spacing: .1em; text-transform: uppercase; }.auth-panel input { padding: 13px; border: 1px solid var(--border-light); background: var(--bg-panel-strong); color: var(--text-main); }.auth-submit { min-height: 48px; border: 0; background: linear-gradient(135deg, var(--accent-gold), var(--accent-orange)); color: #242629; font-weight: 700; text-transform: uppercase; letter-spacing: .1em; }.auth-error { color: var(--accent-red); font-size: .68rem; }
</style>
