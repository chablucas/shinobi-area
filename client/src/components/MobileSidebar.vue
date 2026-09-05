<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const navItems = computed(() => [
  { label: 'Accueil', path: '/', icon: '⌂' },
  { label: 'Cartes', path: '/personnages', icon: '🂠' },
  { label: 'Créer mon shinobi', path: '/jouer', icon: '⚔' },
  { label: 'Combat', path: '/partie', icon: '⚡' },
  { label: 'Règles', path: '/regles', icon: '📜' },
  { label: 'Profil', path: auth.isAuthenticated ? '/profil' : '/connexion', icon: '👤' },
])

function closeMenu() {
  emit('close')
}

function navigateTo(path: string) {
  closeMenu()
  void router.push(path)
}

function handleLogout() {
  closeMenu()
  auth.logout()
  void router.push('/')
}

// Close sidebar automatically on route change
watch(
  () => route.fullPath,
  () => {
    if (props.open) {
      closeMenu()
    }
  },
)
</script>

<template>
  <div class="mobile-sidebar-container">
    <!-- Backdrop overlay -->
    <transition name="fade">
      <div
        v-if="open"
        class="sidebar-overlay"
        role="presentation"
        aria-hidden="true"
        @click="closeMenu"
      />
    </transition>

    <!-- Sidebar drawer -->
    <transition name="slide">
      <aside
        v-if="open"
        class="sidebar-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Menu de navigation mobile"
      >
        <header class="sidebar-header">
          <button
            type="button"
            class="sidebar-logo-button"
            aria-label="Retour à l'accueil"
            @click="navigateTo('/')"
          >
            <img src="/logo.png" alt="Shinobi Area" class="sidebar-logo-img" />
            <div class="sidebar-brand-text">
              <span class="brand-title">SHINOBI AREA</span>
              <span class="brand-sub">L'arène des ninjas</span>
            </div>
          </button>
          <button
            type="button"
            class="sidebar-close-button"
            aria-label="Fermer le menu"
            @click="closeMenu"
          >
            ✕
          </button>
        </header>

        <div v-if="auth.isAuthenticated && auth.user" class="sidebar-user-card">
          <div class="sidebar-user-avatar">
            {{ auth.user.displayName.slice(0, 1).toUpperCase() }}
          </div>
          <div class="sidebar-user-info">
            <strong class="sidebar-user-name">{{ auth.user.displayName }}</strong>
            <span class="sidebar-user-stats">{{ auth.user.wins }}V · {{ auth.user.losses }}D</span>
          </div>
        </div>

        <nav class="sidebar-nav">
          <ul class="sidebar-nav-list">
            <li v-for="item in navItems" :key="item.path">
              <button
                type="button"
                class="sidebar-nav-link"
                :class="{ active: route.path === item.path }"
                @click="navigateTo(item.path)"
              >
                <span class="nav-icon" aria-hidden="true">{{ item.icon }}</span>
                <span class="nav-label">{{ item.label }}</span>
                <span class="nav-chevron">›</span>
              </button>
            </li>
          </ul>
        </nav>

        <footer class="sidebar-footer">
          <button
            v-if="auth.isAuthenticated"
            type="button"
            class="sidebar-logout-button"
            @click="handleLogout"
          >
            <span>⏻</span> Déconnexion
          </button>
          <button
            v-else
            type="button"
            class="sidebar-login-button"
            @click="navigateTo('/connexion')"
          >
            <span>👤</span> Se connecter
          </button>
          <p class="sidebar-copyright">© 2026 Shinobi Area</p>
        </footer>
      </aside>
    </transition>
  </div>
</template>

<style scoped>
.mobile-sidebar-container {
  position: relative;
  z-index: 1000;
}

.sidebar-overlay {
  position: fixed;
  inset: 0;
  background: rgba(10, 12, 16, 0.75);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  z-index: 999;
  touch-action: manipulation;
}

.sidebar-drawer {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  width: min(84vw, 320px);
  background: var(--bg-panel);
  border-right: 1px solid var(--border-strong);
  box-shadow: 4px 0 32px rgba(0, 0, 0, 0.6);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background: linear-gradient(135deg, rgba(245, 166, 35, 0.15), rgba(36, 38, 41, 0.9));
  border-bottom: 1px solid var(--border-light);
}

.sidebar-logo-button {
  display: flex;
  align-items: center;
  gap: 12px;
  background: transparent;
  border: 0;
  padding: 4px;
  color: var(--text-main);
  text-align: left;
  cursor: pointer;
}

.sidebar-logo-img {
  width: auto;
  height: 44px;
  object-fit: contain;
}

.sidebar-brand-text {
  display: flex;
  flex-direction: column;
}

.brand-title {
  font-family: 'Syne', sans-serif;
  font-size: 0.95rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: var(--accent-gold);
}

.brand-sub {
  font-size: 0.58rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.sidebar-close-button {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid var(--border-light);
  color: var(--text-main);
  font-size: 1.1rem;
  border-radius: var(--radius-sm);
  cursor: pointer;
  touch-action: manipulation;
  transition: background 0.2s ease, border-color 0.2s ease;
}

.sidebar-close-button:hover,
.sidebar-close-button:active {
  background: rgba(255, 91, 91, 0.2);
  border-color: var(--accent-red);
  color: var(--accent-red);
}

.sidebar-user-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: rgba(15, 20, 27, 0.7);
  border-bottom: 1px solid var(--border-light);
}

.sidebar-user-avatar {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  background: var(--accent-orange);
  color: #2b2113;
  font-family: 'Syne', sans-serif;
  font-weight: 800;
  font-size: 1.1rem;
  border-radius: 4px;
}

.sidebar-user-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.sidebar-user-name {
  font-size: 0.75rem;
  color: var(--text-main);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sidebar-user-stats {
  font-size: 0.6rem;
  color: var(--accent-gold);
  letter-spacing: 0.08em;
}

.sidebar-nav {
  flex: 1;
  padding: 14px 10px;
}

.sidebar-nav-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sidebar-nav-link {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  min-height: 48px;
  padding: 10px 14px;
  background: transparent;
  border: 1px solid transparent;
  color: var(--text-soft);
  text-align: left;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  border-radius: var(--radius-sm);
  cursor: pointer;
  touch-action: manipulation;
  transition: all 0.2s ease;
}

.sidebar-nav-link:hover,
.sidebar-nav-link:active {
  background: rgba(245, 166, 35, 0.12);
  border-color: rgba(245, 166, 35, 0.35);
  color: var(--accent-gold);
}

.sidebar-nav-link.active {
  background: linear-gradient(135deg, rgba(245, 166, 35, 0.24), rgba(255, 209, 102, 0.1));
  border-color: var(--accent-gold);
  color: var(--accent-gold);
  font-weight: 700;
}

.nav-icon {
  font-size: 1rem;
  width: 20px;
  text-align: center;
  color: var(--accent-orange);
}

.nav-label {
  flex: 1;
}

.nav-chevron {
  color: var(--text-muted);
  font-size: 1.1rem;
}

.sidebar-footer {
  padding: 16px;
  border-top: 1px solid var(--border-light);
  background: rgba(15, 20, 27, 0.5);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sidebar-logout-button,
.sidebar-login-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  min-height: 46px;
  padding: 10px 14px;
  border: 1px solid var(--border-light);
  background: rgba(255, 91, 91, 0.15);
  color: var(--accent-red);
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  border-radius: var(--radius-sm);
  cursor: pointer;
  touch-action: manipulation;
  transition: background 0.2s ease, border-color 0.2s ease;
}

.sidebar-login-button {
  background: linear-gradient(135deg, var(--accent-gold), var(--accent-orange));
  color: #181a1b;
  border-color: transparent;
}

.sidebar-logout-button:hover,
.sidebar-logout-button:active {
  background: rgba(255, 91, 91, 0.3);
  border-color: var(--accent-red);
}

.sidebar-copyright {
  margin: 0;
  text-align: center;
  font-size: 0.58rem;
  color: var(--text-muted);
  letter-spacing: 0.08em;
}

/* Animations */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-enter-active,
.slide-leave-active {
  transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1);
}

.slide-enter-from,
.slide-leave-to {
  transform: translateX(-100%);
}
</style>
