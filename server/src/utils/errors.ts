import type { ErrorRequestHandler, RequestHandler } from 'express'

export const notFound: RequestHandler = (_request, response) => {
  response.status(404).json({ error: 'Route introuvable' })
}

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  console.error(error)
  response.status(500).json({ error: 'Erreur interne du serveur' })
}