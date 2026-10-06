import React, { useEffect, useMemo, useState } from 'react'
import { Building2, Clock3, CreditCard, Download, KeyRound, MessageSquareText, Plus, Save, Scissors, Smartphone, UserRound, UsersRound } from 'lucide-react'
import { InstallModal, NotificationsControl, useInstallState } from './appInstall'
import { supabase } from './supabase'
import { Field, Modal, money } from './ui'
import { accessUntil, cancelSubscription, fetchBillingStatus, onFreeTrial, freeTrialActive, planTerm, startCheckout, FREE_RECOVERY_LIMIT } from './billingClient'

const DAYS = [[1, 'Mon'], [2, 'Tue'], [3, 'Wed'], [4, 'Thu'], [5, 'Fri'], [6, 'Sat'], [7, 'Sun']]
const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'CHF', 'SEK', 'NOK', 'DKK', 'PLN', 'INR']
const FALLBACK_TZ = ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Phoenix', 'America/Anchorage', 'Pacific/Honolulu', 'America/Toronto', 'Europe/London', 'Europe/Dublin', 'Europe/Lisbon', 'Europe/Paris', 'Europe/Berlin', 'Europe/Madrid', 'Europe/Rome', 'Europe/Amsterdam', 'Europe/Brussels', 'Europe/Zurich', 'Europe/Stockholm', 'Europe/Warsaw', 'Europe/Athens', 'Europe/Helsinki', 'Asia/Kolkata', 'Australia/Sydney']
const timezones = (() => { try { return Intl.supportedValuesOf('timeZone') } catch { return FALLBACK_TZ } })()
const hhmm = t => (t || '').slice(0, 5)
const fmtDate = d => d ? new Date(d).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

export function SettingsPage({ practice, demo, notify, onChanged, onActivate }) {
  const [rev, setRev] = useState(0)
  const changedAll = () => { setRev(r => r + 1); onChanged() }
  if (demo) {
    return <div className="page"><div className="page-heading"><div><div className="eyebrow-dark">WORKSPACE</div><h1>Settings</h1><p>Settings are available in your live workspace. Sign up to configure hours, services and billing.</p></div></div></div>
  }
  if (!practice) return <div className="page"><div className="empty-inline"><div className="spinner"/></div></div>
  return <div className="page settings-page">
    <div className="page-heading"><div><div className="eyebrow-dark">WORKSPACE</div><h1>Settings</h1><p>Your account, business details, opening hours, services, staff, client messages and subscription.</p></div></div>
    <AccountSection notify={notify}/>
    <BusinessSection practice={practice} notify={notify} onChanged={onChanged}/>
    <HoursSection practice={practice} notify={notify} onChanged={onChanged}/>
    <ServicesSection practice={practice} notify={notify} onChanged={changedAll}/>
    <StaffSection practice={practice} notify={notify} onChanged={changedAll} rev={rev}/>
    <ClientMessageSection practice={practice} notify={notify} onChanged={onChanged}/>
    <AppSection practice={practice} notify={notify}/>
    <BillingSection notify={notify} onActivate={onActivate}/>
  </div>
}

function Section({ icon: Icon, title, text, children, action }) {
  return <section className="panel settings-section">
    <div className="settings-head">
      <div className="settings-icon"><Icon size={18}/></div>
      <div><h2>{title}</h2><p>{text}</p></div>
      {action}
    </div>
    <div className="settings-body">{children}</div>
  </section>
}

function BusinessSection({ practice, notify, onChanged }) {
  const [form, setForm] = useState({ name: practice.name || '', contact_email: practice.contact_email || '', timezone: practice.timezone || 'America/New_York', currency: practice.currency || 'USD' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const tzList = useMemo(() => timezones.includes(form.timezone) ? timezones : [form.timezone, ...timezones], [form.timezone])

  async function save(e) {
    e.preventDefault(); setBusy(true); setError('')
    const { error } = await supabase.from('practices').update({
      name: form.name.trim(), contact_email: form.contact_email.trim() || null, timezone: form.timezone, currency: form.currency
    }).eq('id', practice.id)
    setBusy(false)
    if (error) return setError(error.message)
    notify('Business details saved'); onChanged()
  }

  return <Section icon={Building2} title="Business details" text="Shown to your clients in emails. Timezone controls every appointment time and available slot.">
    <form className="settings-form" onSubmit={save}>
      <div className="form-grid">
        <Field label="Business name"><input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}/></Field>
        <Field label="Contact email"><input type="email" value={form.contact_email} onChange={e => setForm({ ...form, contact_email: e.target.value })} placeholder="hello@yourbusiness.com"/></Field>
      </div>
      <div className="form-grid">
        <Field label="Timezone"><select value={form.timezone} onChange={e => setForm({ ...form, timezone: e.target.value })}>{tzList.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}</select></Field>
        <Field label="Currency" hint="Used for service prices and revenue metrics."><select value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}>{CURRENCIES.map(c => <option key={c}>{c}</option>)}</select></Field>
      </div>
      {error && <div className="form-msg">{error}</div>}
      <div className="settings-actions"><button className="primary" disabled={busy}><Save size={16}/>{busy ? 'Saving…' : 'Save details'}</button></div>
    </form>
  </Section>
}

function HoursSection({ practice, notify, onChanged }) {
  const [form, setForm] = useState({
    open_time: hhmm(practice.open_time) || '09:00', close_time: hhmm(practice.close_time) || '18:00',
    working_days: practice.working_days || [1, 2, 3, 4, 5], slot_interval_minutes: practice.slot_interval_minutes || 30
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function toggleDay(d) {
    const days = form.working_days.includes(d) ? form.working_days.filter(x => x !== d) : [...form.working_days, d].sort()
    setForm({ ...form, working_days: days })
  }

  async function save(e) {
    e.preventDefault(); setError('')
    if (form.close_time <= form.open_time) return setError('Closing time must be after opening time.')
    if (!form.working_days.length) return setError('Choose at least one working day.')
    setBusy(true)
    const { error } = await supabase.from('practices').update({
      open_time: form.open_time, close_time: form.close_time, working_days: form.working_days, slot_interval_minutes: Number(form.slot_interval_minutes)
    }).eq('id', practice.id)
    setBusy(false)
    if (error) return setError(error.message)
    notify('Opening hours saved'); onChanged()
  }

  return <Section icon={Clock3} title="Opening hours" text={`Available times in New appointment and the client reschedule page follow these hours (${practice.timezone}).`}>
    <form className="settings-form" onSubmit={save}>
      <div className="day-toggle">{DAYS.map(([d, label]) => <button type="button" key={d} className={form.working_days.includes(d) ? 'on' : ''} onClick={() => toggleDay(d)}>{label}</button>)}</div>
      <div className="form-grid three">
        <Field label="Opens"><input type="time" value={form.open_time} onChange={e => setForm({ ...form, open_time: e.target.value })}/></Field>
        <Field label="Closes"><input type="time" value={form.close_time} onChange={e => setForm({ ...form, close_time: e.target.value })}/></Field>
        <Field label="Slot spacing"><select value={form.slot_interval_minutes} onChange={e => setForm({ ...form, slot_interval_minutes: e.target.value })}><option value={15}>Every 15 min</option><option value={30}>Every 30 min</option><option value={60}>Every hour</option></select></Field>
      </div>
      {error && <div className="form-msg">{error}</div>}
      <div className="settings-actions"><button className="primary" disabled={busy}><Save size={16}/>{busy ? 'Saving…' : 'Save hours'}</button></div>
    </form>
  </Section>
}

function ServicesSection({ practice, notify, onChanged }) {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')

  async function load() {
    const { data, error } = await supabase.from('services').select('id,name,duration_minutes,price_cents,active').eq('practice_id', practice.id).order('created_at')
    if (error) return setError(error.message)
    setRows((data || []).map(s => ({ ...s, price: String((s.price_cents || 0) / 100), dirty: false })))
  }
  useEffect(() => { load() }, [practice.id])

  function edit(i, patch) { setRows(rows.map((r, j) => j === i ? { ...r, ...patch, dirty: true } : r)) }
  function addRow() { setRows([...(rows || []), { id: null, name: '', duration_minutes: 60, price: '', active: true, dirty: true }]) }

  async function saveRow(i) {
    const r = rows[i]; setError('')
    if (!r.name.trim()) return setError('Service name is required.')
    const payload = { name: r.name.trim(), duration_minutes: Math.max(5, Number(r.duration_minutes) || 60), price_cents: Math.max(0, Math.round(Number(r.price || 0) * 100)), active: r.active }
    const { error } = r.id
      ? await supabase.from('services').update(payload).eq('id', r.id)
      : await supabase.from('services').insert({ ...payload, practice_id: practice.id })
    if (error) return setError(error.message)
    notify(r.id ? 'Service updated' : 'Service added'); load(); onChanged()
  }

  const activeCount = (rows || []).filter(r => r.active && r.id).length

  return <Section icon={Scissors} title="Services" text="Length sets how long each appointment blocks your calendar. Price feeds revenue at risk and recovered." action={<button type="button" className="ghost" onClick={addRow}><Plus size={16}/>Add service</button>}>
    {!rows ? <div className="spinner"/> : <div className="service-table">
      <div className="service-row head"><span>Service</span><span>Length (min)</span><span>Price ({practice.currency})</span><span>Active</span><span/></div>
      {rows.map((r, i) => <div className="service-row" key={r.id || 'new' + i}>
        <input aria-label="Service name" value={r.name} placeholder="e.g. Haircut" onChange={e => edit(i, { name: e.target.value })}/>
        <input aria-label="Length in minutes" type="number" min="5" step="5" value={r.duration_minutes} onChange={e => edit(i, { duration_minutes: e.target.value })}/>
        <input aria-label="Price" type="number" min="0" step="0.01" value={r.price} placeholder="0" onChange={e => edit(i, { price: e.target.value })}/>
        <label className="switch"><input type="checkbox" checked={r.active} disabled={r.active && activeCount <= 1 && r.id} onChange={e => edit(i, { active: e.target.checked })}/><i/></label>
        <button type="button" className="ghost small" disabled={!r.dirty} onClick={() => saveRow(i)}>{r.id ? 'Save' : 'Add'}</button>
      </div>)}
    </div>}
    {error && <div className="form-msg">{error}</div>}
  </Section>
}

function BillingSection({ notify, onActivate }) {
  const [billing, setBilling] = useState(null)
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)

  async function load() {
    try { setBilling(await fetchBillingStatus()) } catch (e) { setError(e.message) }
  }
  useEffect(() => { load() }, [])

  async function doCancel() {
    setBusy(true); setError('')
    try {
      const res = await cancelSubscription()
      setConfirming(false)
      notify(res.immediate ? 'Subscription cancelled. You will not be charged.' : 'Renewal cancelled.')
      await load()
    } catch (e) { setError(e.message) }
    setBusy(false)
  }

  async function restart() {
    setBusy(true); setError('')
    const res = await startCheckout()
    setBusy(false)
    if (res.ok) { notify('Subscription restarted'); window.location.reload() }
    else if (!res.dismissed) setError(res.message)
  }

  if (!billing) return <Section icon={CreditCard} title="Subscription" text="Your SlotRecover plan and billing.">{error ? <div className="form-msg">{error}</div> : <div className="spinner"/>}</Section>

  const plan = Array.isArray(billing.billing_plans) ? billing.billing_plans[0] : billing.billing_plans
  const price = plan ? money(plan.amount_paise / 100, plan.currency) + ' / ' + planTerm(plan) : '—'
  const fresh = onFreeTrial(billing)
  const freeActive = freeTrialActive(billing)
  const inTrial = !fresh && new Date(billing.trial_ends_at).getTime() > Date.now()
  const until = accessUntil(billing)
  const cancelled = billing.status === 'cancelled'
  const endingSoon = billing.cancel_at_period_end && !cancelled
  const canCancel = !fresh && billing.razorpay_subscription_id && ['authenticated', 'active', 'authorization_pending', 'past_due'].includes(billing.status) && !endingSoon

  const statusLabel = fresh ? (freeActive ? 'Free trial' : 'Trial ended') : cancelled ? 'Cancelled' : endingSoon ? 'Cancels at period end' : inTrial ? 'Free trial' : billing.status === 'active' ? 'Active' : billing.status === 'past_due' ? 'Payment failed' : billing.status.replace(/_/g, ' ')
  const statusTone = cancelled || billing.status === 'past_due' || (fresh && !freeActive) ? 'danger' : endingSoon || fresh ? 'wait' : 'ok'

  return <Section icon={CreditCard} title="Subscription" text="Payments are made to Shiva Dhali Services, through Razorpay.">
    <div className="billing-grid">
      <div><span>Plan</span><strong>{plan?.name || '—'}</strong><small>{price}</small></div>
      <div><span>Status</span><strong><span className={'status ' + statusTone}>{statusLabel}</span></strong></div>
      {fresh
        ? <div><span>{freeActive ? 'Free trial ends' : 'Free trial ended'}</span><strong>{fmtDate(billing.trial_ends_at)}</strong><small>No card needed · {FREE_RECOVERY_LIMIT} recovered slot included</small></div>
        : cancelled || endingSoon
        ? <div><span>Access until</span><strong>{fmtDate(until)}</strong><small>No further charges</small></div>
        : inTrial
          ? <div><span>Trial ends</span><strong>{fmtDate(billing.trial_ends_at)}</strong><small>First charge on this date</small></div>
          : <div><span>Next billing date</span><strong>{fmtDate(billing.current_period_end)}</strong></div>}
    </div>
    {error && <div className="form-msg">{error}</div>}
    <div className="settings-actions split">
      <a className="text-link" href="/refunds" target="_blank" rel="noreferrer">Refund & Cancellation Policy</a>
      {canCancel && <button type="button" className="danger-btn" onClick={() => setConfirming(true)}>Cancel subscription</button>}
      {fresh && onActivate && <button type="button" className="primary" onClick={onActivate}>Upgrade</button>}
      {cancelled && <button type="button" className="primary" disabled={busy} onClick={restart}>{busy ? 'Opening Razorpay…' : 'Restart subscription'}</button>}
      {endingSoon && <span className="settings-note">Changed your mind? Email billing support to keep your plan.</span>}
    </div>

    {confirming && <Modal title="Cancel your subscription?" subtitle={inTrial ? 'You are still in your free trial.' : 'Your plan will stop renewing.'} onClose={() => !busy && setConfirming(false)}>
      <div className="modal-form">
        <p className="confirm-text">{inTrial
          ? <>You won't be charged. You keep access until your trial ends on <strong>{fmtDate(billing.trial_ends_at)}</strong>, and then your workspace is locked until you restart.</>
          : <>You won't be charged again. You keep access until <strong>{fmtDate(billing.current_period_end)}</strong>. Your data is kept for 30 days after that so you can export it or restart.</>}</p>
        <div className="modal-actions">
          <button type="button" className="ghost" disabled={busy} onClick={() => setConfirming(false)}>Keep subscription</button>
          <button type="button" className="danger-btn solid" disabled={busy} onClick={doCancel}>{busy ? 'Cancelling…' : 'Yes, cancel'}</button>
        </div>
      </div>
    </Modal>}
  </Section>
}

function StaffSection({ practice, notify, onChanged, rev }) {
  const [rows, setRows] = useState(null)
  const [services, setServices] = useState([])
  const [error, setError] = useState('')

  async function load() {
    const [{ data: st, error: e1 }, { data: sv, error: e2 }, { data: links, error: e3 }] = await Promise.all([
      supabase.from('staff').select('id,name,active').eq('practice_id', practice.id).order('created_at'),
      supabase.from('services').select('id,name,active').eq('practice_id', practice.id).order('created_at'),
      supabase.from('staff_services').select('staff_id,service_id').eq('practice_id', practice.id)
    ])
    if (e1 || e2 || e3) return setError((e1 || e2 || e3).message)
    setServices((sv || []).filter(x => x.active))
    setRows((st || []).map(r => ({ ...r, services: (links || []).filter(l => l.staff_id === r.id).map(l => l.service_id), dirty: false })))
  }
  useEffect(() => { load() }, [practice.id, rev])

  function edit(i, patch) { setRows(rows.map((r, j) => j === i ? { ...r, ...patch, dirty: true } : r)) }
  function toggleService(i, id) {
    const cur = rows[i].services
    edit(i, { services: cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id] })
  }
  function addRow() { setRows([...(rows || []), { id: null, name: '', active: true, services: services.map(s => s.id), dirty: true }]) }

  async function saveRow(i) {
    const r = rows[i]; setError('')
    if (!r.name.trim()) return setError('Staff name is required.')
    if (!r.services.length) return setError('Choose at least one service for ' + r.name.trim() + '.')
    let staffId = r.id
    if (staffId) {
      const { error } = await supabase.from('staff').update({ name: r.name.trim(), active: r.active }).eq('id', staffId)
      if (error) return setError(error.message)
    } else {
      const { data, error } = await supabase.from('staff').insert({ practice_id: practice.id, name: r.name.trim(), active: r.active }).select('id').single()
      if (error) return setError(error.message)
      staffId = data.id
    }
    const { data: existing, error: e2 } = await supabase.from('staff_services').select('service_id').eq('staff_id', staffId)
    if (e2) return setError(e2.message)
    const have = (existing || []).map(x => x.service_id)
    const toAdd = r.services.filter(id => !have.includes(id))
    const toRemove = have.filter(id => !r.services.includes(id) && services.some(s => s.id === id))
    if (toAdd.length) {
      const { error } = await supabase.from('staff_services').insert(toAdd.map(id => ({ staff_id: staffId, service_id: id, practice_id: practice.id })))
      if (error) return setError(error.message)
    }
    if (toRemove.length) {
      const { error } = await supabase.from('staff_services').delete().eq('staff_id', staffId).in('service_id', toRemove)
      if (error) return setError(error.message)
    }
    notify(r.id ? 'Staff member updated' : 'Staff member added'); load(); onChanged()
  }

  const uncovered = rows ? services.filter(sv => !rows.some(r => r.id && r.active && r.services.includes(sv.id))) : []
  const activeCount = (rows || []).filter(r => r.id && r.active).length

  return <Section icon={UsersRound} title="Staff" text="Who works here and which services each person offers. A time is bookable when at least one of them is free." action={<button type="button" className="ghost" onClick={addRow}><Plus size={16}/>Add staff</button>}>
    {!rows ? <div className="spinner"/> : <div className="staff-list">
      {rows.map((r, i) => <div className={'staff-card' + (r.active ? '' : ' inactive')} key={r.id || 'new' + i}>
        <div className="staff-top">
          <div className="tiny-avatar">{(r.name || '?').split(' ').map(x => x[0]).slice(0, 2).join('').toUpperCase()}</div>
          <input aria-label="Staff name" value={r.name} placeholder="e.g. Priya" onChange={e => edit(i, { name: e.target.value })}/>
          <label className="switch" title={r.active ? 'Active' : 'Inactive'}><input type="checkbox" checked={r.active} disabled={r.active && r.id && activeCount <= 1} onChange={e => edit(i, { active: e.target.checked })}/><i/></label>
          <button type="button" className="ghost small" disabled={!r.dirty} onClick={() => saveRow(i)}>{r.id ? 'Save' : 'Add'}</button>
        </div>
        <div className="chip-row">
          {services.map(sv => <button type="button" key={sv.id} className={'chip' + (r.services.includes(sv.id) ? ' on' : '')} onClick={() => toggleService(i, sv.id)}>{sv.name}</button>)}
        </div>
      </div>)}
    </div>}
    {uncovered.length > 0 && <div className="settings-warning">No active staff member offers {uncovered.map(s => s.name).join(', ')}, so {uncovered.length === 1 ? 'it has' : 'they have'} no available times.</div>}
    {error && <div className="form-msg">{error}</div>}
  </Section>
}

function ClientMessageSection({ practice, notify, onChanged }) {
  const [note, setNote] = useState(practice.client_note || '')
  const [cc, setCc] = useState(practice.default_country_code || '+1')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function save(e) {
    e.preventDefault(); setError('')
    const code = cc.trim().startsWith('+') ? cc.trim() : '+' + cc.trim()
    if (!/^\+[0-9]{1,4}$/.test(code)) return setError('Country code should look like +1, +44 or +91.')
    setBusy(true)
    const { error } = await supabase.from('practices').update({ client_note: note.trim() || null, default_country_code: code }).eq('id', practice.id)
    setBusy(false)
    if (error) return setError(error.message)
    setCc(code); notify('Client message settings saved'); onChanged()
  }

  return <Section icon={MessageSquareText} title="Messages to clients" text="Added to confirmation emails and WhatsApp reminders.">
    <form className="settings-form" onSubmit={save}>
      <Field label="Note for clients (optional)" hint={note.length + ' / 600 · e.g. "Cancellations made less than 6 hours before your appointment are not refunded."'}>
        <textarea rows={3} maxLength={600} value={note} onChange={e => setNote(e.target.value)} placeholder="Your cancellation policy, parking info, what to bring…"/>
      </Field>
      <div className="form-grid">
        <Field label="Default country code" hint="Used for WhatsApp when a client's phone number has no country code."><input value={cc} onChange={e => setCc(e.target.value)} placeholder="+1"/></Field>
      </div>
      {error && <div className="form-msg">{error}</div>}
      <div className="settings-actions"><button className="primary" disabled={busy}><Save size={16}/>{busy ? 'Saving…' : 'Save messages'}</button></div>
    </form>
  </Section>
}

function AppSection({ practice, notify }) {
  const st = useInstallState()
  const [showInstall, setShowInstall] = useState(false)
  return <Section icon={Smartphone} title="App & notifications" text="Install SlotRecover on your phone and get notified when confirmations go out.">
    <div className="notif-row">
      <div>
        <strong>{st.standalone ? 'Installed on this device' : 'Install on this device'}</strong>
        <span>{st.standalone ? 'You are using the installed app.' : st.isIOS ? 'On iPhone: Safari → Share → Add to Home Screen.' : 'Opens full screen from your home screen, like a native app.'}</span>
      </div>
      {!st.standalone && <div className="notif-actions"><button type="button" className="ghost small" onClick={() => setShowInstall(true)}><Download size={14}/>{st.canPrompt ? 'Install app' : 'How to install'}</button></div>}
    </div>
    <NotificationsControl practiceId={practice.id} notify={notify}/>
    {showInstall && <InstallModal onClose={() => setShowInstall(false)}/>}
  </Section>
}

function AccountSection({ notify }) {
  const [user, setUser] = useState(null)
  const [name, setName] = useState('')
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' })
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [pwError, setPwError] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
      setName(data.user?.user_metadata?.full_name || '')
    })
  }, [])

  async function saveName(e) {
    e.preventDefault(); setError(''); setBusy('name')
    const { error } = await supabase.auth.updateUser({ data: { full_name: name.trim() } })
    setBusy('')
    if (error) return setError(error.message)
    notify('Profile saved')
  }

  async function changePassword(e) {
    e.preventDefault(); setPwError('')
    if (pw.next.length < 8) return setPwError('Use at least 8 characters for the new password.')
    if (pw.next !== pw.confirm) return setPwError("The new passwords don't match.")
    if (pw.next === pw.current) return setPwError('Choose a password different from your current one.')
    setBusy('pw')
    // Confirm the current password before changing it.
    const { error: authError } = await supabase.auth.signInWithPassword({ email: user.email, password: pw.current })
    if (authError) { setBusy(''); return setPwError('Your current password is incorrect.') }
    const { error } = await supabase.auth.updateUser({ password: pw.next })
    setBusy('')
    if (error) return setPwError(error.message)
    setPw({ current: '', next: '', confirm: '' })
    notify('Password changed')
  }

  if (!user) return <Section icon={UserRound} title="Your account" text="Your profile and sign-in details."><div className="spinner"/></Section>

  return <Section icon={UserRound} title="Your account" text="Your profile and sign-in details.">
    <form className="settings-form" onSubmit={saveName}>
      <div className="form-grid">
        <Field label="Your name"><input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Shiva" autoComplete="name"/></Field>
        <Field label="Email" hint="Used to sign in. Contact support to change it."><input value={user.email || ''} disabled/></Field>
      </div>
      {error && <div className="form-msg">{error}</div>}
      <div className="settings-actions"><button className="primary" disabled={busy === 'name'}><Save size={16}/>{busy === 'name' ? 'Saving…' : 'Save profile'}</button></div>
    </form>
    <form className="settings-form account-pw" onSubmit={changePassword}>
      <div className="account-pw-head"><KeyRound size={15}/><strong>Change password</strong></div>
      <div className="form-grid three">
        <Field label="Current password"><input type="password" autoComplete="current-password" required value={pw.current} onChange={e => setPw({ ...pw, current: e.target.value })}/></Field>
        <Field label="New password"><input type="password" autoComplete="new-password" required minLength={8} value={pw.next} onChange={e => setPw({ ...pw, next: e.target.value })} placeholder="At least 8 characters"/></Field>
        <Field label="Confirm new password"><input type="password" autoComplete="new-password" required minLength={8} value={pw.confirm} onChange={e => setPw({ ...pw, confirm: e.target.value })}/></Field>
      </div>
      {pwError && <div className="form-msg">{pwError}</div>}
      <div className="settings-actions"><button className="primary" disabled={busy === 'pw'}><KeyRound size={16}/>{busy === 'pw' ? 'Updating…' : 'Update password'}</button></div>
    </form>
  </Section>
}
