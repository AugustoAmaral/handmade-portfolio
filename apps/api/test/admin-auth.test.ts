import express from 'express'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from '../src/app'
import { errorHandler } from '../src/errors'
import { adminGuard } from '../src/middleware/auth'

describe('POST /api/admin/login', () => {
  it('returns a JWT for valid credentials', async () => {
    const res = await request(createApp())
      .post('/api/admin/login')
      .send({ email: 'admin@example.com', password: 'admin123' })
    expect(res.status).toBe(200)
    const payload = jwt.verify(res.body.token, 'test-jwt-secret') as jwt.JwtPayload
    expect(payload.sub).toBe('admin')
  })
  it('401s on wrong password and wrong email', async () => {
    for (const body of [
      { email: 'admin@example.com', password: 'nope' },
      { email: 'other@example.com', password: 'admin123' },
    ]) {
      const res = await request(createApp()).post('/api/admin/login').send(body)
      expect(res.status).toBe(401)
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS')
    }
  })
})

describe('adminGuard', () => {
  const guarded = () => {
    const app = express()
    app.get('/secret', adminGuard, (_req, res) => {
      res.json({ ok: true })
    })
    app.use(errorHandler)
    return app
  }
  it('rejects a missing token', async () => {
    const res = await request(guarded()).get('/secret')
    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('UNAUTHORIZED')
  })
  it('rejects a garbage token', async () => {
    const res = await request(guarded()).get('/secret').set('Authorization', 'Bearer nonsense')
    expect(res.status).toBe(401)
  })
  it('rejects an expired token', async () => {
    const token = jwt.sign({ sub: 'admin' }, 'test-jwt-secret', { expiresIn: '-1s' })
    const res = await request(guarded()).get('/secret').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(401)
  })
  it('accepts a valid token', async () => {
    const token = jwt.sign({ sub: 'admin' }, 'test-jwt-secret', { expiresIn: '12h' })
    const res = await request(guarded()).get('/secret').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
  })
})
