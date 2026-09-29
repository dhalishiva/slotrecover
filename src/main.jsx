import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  Activity, ArrowUpRight, BellRing, CalendarDays, CheckCircle2, ChevronRight,
  CircleDollarSign, Clock3, LayoutDashboard, LogOut, Menu, MessageCircleMore,
  Plus, RefreshCw, Search, Settings, ShieldCheck, Sparkles, UsersRound,
  WandSparkles, X, XCircle
} from 'lucide-react'
import { supabase, supabaseConfigured } from './supabase'
import './styles.css'

const demoAppointments = [
  { id: 1, time: '9:30 AM', client: 'Olivia Martin', service: 'Balayage & finish', value: 180, status: 'confirmed' },
  { id: 2, time: '11:00 AM', client: 'Sophia Chen', service: 'Lash refill', value: 95, status: 'awaiting' },
  { id: 3, time: '1:30 PM', client: 'Mia Thompson', service: 'Color correction', value: 240, status: 'at-risk' },
  { id: 4, time: '3:00 PM', client: 'Ava Johnson', service: 'Cut & style', value: 85, status: 'recovered' },
  { id: 5, time: '4:30 PM', client: 'Emma Davis', service: 'Root touch-up', value: 120, status: 'confirmed' },
]

const demoActivity = [
  { title: 'Recovered 3:00 PM cancellation', meta: 'Waitlist offer accepted by Ava Johnson', value: '+$85', icon: 'recover' },
  { title: 'Mia Thompson flagged high risk', meta: 'No confirmation after 24h reminder', value: '$240 at risk', icon: 'risk' },
  { title: 'Sophia Chen reminder delivered', meta: 'Email confirmation requested', value: '11:00 AM', icon: 'message' },
]

const money = (v) => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 0
}).format(v || 0)

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [demo, setDemo] = useState(!supabaseConfigured)

  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (loading) return <div className="boot"><div className="spinner" />Loading workspace…</div>
  if (!session && !demo) return <AuthScreen onDemo={() => setDemo(true)} />
  return <Dashboard session={session} demo={demo} onExitDemo={() => setDemo(false)} />
}

function AuthScreen({ onDemo }) {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [otpStep, setOtpStep] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setMsg('')

    if (otpStep) {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otp.trim(),
        type: 'email',
      })
      setBusy(false)
      if (error) setMsg(error.message)
      return
    }

    if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      setBusy(false)
      if (error) setMsg(error.message)
      return
    }

    const { data, error } = await supabase.auth.signUp({ email, password })
    setBusy(false)
    if (error) {
      setMsg(error.message)
      return
    }

    if (data.session) return
    setOtpStep(true)
    setMsg('We sent a 6-digit verification code to your email.')
  }

  function switchMode() {
    setMode(mode === 'signin' ? 'signup' : 'signin')
    setOtpStep(false)
    setOtp('')
    setMsg('')
  }

  return <div className="auth-shell">
    <section className="auth-visual">
      <Brand />
      <div className="auth-copy">
        <div className="eyebrow"><Sparkles size={14}/> REVENUE RECOVERY FOR SOLO PRACTITIONERS</div>
        <h1>Every cancelled slot should get a second chance.</h1>
        <p>Confirm appointments, catch cancellations earlier, and automatically offer empty time to the right waitlisted client.</p>
        <div className="recovery-card">
          <div><span>Recovered this month</span><strong>$2,840</strong></div>
          <b>+18.4%</b>
        </div>
      </div>
      <small>Designed for appointment businesses where empty time means lost revenue.</small>
    </section>

    <section className="auth-panel">
      <form className="auth-box" onSubmit={submit}>
        <div className="mobile-brand"><Brand /></div>
        <p className="kicker">WELCOME</p>
        <h2>{otpStep ? 'Verify your email' : mode === 'signin' ? 'Sign in to your workspace' : 'Create your workspace'}</h2>
        <p className="subtle">{otpStep
          ? `Enter the verification code sent to ${email}.`
          : mode === 'signin'
            ? 'See what is confirmed, at risk, and already recovered.'
            : 'Create your account, then verify your email with a one-time code.'}</p>

        {!otpStep && <>
          <label>Email address</label>
          <input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@business.com"/>
          <label>Password</label>
          <input required minLength={6} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"/>
        </>}

        {otpStep && <>
          <label>Verification code</label>
          <input
            required
            autoFocus
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6,10}"
            maxLength={10}
            value={otp}
            onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 10))}
            placeholder="Enter verification code"
          />
        </>}

        <button className="primary wide" disabled={busy || (otpStep && otp.length < 6)}>
          {busy ? 'Working…' : otpStep ? 'Verify email' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>

        {msg && <div className="form-msg">{msg}</div>}

        {otpStep ? (
          <div className="switch-auth">
            Wrong email?
            <button type="button" onClick={() => { setOtpStep(false); setOtp(''); setMsg('') }}>Go back</button>
          </div>
        ) : (
          <div className="switch-auth">
            {mode === 'signin' ? 'New here?' : 'Already have an account?'}
            <button type="button" onClick={switchMode}>
              {mode === 'signin' ? 'Create an account' : 'Sign in'}
            </button>
          </div>
        )}

        <div className="or"><span>or</span></div>
        <button type="button" className="ghost wide" onClick={onDemo}>Explore demo workspace <ArrowUpRight size={16}/></button>
      </form>
    </section>
  </div>
}

function Brand() {
  return <div className="brand"><div className="logo-mark"><RefreshCw size={17}/></div>SlotRecover</div>
}

function Dashboard({ session, demo, onExitDemo }) {
  const [nav, setNav] = useState('Overview')
  const [mobileNav, setMobileNav] = useState(false)
  const [practiceName, setPracticeName] = useState('Atelier No. 7')
  const [practiceId, setPracticeId] = useState(null)
  const [services, setServices] = useState([])
  const [busy, setBusy] = useState(false)
  const [needsSetup, setNeedsSetup] = useState(false)
  const [modal, setModal] = useState(null)
  const [toast, setToast] = useState('')
  const [data, setData] = useState({
    appointments: demoAppointments,
    revenue: 2840,
    atRisk: 335,
    recoveryRate: 72,
    noShow: 4.8,
    recoveredSlots: 8,
    cancelledSlots: 11,
    activity: demoActivity,
    waitlist: []
  })

  useEffect(() => {
    if (!demo && session && supabase) loadLive()
  }, [demo, session])

  function notify(message) {
    setToast(message)
    setTimeout(() => setToast(''), 3000)
  }

  async function loadLive() {
    setBusy(true)
    const { data: practices, error: practiceError } = await supabase.from('practices').select('*').order('created_at').limit(1)
    if (practiceError) {
      notify(practiceError.message)
      setBusy(false)
      return
    }
    if (!practices?.length) {
      setData({ appointments: [], revenue: 0, atRisk: 0, recoveryRate: 0, noShow: 0, recoveredSlots: 0, cancelledSlots: 0, activity: [], waitlist: [] })
      setPracticeName('Your practice')
      setPracticeId(null)
      setServices([])
      setNeedsSetup(true)
      setBusy(false)
      return
    }

    const p = practices[0]
    setPracticeName(p.name)
    setPracticeId(p.id)
    setNeedsSetup(false)
    const today = new Date(); today.setHours(0,0,0,0)

    const [{ data: svc }, { data: appts }, { data: rev }, { data: offers }, { data: waitlist }] = await Promise.all([
      supabase.from('services').select('id,name,duration_minutes,price_cents').eq('practice_id', p.id).eq('active', true).order('created_at'),
      supabase.from('appointments')
        .select('id,start_at,status,services(name,price_cents),clients(first_name,last_name)')
        .eq('practice_id', p.id).gte('start_at', today.toISOString()).order('start_at').limit(20),
      supabase.from('revenue_events').select('id,event_type,amount_cents,created_at').eq('practice_id', p.id).order('created_at',{ascending:false}).limit(30),
      supabase.from('recovery_offers')
        .select('id,status,offered_at,expires_at,clients(first_name,last_name),appointments(start_at,services(name,price_cents))')
        .eq('practice_id', p.id).order('offered_at',{ascending:false}).limit(20),
      supabase.from('waitlist_entries')
        .select('id,status,window_start,window_end,min_notice_minutes,clients(first_name,last_name),services(name,price_cents)')
        .eq('practice_id', p.id).order('created_at',{ascending:false}).limit(20)
    ])

    setServices(svc || [])

    const appointments = (appts || []).map(a => ({
      id: a.id,
      time: new Date(a.start_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
      date: new Date(a.start_at).toLocaleDateString([], { month:'short', day:'numeric' }),
      client: [a.clients?.first_name || 'Client', a.clients?.last_name || ''].join(' ').trim(),
      service: a.services?.name || 'Service',
      value: (a.services?.price_cents || 0) / 100,
      status: a.status
    }))

    const recovered = (rev || []).filter(x => x.event_type === 'recovered').reduce((s,x) => s + x.amount_cents/100, 0)
    const atRiskRaw = (rev || []).filter(x => x.event_type === 'at_risk').reduce((s,x) => s + x.amount_cents/100, 0)
    const atRisk = Math.max(0, atRiskRaw - recovered)
    const recoveredSlots = (rev || []).filter(x => x.event_type === 'recovered').length
    const cancelledSlots = (rev || []).filter(x => x.event_type === 'at_risk').length

    const activity = [
      ...(rev || []).map(e => ({
        title: e.event_type === 'recovered' ? 'Revenue recovered' : e.event_type === 'at_risk' ? 'Cancellation marked at risk' : 'No-show prevented',
        meta: new Date(e.created_at).toLocaleString([], { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' }),
        value: e.event_type === 'recovered' ? '+' + money(e.amount_cents/100) : money(e.amount_cents/100),
        icon: e.event_type === 'recovered' ? 'recover' : 'risk',
        ts: new Date(e.created_at).getTime()
      })),
      ...(offers || []).map(o => ({
        title: o.status === 'accepted' ? 'Waitlist offer accepted' : o.status === 'offered' ? 'Waitlist offer sent' : 'Waitlist offer ' + o.status,
        meta: [o.clients?.first_name,o.clients?.last_name].filter(Boolean).join(' ') || 'Client',
        value: o.appointments?.services?.price_cents ? money(o.appointments.services.price_cents/100) : '',
        icon: o.status === 'accepted' ? 'recover' : 'message',
        ts: new Date(o.offered_at).getTime()
      }))
    ].sort((a,b) => b.ts-a.ts).slice(0,6)

    setData({
      appointments,
      revenue: recovered,
      atRisk,
      recoveryRate: recovered + atRisk ? Math.round(recovered / (recovered + atRisk) * 100) : 0,
      noShow: 0,
      recoveredSlots,
      cancelledSlots,
      activity,
      waitlist: (waitlist || []).map(w => ({
        id:w.id,
        client:[w.clients?.first_name||'Client',w.clients?.last_name||''].join(' ').trim(),
        service:w.services?.name||'Service',
        status:w.status,
        window:new Date(w.window_start).toLocaleDateString([], {month:'short',day:'numeric'}) + ' – ' + new Date(w.window_end).toLocaleDateString([], {month:'short',day:'numeric'}),
        value:(w.services?.price_cents||0)/100
      }))
    })
    setBusy(false)
  }

  async function signOut() {
    if (session && supabase) await supabase.auth.signOut()
    else onExitDemo()
  }

  const navItems = [
    ['Overview', LayoutDashboard], ['Appointments', CalendarDays], ['Recovery', WandSparkles],
    ['Clients', UsersRound], ['Messaging', MessageCircleMore]
  ]

  return <div className="app-shell">
    <aside className={'sidebar ' + (mobileNav ? 'open' : '')}>
      <Brand />
      <button className="close-nav" onClick={() => setMobileNav(false)}><X size={20}/></button>
      <div className="practice-chip">
        <div className="avatar">{practiceName.slice(0,2).toUpperCase()}</div>
        <div><strong>{practiceName}</strong><span>{demo ? 'Demo workspace' : 'Live workspace'}</span></div>
        <ChevronRight size={16}/>
      </div>
      <nav>
        {navItems.map(([label, Icon]) => <button key={label} className={nav === label ? 'active' : ''} onClick={() => { setNav(label); setMobileNav(false) }}>
          <Icon size={18}/>{label}{label === 'Recovery' && <span className="new-badge">CORE</span>}
        </button>)}
      </nav>
      <div className="sidebar-bottom">
        <button className={nav === 'Settings' ? 'active' : ''} onClick={() => setNav('Settings')}><Settings size={18}/>Settings</button>
        <button onClick={signOut}><LogOut size={18}/>{demo ? 'Exit demo' : 'Sign out'}</button>
      </div>
    </aside>

    <main>
      <header className="topbar">
        <div className="top-left">
          <button className="menu" onClick={() => setMobileNav(true)}><Menu size={20}/></button>
          <div className="breadcrumb">Workspace <ChevronRight size={14}/> <strong>{nav}</strong></div>
        </div>
        <div className="top-actions">
          <button className="icon-btn"><Search size={18}/></button>
          <button className="icon-btn bell"><BellRing size={18}/><i/></button>
          <div className="profile"><div className="profile-avatar">SR</div><span>{session?.user?.email || 'Demo user'}</span></div>
        </div>
      </header>

      {needsSetup && !demo ? <Onboarding session={session} onDone={loadLive}/> :
        nav === 'Overview' ? <Overview data={data} busy={busy} refresh={loadLive} demo={demo} onNew={() => setModal('appointment')}/> :
        nav === 'Appointments' ? <Appointments appointments={data.appointments} onNew={() => setModal('appointment')}/> :
        nav === 'Recovery' ? <Recovery waitlist={data.waitlist} onNew={() => setModal('waitlist')}/> :
        nav === 'Clients' ? <EmptyPanel title="Client intelligence" text="Client history, confirmation behavior, and waitlist preferences will live here." icon={UsersRound}/> :
        nav === 'Messaging' ? <EmptyPanel title="Messaging center" text="Track confirmation reminders, delivery states, replies, and channel costs." icon={MessageCircleMore}/> :
        <EmptyPanel title="Workspace settings" text="Business hours, service rules, reminder timing, deposits, and integrations." icon={Settings}/>
      }
    </main>

    {modal === 'appointment' && <AppointmentModal practiceId={practiceId} services={services} onClose={() => setModal(null)} onSaved={() => { setModal(null); notify('Appointment created'); loadLive() }}/>}
    {modal === 'waitlist' && <WaitlistModal practiceId={practiceId} services={services} onClose={() => setModal(null)} onSaved={() => { setModal(null); notify('Waitlist entry added'); loadLive() }}/>}
    {toast && <div className="toast">{toast}</div>}
  </div>
}

function Onboarding({ session, onDone }) {
  const [practice, setPractice] = useState('')
  const [service, setService] = useState('Signature service')
  const [price, setPrice] = useState('95')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function createWorkspace(e) {
    e.preventDefault()
    setBusy(true); setError('')
    const { error } = await supabase.rpc('create_practice_workspace', {
      p_name: practice,
      p_service_name: service,
      p_price_cents: Math.max(0, Math.round(Number(price || 0) * 100))
    })
    if (error) { setError(error.message); setBusy(false); return }
    setBusy(false)
    onDone()
  }

  return <div className="page onboarding-page">
    <div className="onboarding-card">
      <div className="onboarding-icon"><Sparkles size={24}/></div>
      <div className="eyebrow-dark">SET UP YOUR LIVE WORKSPACE</div>
      <h1>Start with one service.</h1>
      <p>We’ll create the practice, service catalog, reminder rules, waitlist engine, and revenue tracking foundation.</p>
      <form onSubmit={createWorkspace}>
        <label>Practice name</label>
        <input value={practice} onChange={e => setPractice(e.target.value)} placeholder="e.g. Atelier No. 7" required/>
        <div className="onboarding-split">
          <div><label>First service</label><input value={service} onChange={e => setService(e.target.value)} required/></div>
          <div><label>Price (USD)</label><input type="number" min="0" value={price} onChange={e => setPrice(e.target.value)} required/></div>
        </div>
        <button className="primary wide" disabled={busy}>{busy ? 'Creating workspace…' : 'Create workspace'}</button>
        {error && <div className="form-msg">{error}</div>}
      </form>
      <div className="onboarding-note"><ShieldCheck size={15}/>Your workspace data is protected with Row Level Security.</div>
    </div>
  </div>
}

function Overview({ data, busy, refresh, demo, onNew }) {
  const today = new Date().toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' })
  const activity = demo ? demoActivity : data.activity
  return <div className="page">
    <div className="page-heading">
      <div><div className="eyebrow-dark">REVENUE COMMAND CENTER</div><h1>Good morning.</h1><p>{today} · Know what needs attention before an empty slot costs you.</p></div>
      <div className="heading-actions">
        <button className="ghost" onClick={refresh} disabled={demo || busy}><RefreshCw size={16} className={busy ? 'spin' : ''}/>{demo ? 'Demo data' : 'Refresh'}</button>
        <button className="primary" onClick={onNew}><Plus size={17}/>New appointment</button>
      </div>
    </div>

    <section className="hero-metric">
      <div>
        <div className="metric-label"><CircleDollarSign size={17}/>Revenue recovered <span>This month</span></div>
        <div className="hero-value">{money(data.revenue)}</div>
        <div className="metric-note"><strong>{data.recoveryRate}%</strong> of at-risk revenue recovered</div>
      </div>
      <div className="ring" style={{'--p': Math.max(data.recoveryRate, 3) * 3.6 + 'deg'}}>
        <div><strong>{data.recoveryRate}%</strong><span>recovery rate</span></div>
      </div>
    </section>

    <div className="metric-grid">
      <Metric icon={Activity} label="Revenue at risk" value={money(data.atRisk)} hint="Cancelled revenue not yet recovered" tone="amber"/>
      <Metric icon={CheckCircle2} label="Recovered slots" value={String(data.recoveredSlots || 0)} hint={(data.cancelledSlots || 0) + ' cancellations recorded'} tone="green"/>
      <Metric icon={Clock3} label="Recovery engine" value="15 min" hint="Offer window per waitlist client" tone="blue"/>
      <Metric icon={ShieldCheck} label="No-show rate" value={data.noShow + '%'} hint="Tracking starts with completed visits" tone="violet"/>
    </div>

    <div className="content-grid">
      <section className="panel">
        <div className="panel-head"><div><h2>Upcoming appointments</h2><p>Live bookings from your workspace.</p></div></div>
        <div className="appointment-list">
          {data.appointments.length ? data.appointments.slice(0,8).map(a => <AppointmentRow key={a.id} a={a}/>) :
            <div className="empty-inline"><CalendarDays size={22}/><strong>No appointments yet</strong><span>Add your first appointment to start tracking revenue.</span></div>}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head"><div><h2>Recovery activity</h2><p>{demo ? 'Demo events.' : 'Live events from your recovery engine.'}</p></div></div>
        <div className="activity-list">{activity.length ? activity.map((a,i) => <div className="activity-item" key={i}>
          <div className={'activity-icon ' + a.icon}>{a.icon === 'recover' ? <RefreshCw size={16}/> : a.icon === 'risk' ? <Activity size={16}/> : <MessageCircleMore size={16}/>}</div>
          <div><strong>{a.title}</strong><span>{a.meta}</span></div><em>{a.value}</em>
        </div>) : <div className="empty-inline compact"><Activity size={22}/><strong>No recovery activity yet</strong><span>Activity appears after cancellations and waitlist offers.</span></div>}</div>
        <div className="automation-card"><div className="auto-icon"><WandSparkles size={18}/></div><div><strong>Recovery engine is active</strong><span>Cancelled slots are automatically matched to your waitlist.</span></div><div className="live-dot"><i/>LIVE</div></div>
      </section>
    </div>
  </div>
}

function Metric({ icon: Icon, label, value, hint, tone }) {
  return <div className="metric-card"><div className={'metric-icon ' + tone}><Icon size={18}/></div><div><span>{label}</span><strong>{value}</strong><small>{hint}</small></div></div>
}

function AppointmentRow({ a }) {
  const map = {
    confirmed:['Confirmed','ok'], awaiting:['Awaiting reply','wait'], 'at-risk':['At risk','danger'],
    recovered:['Recovered','recover'], booked:['Booked','wait'], cancelled:['Cancelled','danger'],
    completed:['Completed','ok'], no_show:['No-show','danger']
  }
  const [label,tone] = map[a.status] || [a.status,'wait']
  return <div className="appt-row">
    <div className="appt-time">{a.time}</div>
    <div className="client-cell"><div className="tiny-avatar">{a.client.split(' ').map(x=>x[0]).slice(0,2).join('')}</div><div><strong>{a.client}</strong><span>{a.service}</span></div></div>
    <div className="appt-value">{money(a.value)}</div>
    <div><span className={'status ' + tone}>{tone === 'recover' && <RefreshCw size={12}/>} {label}</span></div>
  </div>
}

function Appointments({ appointments, onNew }) {
  return <div className="page">
    <div className="page-heading"><div><div className="eyebrow-dark">SCHEDULE</div><h1>Appointments</h1><p>Every booking, confirmation, cancellation, and refill in one place.</p></div><button className="primary" onClick={onNew}><Plus size={17}/>New appointment</button></div>
    <section className="panel table-panel">
      <div className="filters"><button className="filter active">Upcoming</button></div>
      {appointments.length ? appointments.map(a => <AppointmentRow a={a} key={a.id}/>) : <div className="empty-inline"><CalendarDays size={22}/><strong>No appointments yet</strong><span>Create one to begin scheduling.</span></div>}
    </section>
  </div>
}

function Recovery({ waitlist, onNew }) {
  return <div className="page">
    <div className="page-heading"><div><div className="eyebrow-dark">AUTOMATED CAPACITY RECOVERY</div><h1>Recovery engine</h1><p>Turn cancellations into a sequenced waitlist offer before the slot goes cold.</p></div><button className="primary" onClick={onNew}><Plus size={17}/>Add to waitlist</button></div>
    <div className="recovery-flow">
      <FlowStep n="01" title="Cancellation detected" text="The original appointment is marked at risk and the slot becomes recoverable." icon={XCircle}/>
      <FlowStep n="02" title="Best waitlist match" text="Service, timing, notice preference, and priority determine who gets the offer first." icon={UsersRound}/>
      <FlowStep n="03" title="15-minute offer" text="No response automatically advances to the next matching client." icon={Clock3}/>
      <FlowStep n="04" title="Revenue recovered" text="The replacement appointment is booked and attributed to recovered revenue." icon={CircleDollarSign}/>
    </div>
    <section className="panel waitlist-panel">
      <div className="panel-head"><div><h2>Current waitlist</h2><p>Live candidates eligible for cancellation recovery.</p></div></div>
      {waitlist?.length ? waitlist.map(w => <div className="wait-row" key={w.id}>
        <div className="tiny-avatar">{w.client.split(' ').map(x=>x[0]).slice(0,2).join('')}</div>
        <div><strong>{w.client}</strong><span>{w.service} · {w.window}</span></div>
        <div className="appt-value">{money(w.value)}</div>
        <span className={'status ' + (w.status === 'active' ? 'ok' : 'wait')}>{w.status}</span>
      </div>) : <div className="empty-inline"><UsersRound size={22}/><strong>No waitlist entries</strong><span>Add a client who wants an earlier or specific appointment window.</span></div>}
    </section>
  </div>
}

function FlowStep({ n, title, text, icon: Icon }) {
  return <div className="flow-step"><div className="flow-top"><span>{n}</span><div className="flow-icon"><Icon size={18}/></div></div><h3>{title}</h3><p>{text}</p></div>
}

function AppointmentModal({ practiceId, services, onClose, onSaved }) {
  const [form, setForm] = useState({ first_name:'', last_name:'', email:'', phone:'', service_id:services[0]?.id||'', start_at:'' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!form.service_id && services.length) {
      setForm(current => ({ ...current, service_id: services[0].id }))
    }
  }, [services, form.service_id])

  async function save(e) {
    e.preventDefault(); setBusy(true); setError('')
    const serviceId = form.service_id || services[0]?.id
    if (!practiceId || !serviceId) {
      setBusy(false)
      return setError('Workspace or service is still loading. Please close this form and try again.')
    }
    const { error } = await supabase.rpc('create_appointment', {
      p_practice_id: practiceId,
      p_service_id: serviceId,
      p_first_name: form.first_name,
      p_last_name: form.last_name,
      p_email: form.email,
      p_phone: form.phone,
      p_start_at: form.start_at ? new Date(form.start_at).toISOString() : null
    })
    setBusy(false)
    if (error) return setError(error.message)
    onSaved()
  }
  return <Modal title="New appointment" subtitle="Create a client and booking in one step." onClose={onClose}>
    <form className="modal-form" onSubmit={save}>
      <div className="form-grid"><Field label="First name"><input required value={form.first_name} onChange={e=>setForm({...form,first_name:e.target.value})}/></Field><Field label="Last name"><input value={form.last_name} onChange={e=>setForm({...form,last_name:e.target.value})}/></Field></div>
      <Field label="Service"><select required value={form.service_id || services[0]?.id || ''} onChange={e=>setForm({...form,service_id:e.target.value})}>{services.map(s=><option value={s.id} key={s.id}>{s.name} · {money(s.price_cents/100)}</option>)}</select></Field>
      <Field label="Start date & time"><input required type="datetime-local" value={form.start_at} onChange={e=>setForm({...form,start_at:e.target.value})}/></Field>
      <div className="form-grid"><Field label="Email"><input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></Field><Field label="Phone"><input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></Field></div>
      {error && <div className="form-msg">{error}</div>}
      <div className="modal-actions"><button type="button" className="ghost" onClick={onClose}>Cancel</button><button className="primary" disabled={busy||!services.length}>{busy?'Creating…':'Create appointment'}</button></div>
    </form>
  </Modal>
}

function WaitlistModal({ practiceId, services, onClose, onSaved }) {
  const [form, setForm] = useState({ first_name:'', last_name:'', email:'', phone:'', service_id:services[0]?.id||'', window_start:'', window_end:'', min_notice_minutes:60 })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!form.service_id && services.length) {
      setForm(current => ({ ...current, service_id: services[0].id }))
    }
  }, [services, form.service_id])

  async function save(e) {
    e.preventDefault(); setBusy(true); setError('')
    const serviceId = form.service_id || services[0]?.id
    if (!practiceId || !serviceId) {
      setBusy(false)
      return setError('Workspace or service is still loading. Please close this form and try again.')
    }
    const { error } = await supabase.rpc('add_waitlist_entry', {
      p_practice_id: practiceId,
      p_service_id: serviceId,
      p_first_name: form.first_name,
      p_last_name: form.last_name,
      p_email: form.email,
      p_phone: form.phone,
      p_window_start: form.window_start ? new Date(form.window_start).toISOString() : null,
      p_window_end: form.window_end ? new Date(form.window_end).toISOString() : null,
      p_min_notice_minutes: Number(form.min_notice_minutes)
    })
    setBusy(false)
    if (error) return setError(error.message)
    onSaved()
  }
  return <Modal title="Add to waitlist" subtitle="SlotRecover will use this window when a matching cancellation opens." onClose={onClose}>
    <form className="modal-form" onSubmit={save}>
      <div className="form-grid"><Field label="First name"><input required value={form.first_name} onChange={e=>setForm({...form,first_name:e.target.value})}/></Field><Field label="Last name"><input value={form.last_name} onChange={e=>setForm({...form,last_name:e.target.value})}/></Field></div>
      <Field label="Service"><select required value={form.service_id || services[0]?.id || ''} onChange={e=>setForm({...form,service_id:e.target.value})}>{services.map(s=><option value={s.id} key={s.id}>{s.name} · {money(s.price_cents/100)}</option>)}</select></Field>
      <div className="form-grid"><Field label="Window starts"><input required type="datetime-local" value={form.window_start} onChange={e=>setForm({...form,window_start:e.target.value})}/></Field><Field label="Window ends"><input required type="datetime-local" value={form.window_end} onChange={e=>setForm({...form,window_end:e.target.value})}/></Field></div>
      <div className="form-grid"><Field label="Email"><input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></Field><Field label="Phone"><input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></Field></div>
      <Field label="Minimum notice (minutes)"><input type="number" min="0" value={form.min_notice_minutes} onChange={e=>setForm({...form,min_notice_minutes:e.target.value})}/></Field>
      {error && <div className="form-msg">{error}</div>}
      <div className="modal-actions"><button type="button" className="ghost" onClick={onClose}>Cancel</button><button className="primary" disabled={busy||!services.length}>{busy?'Adding…':'Add to waitlist'}</button></div>
    </form>
  </Modal>
}

function Modal({ title, subtitle, onClose, children }) {
  return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget) onClose()}}>
    <div className="modal-card">
      <div className="modal-head"><div><h2>{title}</h2><p>{subtitle}</p></div><button className="icon-btn" onClick={onClose}><X size={18}/></button></div>
      {children}
    </div>
  </div>
}

function Field({ label, children }) {
  return <label className="field"><span>{label}</span>{children}</label>
}

function EmptyPanel({ title, text, icon: Icon }) {
  return <div className="page"><div className="empty-page"><div className="empty-big"><Icon size={28}/></div><h1>{title}</h1><p>{text}</p><button className="ghost">Preview planned workflow <ArrowUpRight size={16}/></button></div></div>
}

createRoot(document.getElementById('root')).render(<App />)
