import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createApp } from '../src/app.ts'
import { call, serve } from './helpers.ts'

const base = await serve(createApp())

describe('GET /health', () => {
  it('répond 200', async () => {
    const res = await call(`${base}/health`)
    assert.equal(res.status, 200)
    assert.deepEqual(res.body, { status: 'ok' })
  })

  it('répond en RFC 9457 sur une route inconnue', async () => {
    const res = await call(`${base}/inconnue`)
    assert.equal(res.status, 404)
    assert.match(res.headers.get('content-type') ?? '', /application\/problem\+json/)
    assert.equal(res.body.instance, '/inconnue')
  })
})
