import { createRouter, createWebHistory } from 'vue-router'
import App from '../App.vue'
import Partie from '../views/Partie.vue'
import Profil from '../views/Profil.vue'
import Connexion from '../views/Connexion.vue'
import Inscription from '../views/Inscription.vue'
import Jouer from '../views/Jouer.vue'
import ProfilPublic from '../views/ProfilPublic.vue'
import CarteDetail from '../views/CarteDetail.vue'
import Lobby from '../views/Lobby.vue'
import Personnages from '../views/Personnages.vue'
import Regles from '../views/Regles.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', component: App },
    { path: '/partie', component: Partie, props: { mode: 'local2' } },
    { path: '/solo', component: Partie, props: { mode: 'solo' } },
    { path: '/2-joueurs', redirect: '/partie' },
    { path: '/3-joueurs', component: Partie, props: { mode: 'local3' } },
    { path: '/profil', component: Profil },
    { path: '/connexion', component: Connexion },
    { path: '/inscription', component: Inscription },
    { path: '/jouer', component: Jouer },
    { path: '/profil-public/:id', component: ProfilPublic },
    { path: '/cartes/:slug', component: CarteDetail },
    { path: '/lobby/:id', component: Lobby },
    { path: '/personnages', component: Personnages },
    { path: '/regles', component: Regles },
  ],
})

export default router
