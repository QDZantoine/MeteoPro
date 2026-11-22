/*
 * API VOLONTAIREMENT VULNÉRABLE : support du TP 4 (audit OWASP API Top 10).
 * Ne jamais exposer hors du poste de formation. Chaque faille est repérée par un commentaire [APIx].
 */
import { createHmac } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import express, { type NextFunction, type Request, type Response } from 'express'

const PORT = Number(process.env.AUDIT_PORT ?? 5000)
const SECRET = 'secret123' // [API2] secret faible, en dur dans le code

const db = new DatabaseSync(':memory:')
db.exec(`
  CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT UNIQUE, password TEXT, email TEXT, role TEXT, iban TEXT);
  INSERT INTO users (username, password, email, role, iban) VALUES
    ('admin', 'admin123', 'admin@meteopro.test', 'admin', 'FR76 0000 0000 0000 0000 0000 001'),
    ('alice', 'alice2024', 'alice@meteopro.test', 'user', 'FR76 0000 0000 0000 0000 0000 002'),
    ('bob', 'bob2024', 'bob@meteopro.test', 'user', 'FR76 0000 0000 0000 0000 0000 003');
  CREATE TABLE stations (id INTEGER PRIMARY KEY, name TEXT, owner_id INTEGER, api_key TEXT);
  INSERT INTO stations (name, owner_id, api_key) VALUES
    ('Lyon Bron', 2, 'sk-alice-7f3a'), ('Villeurbanne', 2, 'sk-alice-91bc'), ('Grenoble', 3, 'sk-bob-c0de');
`)

type User = { id: number, username: string, password: string, email: string, role: string, iban: string }
type Claims = { sub: number, username: string, role: string }

const b64 = (value: string | Buffer): string => Buffer.from(value).toString('base64url')

function sign(claims: Claims): string {
  const head = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = b64(JSON.stringify(claims)) // [API2] pas de exp : le jeton ne périme jamais
  const sig = createHmac('sha256', SECRET).update(`${head}.${body}`).digest('base64url')
  return `${head}.${body}.${sig}`
}

function verify(token: string): Claims | undefined {
  const [head, body, sig] = token.split('.')
  if (!head || !body) return undefined
  const header = JSON.parse(Buffer.from(head, 'base64url').toString())
  if (header.alg === 'none') return JSON.parse(Buffer.from(body, 'base64url').toString()) // [API2] alg none accepté
  const expected = createHmac('sha256', SECRET).update(`${head}.${body}`).digest('base64url')
  return sig === expected ? JSON.parse(Buffer.from(body, 'base64url').toString()) : undefined
}

function auth(req: Request, res: Response, next: NextFunction) {
  const claims = verify(req.get('authorization')?.replace('Bearer ', '') ?? '')
  if (!claims) return res.status(401).json({ error: 'token invalide' })
  res.locals.user = claims
  next()
}

const app = express() // [API8] X-Powered-By laissé actif
app.use(express.json()) // [API4] pas de limite de taille explicite

app.use((req, res, next) => {
  // [API8] CORS : reflète n'importe quelle origine, avec les cookies
  res.set('Access-Control-Allow-Origin', req.get('origin') ?? '*')
  res.set('Access-Control-Allow-Credentials', 'true')
  next()
})

app.get('/', (_req, res) => {
  res.json({ name: 'MétéoPro Audit API', version: '1.4.2', docs: 'Voir le cahier de TP, TP 4' })
})

// [API4] aucune limitation de tentatives : force brute possible
app.post('/api/login', (req, res) => {
  const { username, password } = req.body
  // [API8] injection SQL : concaténation de l'entrée utilisateur
  const user = db.prepare(`SELECT * FROM users WHERE username = '${username}' AND password = '${password}'`).get() as User | undefined
  if (user) return res.json({ token: sign({ sub: user.id, username: user.username, role: user.role }) })
  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username)
  // [API2] messages différents : énumération des comptes
  res.status(401).json({ error: exists ? 'Mot de passe incorrect' : 'Utilisateur inconnu' })
})

// [API1] BOLA : aucun contrôle que l'utilisateur demande SA fiche
// [API3] exposition excessive : mot de passe et IBAN renvoyés
app.get('/api/users/:id', auth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(req.params.id))
  if (!user) return res.status(404).json({ error: 'introuvable' })
  res.json(user)
})

// [API3] mass assignment : role et iban modifiables par le client
app.patch('/api/users/:id', auth, (req, res) => {
  const current = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(req.params.id)) as User | undefined
  if (!current) return res.status(404).json({ error: 'introuvable' })
  const updated = Object.assign(current, req.body)
  db.prepare('UPDATE users SET username = ?, password = ?, email = ?, role = ?, iban = ? WHERE id = ?')
    .run(updated.username, updated.password, updated.email, updated.role, updated.iban, current.id)
  res.json(updated)
})

// [API1] BOLA sur les stations : la clé d'API d'un autre propriétaire est lisible
app.get('/api/stations/:id', auth, (req, res) => {
  const station = db.prepare('SELECT * FROM stations WHERE id = ?').get(Number(req.params.id))
  if (!station) return res.status(404).json({ error: 'introuvable' })
  res.json(station)
})

// [API5] BFLA : route d'administration protégée par l'authentification seulement, pas par le rôle
app.get('/api/admin/users', auth, (_req, res) => {
  res.json(db.prepare('SELECT * FROM users').all())
})

app.delete('/api/admin/users/:id', auth, (req, res) => {
  db.prepare('DELETE FROM users WHERE id = ?').run(Number(req.params.id))
  res.status(204).end()
})

// [API7] SSRF : le serveur télécharge n'importe quelle URL fournie
app.post('/api/users/me/avatar', auth, async (req, res, next) => {
  try {
    const upstream = await fetch(req.body.url)
    res.json({ status: upstream.status, preview: (await upstream.text()).slice(0, 500) })
  } catch (err) {
    next(err)
  }
})

// [API9] ancienne version oubliée, sans authentification
app.get('/v0/users', (_req, res) => {
  res.json(db.prepare('SELECT id, username, email, role FROM users').all())
})

// [API8] erreurs verbeuses : message et pile d'appels renvoyés au client
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  res.status(500).json({ error: err.message, stack: err.stack })
})

app.listen(PORT, () => {
  console.log(`API d'audit (VULNÉRABLE) sur http://localhost:${PORT} : usage formation uniquement`)
})
