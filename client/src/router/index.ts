import { createRouter, createWebHistory } from 'vue-router'
import App from '../App.vue'
import Partie from '../views/Partie.vue'
import Profil from '../views/Profil.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', component: App },
    { path: '/partie', component: Partie, props: { mode: 'local2' } },
    { path: '/solo', component: Partie, props: { mode: 'solo' } },
    { path: '/2-joueurs', redirect: '/partie' },
    { path: '/3-joueurs', component: Partie, props: { mode: 'local3' } },
    { path: '/profil', component: Profil },
  ],
})

export default router
