import type { ErrorRequestHandler, RequestHandler } from 'express'

export const notFound: RequestHandler = (_request, response) => {
  response.status(404).json({ error: 'Route introuvable' })
}

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  console.error(error)
  const statusCode = typeof error?.statusCode === 'number' ? error.statusCode : 500
  response.status(statusCode).json({ error: statusCode === 500 ? 'Erreur interne du serveur' : error.message })
}