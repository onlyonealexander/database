import { useEffect, useMemo, useState } from 'react'
import { Activity, ArrowUpRight, Bell, Boxes, ChevronDown, CircleHelp, ClipboardList, DollarSign, Droplets, LayoutDashboard, LogOut, Menu, Package, PawPrint, Search, Sprout, Syringe, Tractor, UserRound, Users, Wheat, X } from 'lucide-react'
import { apiDashboard, apiMe, apiSignOut, hasDatabaseConfig } from './lib/api'
import { fetchDashboard, fetchLivestock, createLivestock, updateLivestock, removeLivestock } from './services/farmService'
import { getSessionProfile, signIn, signOut } from './services/authService'
import './App.css'

const navGroups = [
  { label: 'Workspace', items: [{ label: 'Dashboard', icon: LayoutDashboard }, { label: 'Livestock', icon: PawPrint }, { label: 'Animal Health', icon: Syringe }, { label: 'Vaccinations', icon: ClipboardList }, { label: 'Feed', icon: Wheat }] },
  { label: 'Production', items: [{ label: 'Crops', icon: Sprout }, { label: 'Plots', icon: Tractor }, { label: 'Spray Records', icon: Droplets }, { label: 'Harvest', icon: Sprout }, { label: 'Sales', icon: DollarSign }] },
  { label: 'Operations', items: [{ label: 'Expenses', icon: DollarSign }, { label: 'Inventory', icon: Boxes }, { label: 'Suppliers', icon: Users }, { label: 'Staff', icon: UserRound }, { label: 'Reports', icon: Activity }] },
]

const money = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 })

function ConfigScreen() {
  return <div className="setup-screen"><div className="setup-card"><div className="brand-mark large">K</div><p className="eyebrow">Kaasfield Farms</p><h1>Connect your farm database<span>.</span></h1><p>Set <code>DATABASE_URL</code> for the API server in <code>.env.local</code>, then restart the dev server. The SQL schema is ready in <code>supabase/schema.sql</code>.</p><div className="setup-steps"><span>1</span><div>Run the schema in Neon SQL Editor</div><span>2</span><div>Copy <code>.env.example</code> to <code>.env.local</code></div><span>3</span><div>Create your first user in Neon Auth</div></div></div></div>
}

function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (event) => { event.preventDefault(); setBusy(true); setError(''); try { await onLogin(email, password) } catch (loginError) { setError(loginError.message) } finally { setBusy(false) } }
  const forgot = () => setError('Password reset is managed by your farm administrator for this Neon setup.')
  return <div className="login-screen"><div className="login-aside"><div className="brand light"><div className="brand-mark">K</div><div><strong>Kaasfield</strong><span>Farms - Management system</span></div></div><div className="login-quote"><p>"Good records grow good farms."</p><span>One clear view of your animals, crops, and operations.</span></div></div><div className="login-panel"><div className="login-form"><p className="eyebrow">Welcome back</p><h1>Sign in to your farm<span>.</span></h1><p className="subheading">Use your staff account to continue.</p><form onSubmit={submit}><label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="you@example.com" /></label><label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required placeholder="Enter your password" /></label>{error && <div className="form-message">{error}</div>}<button className="primary-button" disabled={busy} type="submit">{busy ? 'Signing in...' : 'Sign in'} <ArrowUpRight size={16} /></button><button className="forgot" type="button" onClick={forgot}>Forgot password?</button></form></div></div></div>
}

function Metric({ label, value, detail, icon: Icon, tone }) { return <article className={`metric-card ${tone}`}><div className="metric-top"><span className="metric-icon"><Icon size={18} /></span><span className="live-label">Live</span></div><strong>{value}</strong><h3>{label}</h3><p>{detail}</p></article> }

function Dashboard({ data, onNavigate }) {
  const totals = useMemo(() => { const livestock = data.livestock.reduce((sum, row) => sum + row.quantity, 0); const byType = (type) => data.livestock.filter((row) => row.animal_type === type).reduce((sum, row) => sum + row.quantity, 0); const expenses = data.expenses.reduce((sum, row) => sum + Number(row.total_cost || 0), 0); const sales = data.sales.reduce((sum, row) => sum + Number(row.total_amount || 0), 0); const lowStock = data.inventory.filter((row) => Number(row.quantity) <= Number(row.minimum_stock)).length; const harvest = data.harvests.reduce((sum, row) => sum + Number(row.quantity || 0), 0); return { livestock, goats: byType('Goat'), cows: byType('Cow'), chickens: byType('Chicken'), ducks: byType('Duck'), rams: byType('Ram'), expenses, sales, lowStock, harvest } }, [data])
  return <><section className="welcome-row"><div><p className="eyebrow">Farm overview - {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</p><h1>Good morning<span>.</span></h1><p className="subheading">Your live operations summary from Kaasfield Farms.</p></div><button className="date-button" type="button">This month <ChevronDown size={13} /></button></section><section className="metrics-grid"><Metric label="Total livestock" value={totals.livestock} detail={`${totals.cows} cattle - ${totals.goats} goats`} icon={PawPrint} tone="green" /><Metric label="Total chickens" value={totals.chickens} detail={`${totals.rams} rams - ${totals.ducks} ducks`} icon={Wheat} tone="gold" /><Metric label="Active crop plots" value={data.plots.length} detail={`${data.plots.reduce((sum, plot) => sum + (plot.number_of_plants || 0), 0)} plants recorded`} icon={Sprout} tone="blue" /><Metric label="Expenses this month" value={money.format(totals.expenses)} detail={`${data.expenses.length} recorded expenses`} icon={DollarSign} tone="plum" /></section><section className="dashboard-grid"><article className="panel activity-panel"><div className="panel-heading"><div><p className="eyebrow">Audit trail</p><h2>Recent activity</h2></div><button className="text-button" type="button" onClick={() => onNavigate('Reports')}>View reports <ArrowUpRight size={14} /></button></div><div className="activity-list">{data.activities.length ? data.activities.map((activity) => <div className="activity-row" key={activity.id}><div className="activity-icon health"><Activity size={14} /></div><div className="activity-copy"><strong>{activity.description}</strong><span>{activity.entity_type} - {activity.action}</span></div><time>{new Date(activity.created_at).toLocaleDateString('en-GB')}</time></div>) : <div className="empty-state compact">No activity has been logged yet.</div>}</div></article><article className="panel alerts-panel"><div className="panel-heading"><div><p className="eyebrow">Needs attention</p><h2>Farm alerts</h2></div><span className="count-badge">{data.vaccinations.length + data.inventory.filter((item) => Number(item.quantity) <= Number(item.minimum_stock)).length}</span></div><div className="task-list"><div className="task"><span className="task-dot red" /><div><strong>Vaccinations due soon</strong><span>{data.vaccinations.length} scheduled records</span></div><button type="button" onClick={() => onNavigate('Vaccinations')}>Review</button></div><div className="task"><span className="task-dot amber" /><div><strong>Low stock items</strong><span>{totals.lowStock} items below minimum</span></div><button type="button" onClick={() => onNavigate('Inventory')}>Review</button></div><div className="task"><span className="task-dot green" /><div><strong>Sales this month</strong><span>{money.format(totals.sales)} recorded</span></div><button type="button" onClick={() => onNavigate('Sales')}>View</button></div></div></article></section><section className="lower-grid"><article className="panel spend-panel"><div className="panel-heading"><div><p className="eyebrow">Financial overview</p><h2>Monthly totals</h2></div></div><div className="spend-total"><strong>{money.format(totals.expenses)}</strong><span>Expenses <small>this month</small></span></div><div className="summary-row"><span><i className="legend-red" /> Sales <b>{money.format(totals.sales)}</b></span><span><i className="legend-green" /> Harvest <b>{totals.harvest}</b></span></div></article><article className="panel stock-panel"><div className="panel-heading"><div><p className="eyebrow">Inventory health</p><h2>Stock summary</h2></div><button className="text-button" type="button" onClick={() => onNavigate('Inventory')}>Manage <ArrowUpRight size={14} /></button></div><div className="stock-stat"><div className="donut"><span>{data.inventory.length ? Math.round((data.inventory.length - totals.lowStock) / data.inventory.length * 100) : 0}<small>%</small></span></div><div><strong>{totals.lowStock ? 'Attention needed' : 'Good stock health'}</strong><p>{totals.lowStock} of {data.inventory.length} items below minimum</p></div></div></article></section></>
}

const animalTypes = ['Cow', 'Goat', 'Ram', 'Chicken', 'Duck', 'Pig', 'Other']
const sexOptions = ['Male', 'Female', 'Mixed', 'Unknown']
const livestockStatuses = ['active', 'sold', 'deceased', 'sick', 'quarantined', 'archived']
const emptyLivestockForm = { animalId: '', animalType: 'Cow', breed: '', sex: 'Unknown', quantity: 1, dateAcquired: '', source: '', purchaseCost: 0, currentStatus: 'active', location: '', weight: '', dateOfBirth: '', notes: '' }

function livestockStatusClass(status) {
  if (status === 'sold') return 'status scheduled'
  if (status === 'sick' || status === 'quarantined') return 'status low-stock'
  if (status === 'deceased' || status === 'archived') return 'status reorder'
  return 'status'
}

function toEditForm(row) {
  return { id: row.id, animalId: row.animal_id, animalType: row.animal_type, breed: row.breed || '', sex: row.sex || 'Unknown', quantity: row.quantity, dateAcquired: row.date_acquired ? row.date_acquired.slice(0, 10) : '', source: row.source || '', purchaseCost: row.purchase_cost, currentStatus: row.current_status, location: row.location || '', weight: row.weight ?? '', dateOfBirth: row.date_of_birth ? row.date_of_birth.slice(0, 10) : '', notes: row.notes || '' }
}

function LivestockForm({ initial, onCancel, onSave }) {
  const [form, setForm] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }))
  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try { await onSave({ ...form, quantity: Number(form.quantity), purchaseCost: Number(form.purchaseCost || 0), weight: form.weight === '' ? null : Number(form.weight) }) }
    catch (saveError) { setError(saveError.message) }
    finally { setBusy(false) }
  }
  return <div className="modal-overlay"><div className="modal-card">
    <h2>{initial.id ? 'Edit animal record' : 'Add animal record'}<span>.</span></h2>
    <p className="subheading">Saved directly to the livestock table in Neon.</p>
    <form className="modal-form" onSubmit={submit}>
      <label>Animal ID<input value={form.animalId} onChange={set('animalId')} required placeholder="GOAT-G002" /></label>
      <label>Type<select value={form.animalType} onChange={set('animalType')}>{animalTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
      <label>Breed<input value={form.breed} onChange={set('breed')} /></label>
      <label>Sex<select value={form.sex} onChange={set('sex')}>{sexOptions.map((sex) => <option key={sex} value={sex}>{sex}</option>)}</select></label>
      <label>Quantity<input type="number" min="1" value={form.quantity} onChange={set('quantity')} required /></label>
      <label>Status<select value={form.currentStatus} onChange={set('currentStatus')}>{livestockStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
      <label>Date acquired<input type="date" value={form.dateAcquired || ''} onChange={set('dateAcquired')} /></label>
      <label>Date of birth<input type="date" value={form.dateOfBirth || ''} onChange={set('dateOfBirth')} /></label>
      <label>Source<input value={form.source} onChange={set('source')} /></label>
      <label>Location<input value={form.location} onChange={set('location')} /></label>
      <label>Purchase cost (NGN)<input type="number" min="0" step="0.01" value={form.purchaseCost} onChange={set('purchaseCost')} /></label>
      <label>Weight (kg)<input type="number" min="0" step="0.1" value={form.weight} onChange={set('weight')} /></label>
      <label className="full">Notes<textarea value={form.notes} onChange={set('notes')} rows={3} /></label>
      {error && <div className="form-message full">{error}</div>}
      <div className="modal-actions">
        <button type="button" className="ghost-button" onClick={onCancel}>Cancel</button>
        <button type="submit" className="primary-button" disabled={busy}>{busy ? 'Saving...' : 'Save record'}</button>
      </div>
    </form>
  </div></div>
}

function Livestock() {
  const [records, setRecords] = useState(null)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null)
  useEffect(() => { fetchLivestock().then((result) => setRecords(result.livestock)).catch((loadError) => setError(loadError.message)) }, [])
  const filtered = useMemo(() => {
    if (!records) return []
    const term = search.trim().toLowerCase()
    if (!term) return records
    return records.filter((row) => [row.animal_id, row.animal_type, row.breed, row.location].some((value) => (value || '').toLowerCase().includes(term)))
  }, [records, search])
  const save = async (form) => {
    const result = form.id ? await updateLivestock(form.id, form) : await createLivestock(form)
    setRecords((prev) => form.id ? prev.map((row) => row.id === form.id ? result.livestock : row) : [result.livestock, ...prev])
    setEditing(null)
  }
  const remove = async (row) => {
    if (!window.confirm(`Remove ${row.animal_id}? This cannot be undone.`)) return
    try { await removeLivestock(row.id); setRecords((prev) => prev.filter((record) => record.id !== row.id)) }
    catch (removeError) { setError(removeError.message) }
  }
  return <section className="table-view">
    <div className="table-header">
      <div><p className="eyebrow">Kaasfield Farms database</p><h1>Livestock<span>.</span></h1><p className="subheading">Animals recorded across every pen, pasture, and shelter.</p></div>
      <button className="add-button" type="button" onClick={() => setEditing({ ...emptyLivestockForm })}><span>+</span> Add animal record</button>
    </div>
    {error && <div className="form-message" style={{ margin: '0 0 18px' }}>{error}</div>}
    <div className="table-toolbar">
      <span>{filtered.length} of {records?.length || 0} records</span>
      <input className="filter-button" placeholder="Filter by ID, type, breed, location" value={search} onChange={(event) => setSearch(event.target.value)} style={{ width: 240 }} />
    </div>
    <div className="data-table-wrap">
      {!records ? <div className="empty-state">Loading livestock records...</div> : !filtered.length ? <div className="empty-state">No livestock records match.</div> :
        <table>
          <thead><tr><th>Animal ID</th><th>Type</th><th>Breed</th><th>Sex</th><th>Qty</th><th>Status</th><th>Location</th><th>Acquired</th><th></th></tr></thead>
          <tbody>{filtered.map((row) => <tr key={row.id}>
            <td>{row.animal_id}</td><td>{row.animal_type}</td><td>{row.breed || '-'}</td><td>{row.sex || '-'}</td><td>{row.quantity}</td>
            <td><span className={livestockStatusClass(row.current_status)}>{row.current_status}</span></td>
            <td>{row.location || '-'}</td><td>{row.date_acquired ? new Date(row.date_acquired).toLocaleDateString('en-GB') : '-'}</td>
            <td><div className="row-actions"><button type="button" className="edit" onClick={() => setEditing(toEditForm(row))}>Edit</button><button type="button" className="delete" onClick={() => remove(row)}>Delete</button></div></td>
          </tr>)}</tbody>
        </table>}
    </div>
    {editing && <LivestockForm initial={editing} onCancel={() => setEditing(null)} onSave={save} />}
  </section>
}

function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [data, setData] = useState(null)
  const [activeView, setActiveView] = useState('Dashboard')
  const [error, setError] = useState('')
  const [mobileOpen, setMobileOpen] = useState(false)
  useEffect(() => { if (!hasDatabaseConfig) return; const token = localStorage.getItem('kaasfield_session'); if (!token) return; Promise.all([getSessionProfile(), fetchDashboard()]).then(([profileResult, dashboard]) => { setSession({ user: profileResult.profile }); setProfile(profileResult.profile); setData(dashboard) }).catch(() => apiSignOut()) }, [])
  useEffect(() => { if (!session?.user || data) return; Promise.all([apiMe(), apiDashboard()]).then(([profileResult, dashboard]) => { setProfile(profileResult.profile); setData(dashboard) }).catch((loadError) => setError(loadError.message)) }, [session, data])
  if (!hasDatabaseConfig) return <ConfigScreen />
  if (!session) return <LoginScreen onLogin={async (email, password) => { const result = await signIn(email, password); setSession({ user: result.profile }); setProfile(result.profile); setData(await fetchDashboard()) }} />
  const navigate = (view) => { setActiveView(view); setMobileOpen(false) }
  const activeItem = navGroups.flatMap((group) => group.items).find((item) => item.label === activeView)
  return <div className="app-shell"><aside className={mobileOpen ? 'sidebar mobile-open' : 'sidebar'}><div className="brand"><div className="brand-mark">K</div><div><strong>Kaasfield</strong><span>Farms - DBMS</span></div><button className="mobile-close" onClick={() => setMobileOpen(false)} type="button"><X size={17} /></button></div><div className="farm-switcher"><span className="status-dot" /> Main farm <ChevronDown size={14} /></div><nav className="nav-list" aria-label="Main navigation">{navGroups.map((group) => <div key={group.label}><p className="nav-label">{group.label}</p>{group.items.map(({ label, icon: Icon }) => <button key={label} className={activeView === label ? 'nav-item active' : 'nav-item'} onClick={() => navigate(label)} type="button"><Icon size={16} />{label}</button>)}</div>)}</nav><div className="sidebar-footer"><button className="nav-item" type="button"><CircleHelp size={16} /> Help center</button><button className="user-card" onClick={signOut} type="button"><span className="avatar">{(profile?.full_name || 'A').slice(0, 2).toUpperCase()}</span><span><strong>{profile?.full_name || session.user.email}</strong><small>{profile?.role || 'staff'}</small></span><LogOut size={14} /></button></div></aside><main className="main-content"><header className="topbar"><button className="mobile-menu" onClick={() => setMobileOpen(true)} type="button"><Menu size={19} /></button><div className="breadcrumb"><span>Workspace</span><b>/</b><strong>{activeView}</strong></div><div className="top-actions"><label className="search"><Search size={15} /><input placeholder="Search records..." /></label><button className="icon-button" title="Notifications" type="button"><Bell size={18} /><i /></button><button className="add-button" type="button"><span>+</span> Add record</button></div></header>{error && <div className="error-banner">{error}</div>}{data && activeView === 'Dashboard' && <Dashboard data={data} onNavigate={navigate} />}{data && activeView === 'Livestock' && <Livestock />}{data && activeView !== 'Dashboard' && activeView !== 'Livestock' && <section className="module-placeholder"><p className="eyebrow">Kaasfield Farms database</p><h1>{activeItem?.label}<span>.</span></h1><p className="subheading">This module is connected to Neon. Use the schema and service layer as the source of truth for records, role permissions, and audit history.</p><div className="panel empty-state"><Package size={24} /><strong>{activeItem?.label} workspace ready</strong><span>Add the module form and table here without changing the database contract.</span></div></section>}</main></div>
}

export default App





