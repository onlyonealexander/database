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

function coerceValue(column, rawValue) {
  if (rawValue === undefined || rawValue === null || rawValue === '') return null
  if (column.type === 'number') return Number(rawValue)
  if (column.type === 'array') return Array.isArray(rawValue) ? rawValue : String(rawValue).split(',').map((part) => part.trim()).filter(Boolean)
  return rawValue
}

const genericModules = [
  { path: 'suppliers', table: 'suppliers', label: 'supplier', required: ['supplierId', 'name'], noCreatedBy: true, columns: [
    { key: 'supplierId', db: 'supplier_id' }, { key: 'name', db: 'name' }, { key: 'contactPerson', db: 'contact_person' }, { key: 'phone', db: 'phone' }, { key: 'email', db: 'email' }, { key: 'address', db: 'address' }, { key: 'productsSupplied', db: 'products_supplied', type: 'array' }, { key: 'notes', db: 'notes' },
  ] },
  { path: 'animal-health', table: 'animal_health_records', label: 'health record', required: ['recordId', 'livestockId'], columns: [
    { key: 'recordId', db: 'record_id' }, { key: 'livestockId', db: 'livestock_id' }, { key: 'recordDate', db: 'record_date' }, { key: 'condition', db: 'condition' }, { key: 'symptoms', db: 'symptoms' }, { key: 'diagnosis', db: 'diagnosis' }, { key: 'treatment', db: 'treatment' }, { key: 'medication', db: 'medication' }, { key: 'dosage', db: 'dosage' }, { key: 'route', db: 'route' }, { key: 'cost', db: 'cost', type: 'number' }, { key: 'treatmentStartDate', db: 'treatment_start_date' }, { key: 'treatmentEndDate', db: 'treatment_end_date' }, { key: 'nextCheckupDate', db: 'next_checkup_date' }, { key: 'outcome', db: 'outcome' }, { key: 'notes', db: 'notes' },
  ] },
  { path: 'vaccinations', table: 'vaccinations', label: 'vaccination record', required: ['vaccinationId', 'livestockId', 'vaccine', 'quantityTreated'], columns: [
    { key: 'vaccinationId', db: 'vaccination_id' }, { key: 'livestockId', db: 'livestock_id' }, { key: 'vaccine', db: 'vaccine' }, { key: 'vaccinationDate', db: 'vaccination_date' }, { key: 'birdAge', db: 'bird_age' }, { key: 'quantityTreated', db: 'quantity_treated', type: 'number' }, { key: 'dosage', db: 'dosage' }, { key: 'purpose', db: 'purpose' }, { key: 'nextVaccinationDate', db: 'next_vaccination_date' }, { key: 'cost', db: 'cost', type: 'number' }, { key: 'notes', db: 'notes' },
  ] },
  { path: 'feeds', table: 'feeds', label: 'feed record', required: ['feedId', 'feedName', 'animalType', 'unit'], columns: [
    { key: 'feedId', db: 'feed_id' }, { key: 'feedName', db: 'feed_name' }, { key: 'animalType', db: 'animal_type' }, { key: 'quantity', db: 'quantity', type: 'number' }, { key: 'unit', db: 'unit' }, { key: 'supplierId', db: 'supplier_id' }, { key: 'purchaseDate', db: 'purchase_date' }, { key: 'expiryDate', db: 'expiry_date' }, { key: 'cost', db: 'cost', type: 'number' }, { key: 'currentStock', db: 'current_stock', type: 'number' }, { key: 'minimumStock', db: 'minimum_stock', type: 'number' }, { key: 'notes', db: 'notes' },
  ] },
  { path: 'plots', table: 'crop_plots', label: 'plot', required: ['plotId', 'plotName', 'cropName'], columns: [
    { key: 'plotId', db: 'plot_id' }, { key: 'plotName', db: 'plot_name' }, { key: 'cropName', db: 'crop_name' }, { key: 'variety', db: 'variety' }, { key: 'area', db: 'area', type: 'number' }, { key: 'areaUnit', db: 'area_unit' }, { key: 'plantingDate', db: 'planting_date' }, { key: 'numberOfPlants', db: 'number_of_plants', type: 'number' }, { key: 'currentStage', db: 'current_stage' }, { key: 'expectedHarvestDate', db: 'expected_harvest_date' }, { key: 'status', db: 'status' }, { key: 'notes', db: 'notes' },
  ] },
  { path: 'spray-records', table: 'crop_applications', label: 'spray record', required: ['applicationId', 'plotId', 'productName', 'productType'], columns: [
    { key: 'applicationId', db: 'application_id' }, { key: 'plotId', db: 'plot_id' }, { key: 'applicationDate', db: 'application_date' }, { key: 'growthStage', db: 'growth_stage' }, { key: 'productName', db: 'product_name' }, { key: 'productType', db: 'product_type' }, { key: 'activeIngredient', db: 'active_ingredient' }, { key: 'dosage', db: 'dosage' }, { key: 'waterVolume', db: 'water_volume' }, { key: 'areaTreated', db: 'area_treated', type: 'number' }, { key: 'purpose', db: 'purpose' }, { key: 'cost', db: 'cost', type: 'number' }, { key: 'nextApplicationDate', db: 'next_application_date' }, { key: 'notes', db: 'notes' },
  ] },
  { path: 'harvests', table: 'harvests', label: 'harvest record', required: ['harvestId', 'plotId', 'crop', 'quantity', 'unit'], columns: [
    { key: 'harvestId', db: 'harvest_id' }, { key: 'plotId', db: 'plot_id' }, { key: 'crop', db: 'crop' }, { key: 'harvestDate', db: 'harvest_date' }, { key: 'quantity', db: 'quantity', type: 'number' }, { key: 'unit', db: 'unit' }, { key: 'grade', db: 'grade' }, { key: 'quality', db: 'quality' }, { key: 'storageLocation', db: 'storage_location' }, { key: 'sellingPrice', db: 'selling_price', type: 'number' }, { key: 'notes', db: 'notes' },
  ] },
  { path: 'sales', table: 'sales', label: 'sale', required: ['saleId', 'product', 'quantity', 'unit', 'unitPrice'], columns: [
    { key: 'saleId', db: 'sale_id' }, { key: 'saleDate', db: 'sale_date' }, { key: 'product', db: 'product' }, { key: 'cropLivestock', db: 'crop_livestock' }, { key: 'quantity', db: 'quantity', type: 'number' }, { key: 'unit', db: 'unit' }, { key: 'unitPrice', db: 'unit_price', type: 'number' }, { key: 'customer', db: 'customer' }, { key: 'paymentStatus', db: 'payment_status' }, { key: 'paymentMethod', db: 'payment_method' }, { key: 'notes', db: 'notes' },
  ] },
  { path: 'expenses', table: 'expenses', label: 'expense', required: ['expenseId', 'category', 'description', 'unitCost'], columns: [
    { key: 'expenseId', db: 'expense_id' }, { key: 'expenseDate', db: 'expense_date' }, { key: 'category', db: 'category' }, { key: 'description', db: 'description' }, { key: 'department', db: 'department' }, { key: 'quantity', db: 'quantity', type: 'number' }, { key: 'unitCost', db: 'unit_cost', type: 'number' }, { key: 'supplierId', db: 'supplier_id' }, { key: 'paymentStatus', db: 'payment_status' }, { key: 'paymentMethod', db: 'payment_method' }, { key: 'notes', db: 'notes' },
  ] },
  { path: 'inventory', table: 'inventory', label: 'inventory item', required: ['itemId', 'itemName', 'category', 'unit'], columns: [
    { key: 'itemId', db: 'item_id' }, { key: 'itemName', db: 'item_name' }, { key: 'category', db: 'category' }, { key: 'quantity', db: 'quantity', type: 'number' }, { key: 'unit', db: 'unit' }, { key: 'minimumStock', db: 'minimum_stock', type: 'number' }, { key: 'purchaseDate', db: 'purchase_date' }, { key: 'expiryDate', db: 'expiry_date' }, { key: 'supplierId', db: 'supplier_id' }, { key: 'cost', db: 'cost', type: 'number' }, { key: 'storageLocation', db: 'storage_location' }, { key: 'notes', db: 'notes' },
  ] },
  { path: 'staff', table: 'staff', label: 'staff member', required: ['staffId', 'name', 'role'], noCreatedBy: true, columns: [
    { key: 'staffId', db: 'staff_id' }, { key: 'name', db: 'name' }, { key: 'phone', db: 'phone' }, { key: 'email', db: 'email' }, { key: 'role', db: 'role' }, { key: 'department', db: 'department' }, { key: 'dateJoined', db: 'date_joined' }, { key: 'status', db: 'status' }, { key: 'notes', db: 'notes' },
  ] },
]

function mountGenericCrud({ path, table, label, required, columns, noCreatedBy }) {
  app.get(`/api/${path}`, requireDatabase, requireAuth, async (_request, response) => {
    try {
      const rows = await sql.query(`select * from ${table} order by created_at desc`, [])
      return response.json({ records: rows })
    } catch (error) { return response.status(500).json({ error: error.message }) }
  })

  app.post(`/api/${path}`, requireDatabase, requireAuth, async (request, response) => {
    for (const key of required) { if (request.body[key] === undefined || request.body[key] === null || request.body[key] === '') return response.status(400).json({ error: `${key} is required.` }) }
    const provided = columns.map((c) => ({ db: c.db, value: coerceValue(c, request.body[c.key]) })).filter((entry) => entry.value !== null)
    const dbCols = provided.map((entry) => entry.db)
    const values = provided.map((entry) => entry.value)
    const insertCols = noCreatedBy ? dbCols : [...dbCols, 'created_by']
    const insertValues = noCreatedBy ? values : [...values, request.user.sub]
    const placeholders = insertCols.map((_c, i) => `$${i + 1}`)
    const text = `insert into ${table} (${insertCols.join(', ')}) values (${placeholders.join(', ')}) returning *`
    try {
      const [row] = await sql.query(text, insertValues)
      await logActivity(request.user.sub, 'create', table, row.id, `Added a new ${label} (${row[dbCols[0]] ?? row.id})`)
      return response.status(201).json({ record: row })
    } catch (error) { return response.status(error.code === '23505' ? 409 : 400).json({ error: error.code === '23505' ? `A ${label} with that ID already exists.` : error.message }) }
  })

  app.put(`/api/${path}/:id`, requireDatabase, requireAuth, async (request, response) => {
    for (const key of required) { if (request.body[key] === undefined || request.body[key] === null || request.body[key] === '') return response.status(400).json({ error: `${key} is required.` }) }
    const provided = columns.map((c) => ({ db: c.db, value: coerceValue(c, request.body[c.key]) })).filter((entry) => entry.value !== null)
    const dbCols = provided.map((entry) => entry.db)
    const values = provided.map((entry) => entry.value)
    const setClause = dbCols.map((c, i) => `${c} = $${i + 1}`).join(', ')
    const text = `update ${table} set ${setClause} where id = $${dbCols.length + 1} returning *`
    try {
      const [row] = await sql.query(text, [...values, request.params.id])
      if (!row) return response.status(404).json({ error: 'Record not found.' })
      await logActivity(request.user.sub, 'update', table, row.id, `Updated a ${label} (${row[dbCols[0]] ?? row.id})`)
      return response.json({ record: row })
    } catch (error) { return response.status(error.code === '23505' ? 409 : 400).json({ error: error.code === '23505' ? `A ${label} with that ID already exists.` : error.message }) }
  })

  app.delete(`/api/${path}/:id`, requireDatabase, requireAuth, async (request, response) => {
    try {
      const [row] = await sql.query(`delete from ${table} where id = $1 returning id`, [request.params.id])
      if (!row) return response.status(404).json({ error: 'Record not found.' })
      await logActivity(request.user.sub, 'delete', table, row.id, `Removed a ${label}`)
      return response.status(204).end()
    } catch (error) { return response.status(500).json({ error: error.message }) }
  })
}

genericModules.forEach(mountGenericCrud)

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
