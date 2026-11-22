import type { AddressInfo } from 'node:net'
import { after } from 'node:test'
import type { Express } from 'express'

/** Démarre l'application sur un port libre et renvoie son URL ; arrêt automatique en fin de fichier. */
export async function serve(app: Express): Promise<string> {
  const server = app.listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  after(() => server.close())
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`
}

/** Raccourci : requête JSON avec fetch, réponse et corps déjà lus. */
export async function call(url: string, init: { method?: string, body?: unknown, headers?: Record<string, string> } = {}) {
  const res = await fetch(url, {
    method: init.method ?? 'GET',
    headers: { ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
    body: init.body === undefined ? undefined : typeof init.body === 'string' ? init.body : JSON.stringify(init.body),
  })
  const text = await res.text()
  let body: any = text
  try { body = JSON.parse(text) } catch { /* corps non JSON */ }
  return { status: res.status, headers: res.headers, body }
}
