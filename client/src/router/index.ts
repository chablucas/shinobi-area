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
import AdminDashboard from '../views/AdminDashboard.vue'
import AdminCardEdit from '../views/AdminCardEdit.vue'
import Simulation from '../views/Simulation.vue'
import TeamAuction from '../views/TeamAuction.vue'
import { useAuthStore } from '../stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', component: App },
    { path: '/partie', component: Partie, props: { mode: 'local2' } },
    { name: 'partie-lobby', path: '/partie/:lobbyId', component: Partie, props: (route) => ({ lobbyId: String(route.params.lobbyId), mode: route.query.mode === '1v1v1' ? 'local3' : 'local2' }) },
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
    { path: '/simulation', component: Simulation },
    { path: '/team-game', component: TeamAuction },
    {
      path: '/admin',
      component: AdminDashboard,
      meta: { requiresAdmin: true },
    },
    {
      path: '/admin/cards/:slug',
      component: AdminCardEdit,
      meta: { requiresAdmin: true },
    },
  ],
})

router.beforeEach(async (to, _from, next) => {
  if (!to.meta.requiresAdmin) {
    next()
    return
  }

  const auth = useAuthStore()
  await auth.loadCurrentUser()
  if (auth.user?.role === 'ADMIN') {
    next()
    return
  }

  next('/personnages')
})

export default router
