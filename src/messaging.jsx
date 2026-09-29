import React, { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CalendarClock, CheckCircle2, Clock3, Mail, MessageCircleMore, RefreshCw, Search, Send, WandSparkles } from 'lucide-react'
import { supabase } from './supabase'

const apptSelect = 'id,start_at,status,public_token,rescheduled_to_id,services(name,price_cents),clients(first_name,last_name,phone,email),staff(name)'

function clientName(c) { return [c?.first_name, c?.last_name].filter(Boolean).join(' ') || 'Client' }

function replyState(appt) {
  if (!appt) return ['Unknown', 'wait']
  if (appt.status === 'confirmed') return ['Confirmed', 'ok']
  if (appt.status === 'cancelled') return appt.rescheduled_to_id ? ['Rescheduled', 'recover'] : ['Cancelled', 'danger']
  if (appt.status === 'completed') return ['Completed', 'ok']
  if (appt.status === 'no_show') return ['No-show', 'danger']
  return new Date(appt.start_at) > new Date() ? ['Awaiting reply', 'wait'] : ['No reply', 'danger']
}

function buildItems(jobs, offers, events) {
  const items = []
  for (const e of events || []) {
    const a = e.appointments
    if (!a) continue
    const [label, tone] = replyState(a)
    items.push({ id: 'e' + e.id, kind: 'whatsapp', appt: a, client: clientName(a.clients), service: a.services?.name || 'Appointment', staff: a.staff?.name,
      title: 'WhatsApp reminder opened', at: e.created_at, label, tone, awaiting: label === 'Awaiting reply' })
  }
  for (const j of jobs || []) {
    const a = j.appointments
    if (!a) continue
    const base = { id: 'j' + j.id, appt: a, client: clientName(a.clients), service: a.services?.name || 'Appointment', staff: a.staff?.name }
    if (j.channel === 'whatsapp') {
      const [label, tone] = replyState(a)
      items.push({ ...base, kind: 'whatsapp', title: 'WhatsApp reminder opened', at: j.sent_at || j.created_at, label, tone, awaiting: label === 'Awaiting reply' })
      continue
    }
    if (j.status === 'sent') {
      const [label, tone] = replyState(a)
      items.push({ ...base, kind: 'confirmation', title: 'Confirmation email sent', at: j.sent_at, label, tone, awaiting: label === 'Awaiting reply' })
    } else if (j.status === 'failed') {
      items.push({ ...base, kind: 'confirmation', title: 'Confirmation email failed', at: j.sent_at || j.scheduled_for, label: 'Failed', tone: 'danger', detail: j.last_error, failed: true })
    } else if (['scheduled', 'queued', 'processing'].includes(j.status)) {
      const noEmail = !a.clients?.email
      items.push({ ...base, kind: 'confirmation', title: noEmail ? 'No email address, confirmation can\'t be sent' : 'Confirmation email scheduled', at: j.scheduled_for, label: noEmail ? 'No email' : 'Scheduled', tone: noEmail ? 'danger' : 'recover', scheduled: !noEmail, failed: noEmail, future: !noEmail })
    } else if (j.status === 'cancelled') {
      items.push({ ...base, kind: 'confirmation', title: 'Confirmation not needed', at: a.confirmed_at || j.scheduled_for, label: a.status === 'cancelled' ? (a.rescheduled_to_id ? 'Rescheduled' : 'Appointment cancelled') : 'Already confirmed', tone: 'muted' })
    }
  }
  for (const o of offers || []) {
    const a = o.appointments
    const base = { id: 'o' + o.id, kind: 'offer', client: clientName(o.clients), service: a?.services?.name || 'Appointment', staff: a?.staff?.name, appt: null, slot: a?.start_at }
    if (o.notification_error) items.push({ ...base, title: 'Waitlist offer failed to send', at: o.offered_at, label: 'Failed', tone: 'danger', detail: o.notification_error, failed: true })
    else if (o.status === 'accepted') items.push({ ...base, title: 'Waitlist offer accepted', at: o.responded_at || o.offered_at, label: 'Slot recovered', tone: 'recover' })
    else if (o.status === 'declined') items.push({ ...base, title: 'Waitlist offer declined', at: o.responded_at || o.offered_at, label: 'Declined', tone: 'muted' })
    else if (o.status === 'expired') items.push({ ...base, title: 'Waitlist offer expired', at: o.responded_at || o.expires_at, label: 'Expired', tone: 'muted' })
    else if (o.status === 'offered') items.push({ ...base, title: o.notified_at ? 'Waitlist offer sent' : 'Waitlist offer sending', at: o.notified_at || o.offered_at, label: 'Waiting', tone: 'wait', expires: o.expires_at })
  }
  return items.sort((x, y) => new Date(y.at || 0) - new Date(x.at || 0))
}

const FILTERS = [
  ['all', 'All'], ['awaiting', 'Awaiting reply'], ['scheduled', 'Scheduled'],
  ['offer', 'Waitlist offers'], ['whatsapp', 'WhatsApp'], ['failed', 'Needs attention']
]

export function MessagingPage({ practice, demo, onRemind, refreshKey }) {
  const [jobs, setJobs] = useState(null)
  const [offers, setOffers] = useState([])
  const [events, setEvents] = useState([])
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const tz = practice?.timezone

  async function load() {
    if (!practice) return
    setBusy(true); setError('')
    const [{ data: j, error: e1 }, { data: o, error: e2 }, { data: ev, error: e3 }] = await Promise.all([
      supabase.from('reminder_jobs')
        .select('id,channel,template_key,status,scheduled_for,sent_at,last_error,created_at,appointments(' + apptSelect + ',confirmed_at,cancelled_at)')
        .eq('practice_id', practice.id).order('created_at', { ascending: false }).limit(300),
      supabase.from('recovery_offers')
        .select('id,status,offered_at,expires_at,responded_at,notified_at,notification_error,clients(first_name,last_name),appointments(start_at,services(name),staff(name))')
        .eq('practice_id', practice.id).order('offered_at', { ascending: false }).limit(100),
      supabase.from('message_events')
        .select('id,channel,kind,created_at,appointments(' + apptSelect + ')')
        .eq('practice_id', practice.id).order('created_at', { ascending: false }).limit(200)
    ])
    setBusy(false)
    if (e1 || e2 || e3) return setError((e1 || e2 || e3).message)
    // Email confirmations only; WhatsApp reminders come from message_events.
    setJobs((j || []).filter(x => x.channel === 'email')); setOffers(o || []); setEvents(ev || [])
  }
  useEffect(() => { if (!demo) load() }, [practice?.id, demo, refreshKey])

  const items = useMemo(() => jobs ? buildItems(jobs, offers, events) : [], [jobs, offers, events])
  const q = query.trim().toLowerCase()
  const shown = items.filter(i => !q || (i.client + ' ' + i.service + ' ' + (i.staff || '')).toLowerCase().includes(q)).filter(i => filter === 'all' ? true
    : filter === 'awaiting' ? i.awaiting
    : filter === 'scheduled' ? i.scheduled
    : filter === 'failed' ? i.failed
    : i.kind === filter)

  const weekAgo = Date.now() - 7 * 864e5
  const sentWeek = items.filter(i => !i.future && !i.failed && i.tone !== 'muted' && i.at && new Date(i.at).getTime() > weekAgo && ['Confirmation email sent', 'WhatsApp reminder opened', 'Waitlist offer sent', 'Waitlist offer accepted', 'Waitlist offer declined', 'Waitlist offer expired'].includes(i.title)).length
  const sentConfirmations = items.filter(i => i.title === 'Confirmation email sent')
  const confirmedCount = sentConfirmations.filter(i => i.label === 'Confirmed').length
  const replyRate = sentConfirmations.length ? Math.round(sentConfirmations.filter(i => i.label !== 'Awaiting reply' && i.label !== 'No reply').length / sentConfirmations.length * 100) : 0
  const awaiting = items.filter(i => i.awaiting).length
  const failed = items.filter(i => i.failed).length

  const fmt = iso => iso ? new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: tz }) : ''
  const fmtTime = iso => iso ? new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', timeZone: tz }) : ''

  if (demo) {
    return <div className="page"><div className="page-heading"><div><div className="eyebrow-dark">COMMUNICATION</div><h1>Messaging</h1><p>Every confirmation, reminder and waitlist offer, with the client's reply. Available in your live workspace.</p></div></div></div>
  }

  return <div className="page">
    <div className="page-heading">
      <div><div className="eyebrow-dark">COMMUNICATION</div><h1>Messaging</h1><p>Every confirmation, WhatsApp reminder and waitlist offer, and how clients responded.</p></div>
      <div className="heading-actions"><button className="ghost" onClick={load} disabled={busy}><RefreshCw size={16} className={busy ? 'spin' : ''}/>Refresh</button></div>
    </div>

    <div className="metric-grid">
      <Tile icon={Send} tone="blue" label="Sent · last 7 days" value={sentWeek} hint="Emails, WhatsApp and offers"/>
      <Tile icon={Clock3} tone="amber" label="Awaiting reply" value={awaiting} hint="Upcoming, not yet confirmed"/>
      <Tile icon={CheckCircle2} tone="green" label="Reply rate" value={replyRate + '%'} hint={confirmedCount + ' confirmed by email or WhatsApp'}/>
      <Tile icon={AlertTriangle} tone="violet" label="Needs attention" value={failed} hint="Failed or missing email address"/>
    </div>

    <section className="panel">
      <div className="msg-toolbar">
        <div className="filters">
          {FILTERS.map(([k, label]) => <button key={k} className={'filter' + (filter === k ? ' active' : '')} onClick={() => setFilter(k)}>{label}{k === 'awaiting' && awaiting ? ' · ' + awaiting : k === 'failed' && failed ? ' · ' + failed : ''}</button>)}
        </div>
        <label className="msg-search"><Search size={14}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search client, service, staff"/></label>
      </div>
      {error && <div className="form-msg" style={{ padding: '0 16px 12px' }}>{error}</div>}
      {!jobs ? <div className="empty-inline"><div className="spinner"/></div>
        : !shown.length ? <div className="empty-inline"><MessageCircleMore size={22}/><strong>{items.length ? 'Nothing here' : 'No messages yet'}</strong><span>{items.length ? 'Try another filter.' : 'Confirmation emails go out automatically within 24 hours of each booked appointment.'}</span></div>
        : shown.map(i => <div className="msg-row" key={i.id}>
          <div className={'msg-icon ' + i.kind}>{i.kind === 'whatsapp' ? <MessageCircleMore size={16}/> : i.kind === 'offer' ? <WandSparkles size={16}/> : i.future ? <CalendarClock size={16}/> : <Mail size={16}/>}</div>
          <div className="msg-main">
            <strong>{i.title}</strong>
            <span>{i.client} · {i.service}{i.staff ? ' with ' + i.staff : ''}{i.appt ? ' · appt ' + fmt(i.appt.start_at) : i.slot ? ' · slot ' + fmt(i.slot) : ''}</span>
            {i.detail && <em className="msg-error">{i.detail}</em>}
            {i.expires && <em>Offer expires at {fmtTime(i.expires)}</em>}
          </div>
          <div className="msg-when">{i.future ? 'Sends ' : ''}{fmt(i.at)}</div>
          <div className="msg-status"><span className={'status ' + i.tone}>{i.label}</span></div>
          <div className="msg-action">{i.awaiting && onRemind && <button className="wa-btn" title="Send WhatsApp reminder" aria-label={'Send WhatsApp reminder to ' + i.client} onClick={() => onRemind(i.appt)}><MessageCircleMore size={16}/></button>}</div>
        </div>)}
    </section>
    <p className="msg-footnote">"Sent" means our mail server accepted the email. Opens and inbox delivery aren't tracked yet. WhatsApp shows when you opened the prefilled chat.</p>
  </div>
}

function Tile({ icon: Icon, label, value, hint, tone }) {
  return <div className="metric-card"><div className={'metric-icon ' + tone}><Icon size={18}/></div><div><span>{label}</span><strong>{value}</strong><small>{hint}</small></div></div>
}
