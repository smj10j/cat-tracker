import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { D1Database } from '@cloudflare/workers-types'
import cats from './routes/cats'
import measurements from './routes/measurements'
import importRoute from './routes/import'

type Env = { DB: D1Database }

const app = new Hono<{ Bindings: Env }>()

app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type'],
}))

app.route('/api/cats', cats)
app.route('/api', measurements)
app.route('/api', importRoute)

app.get('/api/health', (c) => c.json({ status: 'ok' }))

export default app
