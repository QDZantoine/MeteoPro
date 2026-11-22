import express from 'express'
import { notFoundHandler, problemHandler, requestId } from './shared/errors.ts'

export function createApp() {
  const app = express()
  app.disable('x-powered-by')
  app.use(requestId)
  app.use(express.json({ limit: '100kb' }))

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' })
  })

  // TP 2 : brancher ici les routes /v1/cities/:cityId/forecast et /v1/alerts

  app.use(notFoundHandler)
  app.use(problemHandler)
  return app
}
