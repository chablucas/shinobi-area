<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const auth = useAuthStore()
const displayName = ref('')
const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)
async function submit() { error.value = ''; loading.value = true; try { await auth.register(email.value, password.value, displayName.value); await router.push('/profil') } catch (exception) { error.value = exception instanceof Error ? exception.message : 'Inscription impossible.' } finally { loading.value = false } }
</script>

<template>
  <main class="auth-page"><nav class="auth-nav"><a class="brand" href="/"><img class="brand-logo" src="/logo.png" alt="Shinobi Area" /></a><a class="profile-link" href="/connexion">Se connecter</a></nav><form class="auth-panel" @submit.prevent="submit"><p class="eyebrow">Nouveau shinobi</p><h1>Inscription</h1><label for="register-name">Nom / pseudo</label><input id="register-name" v-model.trim="displayName" class="auth-input" type="text" autocomplete="nickname" required /><label for="register-email">Email</label><input id="register-email" v-model.trim="email" class="auth-input" type="email" autocomplete="email" required /><label for="register-password">Mot de passe</label><input id="register-password" v-model="password" class="auth-input" type="password" autocomplete="new-password" minlength="6" required /><p v-if="error" class="auth-error">{{ error }}</p><button class="auth-submit" type="submit" :disabled="loading">{{ loading ? 'Création...' : 'Créer mon compte' }}</button><p class="auth-switch">Déjà un compte ? <a href="/connexion">Se connecter</a></p></form></main>
</template>

<style scoped>
.auth-page { min-height: 100vh; background: var(--bg-main); }
.auth-nav { display: flex; align-items: center; justify-content: space-between; padding: 10px max(20px, calc((100vw - 1180px) / 2)); background: var(--accent-orange); }
.auth-nav .brand-logo { width: auto; height: 52px; object-fit: contain; }
.auth-panel { display: grid; gap: 10px; width: min(calc(100% - 32px), 620px); max-width: 620px; margin: 64px auto; padding: 34px; box-sizing: border-box; overflow: hidden; background: var(--bg-panel); border: 1px solid var(--border-light); clip-path: var(--clip-soft); }
.auth-panel h1 { max-width: 100%; margin: 8px 0 18px; overflow-wrap: anywhere; font-size: clamp(2.7rem, 6vw, 5rem); line-height: .95; letter-spacing: -0.04em; text-transform: uppercase; }
.auth-panel label { margin-top: 6px; color: var(--text-muted); font-size: .62rem; letter-spacing: .1em; text-transform: uppercase; }
.auth-submit { min-height: 48px; margin-top: 8px; border: 0; background: linear-gradient(135deg, var(--accent-gold), var(--accent-orange)); color: #242629; font-weight: 700; text-transform: uppercase; letter-spacing: .1em; }
.auth-submit:focus-visible { outline: 3px solid var(--accent-gold); outline-offset: 3px; }
.auth-error { color: var(--accent-red); font-size: .68rem; }
.auth-switch { margin-top: 8px; color: var(--text-muted); font-size: .68rem; text-align: center; }
.auth-switch a { color: var(--accent-gold); text-decoration: underline; text-underline-offset: 3px; }
.auth-switch a:focus-visible { outline: 2px solid var(--accent-gold); outline-offset: 3px; }

.auth-submit { width: 100%; box-sizing: border-box; }

@media (max-width: 560px) {
  .auth-panel { margin-top: 40px; padding: 26px 22px; }
  .auth-panel h1 { font-size: clamp(2.35rem, 14vw, 3.5rem); }
}
</style>
