import { createServer } from 'node:http'
import { app } from './app.js'
import { env, isAllowedOrigin } from './config/env.js'
import { Server } from 'socket.io'
import { attachRealtime } from './realtime.js'

const httpServer = createServer(app)
const io = new Server(httpServer, { cors: { origin: (origin, callback) => callback(null, isAllowedOrigin(origin)) } })
attachRealtime(io)
httpServer.listen(env.port, () => console.log(`API Shinobi Area démarrée sur http://localhost:${env.port}`))