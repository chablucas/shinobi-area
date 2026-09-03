import { app } from './app.js'
import { env } from './config/env.js'

app.listen(env.port, () => console.log(`API Shinobi Area démarrée sur http://localhost:${env.port}`))