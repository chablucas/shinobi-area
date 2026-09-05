import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import { RouterView } from 'vue-router'
import './styles/shinobi-theme.css'
import './styles/cards.css'

const app = createApp(RouterView)

app.use(createPinia())
app.use(router)

app.mount('#app')
