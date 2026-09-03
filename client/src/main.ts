import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import { RouterView } from 'vue-router'

const app = createApp(RouterView)

app.use(createPinia())
app.use(router)

app.mount('#app')
