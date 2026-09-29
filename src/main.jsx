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
  const [busy, setBusy] = useState(false)
  const [needsSetup, setNeedsSetup] = useState(false)
  const [data, setData] = useState({
    appointments: demoAppointments, revenue: 2840, atRisk: 335, recoveryRate: 72, noShow: 4.8
  })

  useEffect(() => {
    if (!demo && session && supabase) loadLive()
  }, [demo, session])

  async function loadLive() {
    setBusy(true)
    const { data: practices } = await supabase.from('practices').select('*').order('created_at').limit(1)
    if (!practices?.length) {
      setData({ appointments: [], revenue: 0, atRisk: 0, recoveryRate: 0, noShow: 0 })
      setPracticeName('Your practice')
      setNeedsSetup(true)
      setBusy(false)
      return
    }

    const p = practices[0]
    setPracticeName(p.name)
    setNeedsSetup(false)
    const today = new Date(); today.setHours(0,0,0,0)

    const [{ data: appts }, { data: rev }] = await Promise.all([
      supabase.from('appointments')
        .select('id,start_at,status,services(name,price_cents),clients(first_name,last_name)')
        .eq('practice_id', p.id).gte('start_at', today.toISOString()).order('start_at').limit(8),
      supabase.from('revenue_events').select('event_type,amount_cents').eq('practice_id', p.id)
    ])

    const appointments = (appts || []).map(a => ({
      id: a.id,
      time: new Date(a.start_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
      client: [a.clients?.first_name || 'Client', a.clients?.last_name || ''].join(' ').trim(),
      service: a.services?.name || 'Service',
      value: (a.services?.price_cents || 0) / 100,
      status: a.status
    }))
    const recovered = (rev || []).filter(x => x.event_type === 'recovered').reduce((s,x) => s + x.amount_cents/100, 0)
    const atRiskRaw = (rev || []).filter(x => x.event_type === 'at_risk').reduce((s,x) => s + x.amount_cents/100, 0)
    const atRisk = Math.max(0, atRiskRaw - recovered)
    setData({
      appointments, revenue: recovered, atRisk,
      recoveryRate: recovered + atRisk ? Math.round(recovered / (recovered + atRisk) * 100) : 0,
      noShow: 0
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
        nav === 'Overview' ? <Overview data={data} busy={busy} refresh={loadLive} demo={demo}/> :
        nav === 'Appointments' ? <Appointments appointments={data.appointments}/> :
        nav === 'Recovery' ? <Recovery/> :
        nav === 'Clients' ? <EmptyPanel title="Client intelligence" text="Client history, confirmation behavior, and waitlist preferences will live here." icon={UsersRound}/> :
        nav === 'Messaging' ? <EmptyPanel title="Messaging center" text="Track confirmation reminders, delivery states, replies, and channel costs." icon={MessageCircleMore}/> :
        <EmptyPanel title="Workspace settings" text="Business hours, service rules, reminder timing, deposits, and integrations." icon={Settings}/>
      }
    </main>
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
    const { data: p, error: pe } = await supabase.from('practices')
      .insert({ owner_id: session.user.id, name: practice }).select().single()
    if (pe) { setError(pe.message); setBusy(false); return }

    const { error: se } = await supabase.from('services').insert({
      practice_id: p.id, name: service, duration_minutes: 60,
      price_cents: Math.max(0, Math.round(Number(price || 0) * 100))
    })
    if (se) { setError(se.message); setBusy(false); return }
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

function Overview({ data, busy, refresh, demo }) {
  const today = new Date().toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' })
  return <div className="page">
    <div className="page-heading">
      <div><div className="eyebrow-dark">REVENUE COMMAND CENTER</div><h1>Good morning.</h1><p>{today} · Know what needs attention before an empty slot costs you.</p></div>
      <div className="heading-actions">
        <button className="ghost" onClick={refresh} disabled={demo || busy}><RefreshCw size={16} className={busy ? 'spin' : ''}/>{demo ? 'Demo data' : 'Refresh'}</button>
        <button className="primary"><Plus size={17}/>New appointment</button>
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
      <Metric icon={Activity} label="Revenue at risk" value={money(data.atRisk)} hint="Needs confirmation or refill" tone="amber"/>
      <Metric icon={CheckCircle2} label="Recovered slots" value="8" hint="11 cancellations this month" tone="green"/>
      <Metric icon={Clock3} label="Avg. refill time" value="12 min" hint="Fastest recovery: 3 min" tone="blue"/>
      <Metric icon={ShieldCheck} label="No-show rate" value={data.noShow + '%'} hint="Track improvement over time" tone="violet"/>
    </div>

    <div className="content-grid">
      <section className="panel">
        <div className="panel-head"><div><h2>Today’s appointments</h2><p>Confirmations and revenue risk at a glance.</p></div></div>
        <div className="appointment-list">
          {data.appointments.length ? data.appointments.map(a => <AppointmentRow key={a.id} a={a}/>) :
            <div className="empty-inline"><CalendarDays size={22}/><strong>No appointments yet</strong><span>Add your first appointment to start tracking revenue.</span></div>}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head"><div><h2>Recovery activity</h2><p>What SlotRecover did for you.</p></div></div>
        <div className="activity-list">{demoActivity.map((a,i) => <div className="activity-item" key={i}>
          <div className={'activity-icon ' + a.icon}>{a.icon === 'recover' ? <RefreshCw size={16}/> : a.icon === 'risk' ? <Activity size={16}/> : <MessageCircleMore size={16}/>}</div>
          <div><strong>{a.title}</strong><span>{a.meta}</span></div><em>{a.value}</em>
        </div>)}</div>
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

function Appointments({ appointments }) {
  return <div className="page">
    <div className="page-heading"><div><div className="eyebrow-dark">SCHEDULE</div><h1>Appointments</h1><p>Every booking, confirmation, cancellation, and refill in one place.</p></div><button className="primary"><Plus size={17}/>New appointment</button></div>
    <section className="panel table-panel">
      <div className="filters"><button className="filter active">Today</button><button className="filter">Upcoming</button><button className="filter">Needs attention</button></div>
      {appointments.map(a => <AppointmentRow a={a} key={a.id}/>)}
    </section>
  </div>
}

function Recovery() {
  return <div className="page">
    <div className="page-heading"><div><div className="eyebrow-dark">AUTOMATED CAPACITY RECOVERY</div><h1>Recovery engine</h1><p>Turn cancellations into a sequenced waitlist offer before the slot goes cold.</p></div><button className="primary"><Plus size={17}/>Add to waitlist</button></div>
    <div className="recovery-flow">
      <FlowStep n="01" title="Cancellation detected" text="The original appointment is marked at risk and the slot becomes recoverable." icon={XCircle}/>
      <FlowStep n="02" title="Best waitlist match" text="Service, timing, notice preference, and priority determine who gets the offer first." icon={UsersRound}/>
      <FlowStep n="03" title="15-minute offer" text="No response automatically advances to the next matching client." icon={Clock3}/>
      <FlowStep n="04" title="Revenue recovered" text="The replacement appointment is booked and attributed to recovered revenue." icon={CircleDollarSign}/>
    </div>
  </div>
}

function FlowStep({ n, title, text, icon: Icon }) {
  return <div className="flow-step"><div className="flow-top"><span>{n}</span><div className="flow-icon"><Icon size={18}/></div></div><h3>{title}</h3><p>{text}</p></div>
}

function EmptyPanel({ title, text, icon: Icon }) {
  return <div className="page"><div className="empty-page"><div className="empty-big"><Icon size={28}/></div><h1>{title}</h1><p>{text}</p><button className="ghost">Preview planned workflow <ArrowUpRight size={16}/></button></div></div>
}

createRoot(document.getElementById('root')).render(<App />)
