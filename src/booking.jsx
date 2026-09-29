import React, { useEffect, useState } from 'react'
import { CalendarClock, ChevronLeft, ChevronRight, ListPlus } from 'lucide-react'
import { supabase } from './supabase'
import { Field, Modal, money } from './ui'

const todayIn = tz => {
  try { return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date()) } catch { return new Date().toISOString().slice(0, 10) }
}
const shiftDate = (iso, days) => {
  const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10)
}
const longDate = iso => new Date(iso + 'T12:00:00Z').toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' })

export function AppointmentModal({ practiceId, practice, services, onClose, onSaved }) {
  const tz = practice?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
  const timeLabel = iso => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', timeZone: tz })
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '' })
  const [serviceId, setServiceId] = useState(services[0]?.id || '')
  const [date, setDate] = useState(todayIn(tz))
  const [avail, setAvail] = useState(null)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(null)
  const [taken, setTaken] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { if (!serviceId && services.length) setServiceId(services[0].id) }, [services, serviceId])

  async function loadSlots() {
    if (!practiceId || !serviceId || !date) return
    setLoading(true); setSelected(null); setTaken(null)
    const { data, error } = await supabase.rpc('get_practice_availability', { p_practice_id: practiceId, p_service_id: serviceId, p_date: date })
    setLoading(false)
    if (error) { setAvail(null); return setError(error.message) }
    setError(''); setAvail(data)
  }
  useEffect(() => { loadSlots() }, [practiceId, serviceId, date])

  const slots = avail?.slots || []
  const freeCount = slots.filter(s => s.available).length
  const service = services.find(s => s.id === serviceId)
  const minDate = todayIn(tz)

  function needName() {
    if (!form.first_name.trim()) { setError('Enter the client\'s first name first.'); return true }
    return false
  }

  async function book(e) {
    e.preventDefault(); setError('')
    if (needName()) return
    if (!selected) return setError('Choose an available time.')
    setBusy(true)
    const { error } = await supabase.rpc('create_appointment', {
      p_practice_id: practiceId, p_service_id: serviceId,
      p_first_name: form.first_name, p_last_name: form.last_name, p_email: form.email, p_phone: form.phone,
      p_start_at: selected.start_at
    })
    setBusy(false)
    if (error) {
      if (error.hint === 'slot_unavailable') {
        const slot = selected
        await loadSlots()
        setTaken(slot)
        return setError('That time was just booked by someone else.')
      }
      return setError(error.message)
    }
    onSaved('appointment')
  }

  async function addToWaitlist(windowStart, windowEnd) {
    setError('')
    if (needName()) return
    setBusy(true)
    const { error } = await supabase.rpc('add_waitlist_entry', {
      p_practice_id: practiceId, p_service_id: serviceId,
      p_first_name: form.first_name, p_last_name: form.last_name, p_email: form.email, p_phone: form.phone,
      p_window_start: windowStart, p_window_end: windowEnd, p_min_notice_minutes: 60
    })
    setBusy(false)
    if (error) return setError(error.message)
    onSaved('waitlist')
  }

  return <Modal wide title="New appointment" subtitle="Pick a free time. If the client's preferred time is taken, add them to the waitlist instead." onClose={onClose}>
    <form className="modal-form" onSubmit={book}>
      <div className="form-grid">
        <Field label="First name"><input required value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })}/></Field>
        <Field label="Last name"><input value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })}/></Field>
      </div>
      <div className="form-grid">
        <Field label="Email" hint="Needed for confirmation and waitlist offer emails."><input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}/></Field>
        <Field label="Phone"><input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}/></Field>
      </div>
      <div className="form-grid">
        <Field label="Service"><select required value={serviceId} onChange={e => setServiceId(e.target.value)}>{services.map(s => <option value={s.id} key={s.id}>{s.name} · {s.duration_minutes} min · {money(s.price_cents / 100)}</option>)}</select></Field>
        <Field label="Date">
          <div className="date-nav">
            <button type="button" className="icon-btn" aria-label="Previous day" disabled={date <= minDate} onClick={() => setDate(shiftDate(date, -1))}><ChevronLeft size={16}/></button>
            <input type="date" min={minDate} value={date} onChange={e => e.target.value && setDate(e.target.value)}/>
            <button type="button" className="icon-btn" aria-label="Next day" onClick={() => setDate(shiftDate(date, 1))}><ChevronRight size={16}/></button>
          </div>
        </Field>
      </div>

      <div className="slot-panel">
        <div className="slot-panel-head">
          <strong>{longDate(date)}</strong>
          <span>{loading ? 'Loading…' : avail?.closed ? 'Closed' : `${freeCount} free · times in ${tz.replace(/_/g, ' ')}`}</span>
        </div>
        {loading ? <div className="slot-empty"><div className="spinner"/></div>
          : avail?.closed ? <div className="slot-empty">You're closed on this day. Change working days in Settings → Opening hours, or pick another date.</div>
          : !slots.length ? <div className="slot-empty">No times left on this day. Try the next day.</div>
          : <div className="slot-grid staff">
            {slots.map(s => <button type="button" key={s.start_at}
              className={'slot-btn' + (s.available ? '' : ' taken') + (selected?.start_at === s.start_at ? ' selected' : '') + (taken?.start_at === s.start_at ? ' flagged' : '')}
              onClick={() => { setError(''); if (s.available) { setSelected(s); setTaken(null) } else { setTaken(s); setSelected(null) } }}>
              {timeLabel(s.start_at)}{!s.available && <small>Booked</small>}
            </button>)}
          </div>}

        {taken && <div className="waitlist-offer">
          <CalendarClock size={18}/>
          <div>
            <strong>{timeLabel(taken.start_at)} is already booked.</strong>
            <span>Add {form.first_name.trim() || 'this client'} to the waitlist. If this slot opens up, SlotRecover offers it to them automatically.</span>
            <div className="waitlist-actions">
              <button type="button" className="primary small" disabled={busy} onClick={() => addToWaitlist(taken.start_at, taken.end_at)}><ListPlus size={15}/>Waitlist for {timeLabel(taken.start_at)}</button>
              <button type="button" className="ghost small" disabled={busy || !avail?.day_start} onClick={() => addToWaitlist(avail.day_start, avail.day_end)}>Any time this day</button>
              <button type="button" className="text-btn" onClick={() => setTaken(null)}>Choose another time</button>
            </div>
          </div>
        </div>}

        {!loading && !taken && !avail?.closed && slots.length > 0 && freeCount === 0 && <div className="waitlist-offer">
          <CalendarClock size={18}/>
          <div>
            <strong>This day is fully booked.</strong>
            <span>Add the client to the waitlist for this day, or try another date.</span>
            <div className="waitlist-actions">
              <button type="button" className="primary small" disabled={busy} onClick={() => addToWaitlist(avail.day_start, avail.day_end)}><ListPlus size={15}/>Waitlist for this day</button>
            </div>
          </div>
        </div>}
      </div>

      {error && <div className="form-msg">{error}</div>}
      <div className="modal-actions">
        <button type="button" className="ghost" onClick={onClose}>Cancel</button>
        <button className="primary" disabled={busy || !selected || !services.length}>{busy ? 'Saving…' : selected ? `Book ${timeLabel(selected.start_at)}${service ? ' · ' + service.name : ''}` : 'Choose a time'}</button>
      </div>
    </form>
  </Modal>
}
