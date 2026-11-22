import { randomUUID } from 'node:crypto'
import type { ErrorRequestHandler, RequestHandler, Response } from 'express'
import { ZodError } from 'zod'

const DOCS = 'https://docs.meteopro.fr/errors'

export class HttpError extends Error {
  readonly status: number
  readonly title: string
  readonly detail: string | undefined
  readonly type: string

  constructor(status: number, title: string, detail?: string, type = 'about:blank') {
    super(title)
    this.status = status
    this.title = title
    this.detail = detail
    this.type = type
  }
}

export class BadRequest extends HttpError {
  constructor(detail?: string) {
    super(400, 'Requête invalide', detail, `${DOCS}/bad-request`)
  }
}

export class Unauthorized extends HttpError {
  constructor(detail = 'Authentification requise.') {
    super(401, 'Non authentifié', detail, `${DOCS}/unauthorized`)
  }
}

export class Forbidden extends HttpError {
  constructor(detail = 'Accès refusé.') {
    super(403, 'Accès refusé', detail, `${DOCS}/forbidden`)
  }
}

export class NotFound extends HttpError {
  constructor(detail = 'Ressource introuvable.') {
    super(404, 'Ressource introuvable', detail, `${DOCS}/not-found`)
  }
}

export class BadGateway extends HttpError {
  constructor(detail = 'Le service amont ne répond pas correctement.') {
    super(502, 'Service amont indisponible', detail, `${DOCS}/bad-gateway`)
  }
}

/** Identifiant de trace : repris de l'en-tête X-Request-Id s'il est sûr, sinon généré. */
export const requestId: RequestHandler = (req, res, next) => {
  const incoming = req.get('x-request-id')
  const traceId = incoming && /^[\w-]{8,64}$/.test(incoming) ? incoming : randomUUID()
  res.locals.traceId = traceId
  res.set('X-Request-Id', traceId)
  next()
}

export function sendProblem(
  res: Response,
  status: number,
  body: { type?: string, title: string, detail?: string | undefined, errors?: unknown[] },
): void {
  res
    .status(status)
    .type('application/problem+json')
    .json({
      type: body.type ?? 'about:blank',
      title: body.title,
      status,
      ...(body.detail ? { detail: body.detail } : {}),
      instance: res.req.originalUrl.split('?')[0],
      traceId: res.locals.traceId,
      ...(body.errors ? { errors: body.errors } : {}),
    })
}

/** Gestionnaire d'erreurs final : RFC 9457, jamais de stack trace côté client. */
export const problemHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    return sendProblem(res, 422, {
      type: `${DOCS}/validation`,
      title: 'Paramètres invalides',
      errors: err.issues.map((issue) => ({
        field: issue.path.join('.') || null,
        code: issue.code,
        message: issue.message,
      })),
    })
  }
  if (err instanceof HttpError) {
    return sendProblem(res, err.status, { type: err.type, title: err.title, detail: err.detail })
  }
  // Erreurs du parseur JSON d'Express
  if (err?.type === 'entity.too.large') {
    return sendProblem(res, 413, { title: 'Corps de requête trop volumineux' })
  }
  if (err?.type === 'entity.parse.failed') {
    return sendProblem(res, 400, { title: 'JSON invalide' })
  }
  console.error(JSON.stringify({ level: 'error', traceId: res.locals.traceId, message: String(err) }))
  return sendProblem(res, 500, { title: 'Erreur interne', detail: 'Une erreur inattendue est survenue.' })
}

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(new NotFound('Cette route n\'existe pas.'))
}
