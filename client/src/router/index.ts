import { createRouter, createWebHistory } from 'vue-router'
import App from '../App.vue'
import Partie from '../views/Partie.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', component: App },
    { path: '/partie', component: Partie },
  ],
})

export default router
