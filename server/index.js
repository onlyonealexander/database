import dotenv from 'dotenv'
import express from 'express'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { neon } from '@neondatabase/serverless'

dotenv.config({ path: '.env.local' })
dotenv.config()

const app = express()
const port = Number(process.env.PORT || 3001)
const jwtSecret = process.env.JWT_SECRET || 'change-this-development-secret'
const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null

app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }))
app.use(express.json())

function requireDatabase(_request, response, next) {
  if (!sql) return response.status(503).json({ error: 'DATABASE_URL is not configured on the API server.' })
  return next()
}

function signSession(profile) {
  return jwt.sign({ sub: profile.id, role: profile.role, email: profile.email }, jwtSecret, { expiresIn: '8h' })
}

function requireAuth(request, response, next) {
  const token = request.headers.authorization?.replace('Bearer ', '')
  if (!token) return response.status(401).json({ error: 'You must sign in first.' })
  try { request.user = jwt.verify(token, jwtSecret); return next() } catch { return response.status(401).json({ error: 'Your session has expired.' }) }
}

app.get('/api/health', requireDatabase, async (_request, response) => { try { await sql`select 1`; response.json({ ok: true, database: 'neon' }) } catch (error) { response.status(500).json({ error: error.message }) } })

app.post('/api/auth/signup', requireDatabase, async (request, response) => {
  const { email, password, fullName } = request.body
  if (!email || !password || !fullName || password.length < 8) return response.status(400).json({ error: 'Full name, email, and a password of at least 8 characters are required.' })
  const passwordHash = await bcrypt.hash(password, 12)
  try {
    const [profile] = await sql`insert into profiles (id, full_name, email, password_hash, role) values (gen_random_uuid(), ${fullName}, ${email.toLowerCase()}, ${passwordHash}, 'staff') returning id, full_name, email, role`
    return response.status(201).json({ token: signSession(profile), profile })
  } catch (error) { return response.status(409).json({ error: error.code === '23505' ? 'An account with that email already exists.' : error.message }) }
})

app.post('/api/auth/login', requireDatabase, async (request, response) => {
  const { email, password } = request.body
  const [profile] = await sql`select id, full_name, email, role, password_hash from profiles where email = ${email?.toLowerCase()}`
  if (!profile || !(await bcrypt.compare(password || '', profile.password_hash))) return response.status(401).json({ error: 'Invalid email or password.' })
  const { password_hash: _passwordHash, ...safeProfile } = profile
  return response.json({ token: signSession(safeProfile), profile: safeProfile })
})

app.get('/api/auth/me', requireDatabase, requireAuth, async (request, response) => { const [profile] = await sql`select id, full_name, email, role, department, phone from profiles where id = ${request.user.sub}`; if (!profile) return response.status(404).json({ error: 'Profile not found.' }); return response.json({ profile }) })

function logActivity(actorId, action, entityType, entityId, description) {
  return sql`insert into activity_logs (actor_id, action, entity_type, entity_id, description) values (${actorId}, ${action}, ${entityType}, ${entityId}, ${description})`
}

app.get('/api/livestock', requireDatabase, requireAuth, async (_request, response) => {
  try {
    const rows = await sql`select * from livestock order by created_at desc`
    return response.json({ livestock: rows })
  } catch (error) { return response.status(500).json({ error: error.message }) }
})

app.post('/api/livestock', requireDatabase, requireAuth, async (request, response) => {
  const { animalId, animalType, breed, sex, quantity, dateAcquired, source, purchaseCost, currentStatus, location, weight, dateOfBirth, notes } = request.body
  if (!animalId || !animalType || !quantity) return response.status(400).json({ error: 'Animal ID, type, and quantity are required.' })
  try {
    const [row] = await sql`insert into livestock (animal_id, animal_type, breed, sex, quantity, date_acquired, source, purchase_cost, current_status, location, weight, date_of_birth, notes, created_by) values (${animalId}, ${animalType}, ${breed || null}, ${sex || null}, ${quantity}, ${dateAcquired || null}, ${source || null}, ${purchaseCost || 0}, ${currentStatus || 'active'}, ${location || null}, ${weight || null}, ${dateOfBirth || null}, ${notes || null}, ${request.user.sub}) returning *`
    await logActivity(request.user.sub, 'create', 'livestock', row.id, `Added ${row.quantity} ${row.animal_type.toLowerCase()}(s) - ${row.animal_id}`)
    return response.status(201).json({ livestock: row })
  } catch (error) { return response.status(error.code === '23505' ? 409 : 400).json({ error: error.code === '23505' ? 'An animal record with that ID already exists.' : error.message }) }
})

app.put('/api/livestock/:id', requireDatabase, requireAuth, async (request, response) => {
  const { animalId, animalType, breed, sex, quantity, dateAcquired, source, purchaseCost, currentStatus, location, weight, dateOfBirth, notes } = request.body
  if (!animalId || !animalType || !quantity) return response.status(400).json({ error: 'Animal ID, type, and quantity are required.' })
  try {
    const [row] = await sql`update livestock set animal_id = ${animalId}, animal_type = ${animalType}, breed = ${breed || null}, sex = ${sex || null}, quantity = ${quantity}, date_acquired = ${dateAcquired || null}, source = ${source || null}, purchase_cost = ${purchaseCost || 0}, current_status = ${currentStatus || 'active'}, location = ${location || null}, weight = ${weight || null}, date_of_birth = ${dateOfBirth || null}, notes = ${notes || null} where id = ${request.params.id} returning *`
    if (!row) return response.status(404).json({ error: 'Record not found.' })
    await logActivity(request.user.sub, 'update', 'livestock', row.id, `Updated livestock record ${row.animal_id}`)
    return response.json({ livestock: row })
  } catch (error) { return response.status(error.code === '23505' ? 409 : 400).json({ error: error.code === '23505' ? 'An animal record with that ID already exists.' : error.message }) }
})

app.delete('/api/livestock/:id', requireDatabase, requireAuth, async (request, response) => {
  try {
    const [row] = await sql`delete from livestock where id = ${request.params.id} returning id, animal_id`
    if (!row) return response.status(404).json({ error: 'Record not found.' })
    await logActivity(request.user.sub, 'delete', 'livestock', row.id, `Removed livestock record ${row.animal_id}`)
    return response.status(204).end()
  } catch (error) { return response.status(500).json({ error: error.message }) }
})

app.get('/api/dashboard', requireDatabase, requireAuth, async (_request, response) => {
  try {
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)
    const [livestock, plots, inventory, expenses, harvests, sales, vaccinations, activities] = await Promise.all([
      sql`select animal_type, quantity from livestock where current_status = 'active'`,
      sql`select id, plot_id, plot_name, crop_name, number_of_plants, current_stage, status from crop_plots where status = 'active'`,
      sql`select item_id, item_name, category, quantity, unit, minimum_stock, expiry_date from inventory`,
      sql`select expense_date, category, department, total_cost from expenses where expense_date >= ${monthStart}`,
      sql`select harvest_date, crop, quantity, unit from harvests where harvest_date >= ${monthStart}`,
      sql`select sale_date, total_amount, payment_status from sales where sale_date >= ${monthStart}`,
      sql`select vaccination_id, vaccine, next_vaccination_date, livestock.animal_id from vaccinations join livestock on livestock.id = vaccinations.livestock_id where next_vaccination_date >= current_date order by next_vaccination_date limit 5`,
      sql`select id, action, entity_type, description, created_at from activity_logs order by created_at desc limit 8`,
    ])
    return response.json({ livestock, plots, inventory, expenses, harvests, sales, vaccinations, activities })
  } catch (error) { return response.status(500).json({ error: error.message }) }
})

export default app

if (!process.env.VERCEL) {
  app.listen(port, () => console.log(`Kaasfield API listening on http://localhost:${port}`))
}
