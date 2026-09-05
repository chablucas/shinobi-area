import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import * as authApi from '../services/authApi'

const TOKEN_KEY = 'shinobi-area-token'

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem(TOKEN_KEY))
  const user = ref<authApi.User | null>(null)
  const isAuthenticated = computed(() => !!token.value)

  async function loadCurrentUser() {
    if (!token.value) return
    try {
      user.value = await authApi.getMe(token.value)
    } catch (error) {
      if (error instanceof authApi.AuthApiError && error.status === 401) logout()
    }
  }
  function setSession(session: { token: string; user: authApi.User }) { token.value = session.token; user.value = session.user; localStorage.setItem(TOKEN_KEY, session.token) }
  async function login(email: string, password: string) { setSession(await authApi.login(email, password)) }
  async function register(email: string, password: string, displayName: string) { setSession(await authApi.register(email, password, displayName)) }
  async function updateProfile(displayName: string) { if (!token.value) throw new Error('Authentification requise.'); user.value = await authApi.updateProfile(token.value, displayName) }
  async function recordResult(gameId: string, won: boolean) { if (!token.value) return false; const result = await authApi.recordResult(token.value, gameId, won); if (result.recorded) await loadCurrentUser(); return result.recorded }
  function logout() { token.value = null; user.value = null; localStorage.removeItem(TOKEN_KEY) }
  return { token, user, isAuthenticated, loadCurrentUser, login, register, updateProfile, recordResult, logout }
})
