import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  Activity, ArrowUpRight, BellRing, CalendarDays, CheckCircle2, ChevronRight,
  CircleDollarSign, Clock3, LayoutDashboard, LogOut, Menu, MessageCircleMore,
  Plus, RefreshCw, Search, Settings, ShieldCheck, Sparkles, UsersRound,
  WandSparkles, X, XCircle, HelpCircle, Download
} from 'lucide-react'
import { supabase, supabaseConfigured } from './supabase'
import { LegalPage, isLegalPath } from './legal'
import { HelpCenter, HelpBubble } from './help'
import { money, setMoneyCurrency, LogoMark } from './ui'
import { hasAccess, startCheckout, fetchBillingStatus, accessUntil } from './billingClient'
import { SettingsPage } from './settings'
import { AppointmentModal } from './booking'
import { ReminderModal, fetchReminderAppointment, reminderSelect } from './whatsapp'
import { registerServiceWorker } from './pwa'
import { InstallModal, useInstallState } from './appInstall'
import { MessagingPage } from './messaging'
import '@fontsource/dm-sans/400.css'
import '@fontsource/dm-sans/500.css'
import '@fontsource/dm-sans/600.css'
import '@fontsource/dm-sans/700.css'
import '@fontsource/manrope/600.css'
import '@fontsource/manrope/700.css'
import '@fontsource/manrope/800.css'
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

function App() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/'
  if (isLegalPath(path)) return <><LegalPage path={path} /><HelpBubble /></>
  if (path === '/help') return <HelpCenter />
  const query = new URLSearchParams(window.location.search)
  const isPublicAction = query.get('action') && query.get('token')
  return <><AppContent />{!isPublicAction && <HelpBubble />}</>
}

// Opened from a password-reset email link (implicit flow puts type=recovery in the hash).
const openedFromRecoveryLink = typeof window !== 'undefined' && /type=recovery/.test(window.location.hash)

function AppContent() {
  const [session, setSession] = useState(null)
  const [recovery, setRecovery] = useState(openedFromRecoveryLink)
  const [loading, setLoading] = useState(true)
  const [demo, setDemo] = useState(!supabaseConfigured)
  const [billing, setBilling] = useState(null)
  const [billingLoading, setBillingLoading] = useState(false)

  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      setSession(next)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session || !supabase || demo) {
      setBilling(null)
      setBillingLoading(false)
      return
    }
    setBillingLoading(true)
    supabase.from('billing_accounts')
      .select('status,trial_started_at,trial_ends_at,current_period_end,cancel_at_period_end,razorpay_subscription_id,authorization_verified_at,billing_plans(name,amount_paise,currency,period,trial_days)')
      .eq('user_id', session.user.id)
      .single()
      .then(({ data }) => {
        setBilling(data || null)
        setBillingLoading(false)
      })
  }, [session?.user?.id, demo])

  const query = new URLSearchParams(window.location.search)
  const publicAction = query.get('action')
  const publicToken = query.get('token')

  if (publicAction && publicToken && ['confirm','cancel','reschedule','recovery'].includes(publicAction)) {
    return <PublicActionPage action={publicAction} token={publicToken} />
  }

  if (recovery && session) return <SetNewPasswordScreen onDone={() => { setRecovery(false); window.history.replaceState({}, '', '/') }} />
  if (loading || (recovery && !session && openedFromRecoveryLink) || (session && !demo && billingLoading)) return <div className="boot"><div className="spinner" />Loading workspace…</div>
  if (!session && !demo) return <AuthScreen onDemo={() => setDemo(true)} onRecoveryStart={() => setRecovery(true)} onRecoveryFailed={() => setRecovery(false)} />
  if (session && !demo && billing && !hasAccess(billing)) {
    return <BillingSetupScreen billing={billing} onReady={() => window.location.reload()} />
  }
  return <Dashboard session={session} demo={demo} onExitDemo={() => setDemo(false)} />
}

function BillingSetupScreen({ billing, onReady }) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function startBilling() {
    setBusy(true); setMessage('')
    const res = await startCheckout()
    setBusy(false)
    if (res.ok) onReady()
    else if (!res.dismissed) setMessage(res.message)
  }

  const trialEnd = new Date(billing.trial_ends_at)
  const daysLeft = Math.max(0, Math.ceil((trialEnd.getTime() - Date.now()) / 86400000))
  const plan = Array.isArray(billing.billing_plans) ? billing.billing_plans[0] : billing.billing_plans
  const currency = plan?.currency || 'USD'
  const amount = (plan?.amount_paise || 0) / 100
  const formattedAmount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(amount)
  const formattedZero = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(0)

  const trialLeft = trialEnd.getTime() > Date.now()
  const periodWord = plan?.period === 'yearly' ? 'year' : 'month'
  const legal = <>By continuing you agree to the <a href="/terms" target="_blank" rel="noreferrer">Terms of Service</a> and <a href="/refunds" target="_blank" rel="noreferrer">Refund &amp; Cancellation Policy</a>.</>

  return <div className="billing-setup-shell">
    <div className="billing-setup-card">
      <Brand />
      {trialLeft ? <>
        <div className="billing-pill">{(plan?.trial_days || 7)}-DAY FREE TRIAL</div>
        <h1>Start your SlotRecover trial.</h1>
        <p>Authorize Razorpay now. Your subscription billing is scheduled to begin after the free trial ends.</p>
      </> : <>
        <div className="billing-pill">{billing.status === 'cancelled' ? 'SUBSCRIPTION CANCELLED' : 'TRIAL ENDED'}</div>
        <h1>Restart your SlotRecover subscription.</h1>
        <p>Your workspace and data are still here. Restart your plan to keep confirming appointments and recovering cancelled slots.</p>
      </>}
      <div className="billing-summary">
        {trialLeft && <div><span>Trial remaining</span><strong>{daysLeft} day{daysLeft === 1 ? '' : 's'}</strong></div>}
        <div><span>Plan</span><strong>{formattedAmount} / {periodWord}</strong></div>
        <div><span>Charge today</span><strong>{trialLeft ? formattedZero + '*' : formattedAmount}</strong></div>
      </div>
      <button className="primary wide" onClick={startBilling} disabled={busy}>
        {busy ? 'Opening Razorpay…' : trialLeft ? 'Authorize & start trial' : 'Restart subscription'}
      </button>
      {trialLeft && <small>*Razorpay may perform a small mandate/authentication transaction depending on the payment method.</small>}
      <small className="renewal-note">{trialLeft
        ? <>Your subscription starts automatically when the trial ends and renews every {periodWord} at {formattedAmount} plus applicable taxes until you cancel. Cancel any time before the trial ends and you won't be charged. </>
        : <>You'll be charged {formattedAmount} today and every {periodWord} after that, plus applicable taxes, until you cancel in Settings. </>}{legal}</small>
      {message && <div className="form-msg">{message}</div>}
      <button type="button" className="text-btn signout-link" onClick={() => supabase.auth.signOut()}>Sign out</button>
    </div>
  </div>
}


function PublicActionPage({ action, token }) {
  const query = new URLSearchParams(window.location.search)
  const recoveryDecision = query.get('decision')
  const [state, setState] = useState(action === 'reschedule' ? 'choose-date' : 'working')
  const [message, setMessage] = useState('')
  const [date, setDate] = useState('')
  const [slots, setSlots] = useState([])
  const [selectedStart, setSelectedStart] = useState('')
  const [avail, setAvail] = useState(null)
  const [staffId, setStaffId] = useState('')

  useEffect(() => {
    if (action === 'confirm' || action === 'cancel') runAppointmentAction(action)
    if (action === 'recovery' && ['accept','decline'].includes(recoveryDecision)) runRecoveryAction(recoveryDecision)
  }, [action, token, recoveryDecision])

  async function invoke(body) {
    const { data, error } = await supabase.functions.invoke('slotrecover-public-action', { body })
    if (error || data?.error) throw new Error(error?.message || data?.message || data?.error || 'Unable to process this request.')
    return data
  }

  async function runAppointmentAction(nextAction) {
    try {
      setState('working')
      await invoke({ type:'appointment', token, action:nextAction })
      setState('success')
      setMessage(nextAction === 'confirm'
        ? 'Your appointment is confirmed.'
        : 'Your appointment has been cancelled. Any matching waitlist recovery can now begin.')
    } catch (e) {
      setState('error'); setMessage(e.message)
    }
  }

  async function runRecoveryAction(decision) {
    try {
      setState('working')
      const data = await invoke({ type:'recovery', token, action:decision })
      if (data?.ok === false) throw new Error(data?.reason === 'offer_expired' ? 'This offer has expired.' : 'This slot is no longer available.')
      setState('success')
      setMessage(decision === 'accept' ? 'The appointment is yours. Your booking is confirmed.' : 'Thanks — we’ll offer the slot to the next matching person.')
    } catch (e) {
      setState('error'); setMessage(e.message)
    }
  }

  async function loadAvailability(forStaff) {
    try {
      setState('loading-slots')
      const data = await invoke({ type:'appointment', token, action:'availability', date, staff_id: forStaff || null })
      const nextSlots = data?.slots || []
      setAvail(data)
      setSlots(nextSlots)
      setState('slots')
      setMessage(data?.closed ? 'We’re closed on this date. Please choose another day.' : nextSlots.length ? '' : 'No open times are available on this date.')
    } catch (e) {
      setState('error'); setMessage(e.message)
    }
  }

  function findSlots(e) {
    e.preventDefault()
    loadAvailability(staffId)
  }

  function pickStaff(id) {
    setStaffId(id)
    loadAvailability(id)
  }

  const publicTz = avail?.timezone
  const publicTime = iso => new Date(iso).toLocaleTimeString([], { hour:'numeric', minute:'2-digit', timeZone: publicTz || undefined })

  async function chooseSlot(startAt) {
    try {
      setSelectedStart(startAt)
      setState('working')
      const data = await invoke({ type:'appointment', token, action:'reschedule', start_at:startAt, staff_id: staffId || null })
      if (data?.ok === false) {
        setState('slot-conflict')
        setMessage('That time was just booked. Choose another available time or join the waitlist.')
        return
      }
      setState('success')
      setMessage('Your appointment has been rescheduled and confirmed.')
    } catch (e) {
      setState('slot-conflict')
      setMessage(e.message.includes('slot_unavailable') ? 'That time was just booked. Choose another available time or join the waitlist.' : e.message)
    }
  }

  async function joinWaitlist() {
    try {
      if (!date || !avail?.day_start) return
      setState('working')
      await invoke({
        type:'appointment',
        token,
        action:'join_waitlist',
        window_start: avail.day_start,
        window_end: avail.day_end,
        staff_id: staffId || null
      })
      setState('success')
      setMessage('You’ve been added to the waitlist for that date. We’ll contact you if a matching slot opens.')
    } catch (e) {
      setState('error'); setMessage(e.message)
    }
  }

  const title = action === 'confirm' ? 'Confirm appointment'
    : action === 'cancel' ? 'Cancel appointment'
    : action === 'recovery' ? 'Waitlist offer'
    : 'Reschedule appointment'

  return <div className="public-shell">
    <div className="public-card">
      <div className="public-brand">{avail?.business_name || 'SlotRecover'}</div>
      <div className="public-icon">{state === 'success' ? <CheckCircle2 size={30}/> : action === 'cancel' ? <XCircle size={30}/> : <CalendarDays size={30}/>}</div>
      <div className="eyebrow-dark">{action === 'recovery' ? 'WAITLIST RECOVERY' : 'APPOINTMENT RESPONSE'}</div>
      <h1>{title}</h1>

      {action === 'reschedule' && state === 'choose-date' && <form className="public-form" onSubmit={findSlots}>
        <p>Choose a date and we’ll show only times that are currently available.</p>
        <label>Preferred date</label>
        <input type="date" required value={date} onChange={e => setDate(e.target.value)} />
        <button className="primary wide">Show available times</button>
      </form>}

      {action === 'reschedule' && (state === 'slots' || state === 'slot-conflict') && <>
        {(avail?.staff?.length || 0) > 1 && <div className="staff-picker public">
          <span>Who would you like to see?</span>
          <div className="chip-row">
            <button type="button" className={'chip' + (!staffId ? ' on' : '')} onClick={() => pickStaff('')}>Any available</button>
            {avail.staff.map(st => <button type="button" key={st.id} className={'chip' + (staffId === st.id ? ' on' : '')} onClick={() => pickStaff(st.id)}>{st.name}</button>)}
          </div>
        </div>}
        {message && <p className="public-message">{message}</p>}
        {slots.length > 0 && <div className="slot-grid">
          {slots.map(s => <button key={s.start_at} className="slot-btn" onClick={() => chooseSlot(s.start_at)}>
            {publicTime(s.start_at)}
          </button>)}
        </div>}
        {publicTz && slots.length > 0 && <p className="public-tz">Times shown in {publicTz.replace(/_/g, ' ')}.</p>}
        <div className="public-actions">
          <button className="ghost" onClick={() => { setState('choose-date'); setSlots([]); setMessage('') }}>Choose another date</button>
          {!avail?.closed && <button className="ghost" onClick={joinWaitlist}>Join waitlist for this date</button>}
        </div>
      </>}

      {state === 'loading-slots' && <p className="public-message">Checking live availability…</p>}
      {state === 'working' && <p className="public-message">Processing your request…</p>}
      {(state === 'success' || state === 'error') && <p className="public-message">{message}</p>}
      {state === 'error' && action === 'reschedule' && <button className="ghost wide" onClick={() => { setState('choose-date'); setMessage('') }}>Try another date</button>}
    </div>
  </div>
}

function SetNewPasswordScreen({ onDone }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  async function save(e) {
    e.preventDefault(); setMsg('')
    if (password.length < 8) return setMsg('Use at least 8 characters.')
    if (password !== confirm) return setMsg('The two passwords don\'t match.')
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) return setMsg(error.message)
    onDone()
  }

  return <div className="billing-setup-shell">
    <form className="billing-setup-card auth-box reset-card" onSubmit={save}>
      <Brand />
      <p className="kicker">RESET PASSWORD</p>
      <h2>Choose a new password</h2>
      <p className="subtle">You're verified. Set a new password to continue to your workspace.</p>
      <label>New password</label>
      <input type="password" autoComplete="new-password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters"/>
      <label>Confirm new password</label>
      <input type="password" autoComplete="new-password" required minLength={8} value={confirm} onChange={e => setConfirm(e.target.value)}/>
      <button className="primary wide" disabled={busy}>{busy ? 'Saving…' : 'Save password and continue'}</button>
      {msg && <div className="form-msg">{msg}</div>}
    </form>
  </div>
}

function AuthScreen({ onDemo, onRecoveryStart, onRecoveryFailed }) {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [otpStep, setOtpStep] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [okMsg, setOkMsg] = useState('')

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setMsg(''); setOkMsg('')

    if (mode === 'forgot') {
      if (!resetSent) {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin + '/' })
        setBusy(false)
        if (error) return setMsg(error.message)
        setResetSent(true)
        setOkMsg('If an account exists for ' + email.trim() + ', we sent a password reset email. Click the link in it, or enter the code below if your email shows one.')
        return
      }
      onRecoveryStart()
      const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: otp.trim(), type: 'recovery' })
      setBusy(false)
      if (error) { onRecoveryFailed(); setMsg(error.message) }
      return
    }

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

    if (!agreed) {
      setBusy(false)
      setMsg('Please agree to the Terms of Service and Privacy Policy to continue.')
      return
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { terms_accepted_at: new Date().toISOString(), terms_version: '2026-09-29' } }
    })
    setBusy(false)
    if (error) {
      setMsg(error.message)
      return
    }

    if (data.session) return
    setOtpStep(true)
    setMsg('We sent a verification code to your email.')
  }

  function switchMode(next) {
    setMode(typeof next === 'string' ? next : mode === 'signin' ? 'signup' : 'signin')
    setOtpStep(false)
    setResetSent(false)
    setOtp('')
    setMsg(''); setOkMsg('')
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
        <h2>{mode === 'forgot' ? 'Reset your password' : otpStep ? 'Verify your email' : mode === 'signin' ? 'Sign in to your workspace' : 'Create your workspace'}</h2>
        <p className="subtle">{mode === 'forgot'
          ? 'Enter your account email and we\'ll send you a way to set a new password.'
          : otpStep
          ? `Enter the verification code sent to ${email}.`
          : mode === 'signin'
            ? 'See what is confirmed, at risk, and already recovered.'
            : 'Create your account, then verify your email with a one-time code.'}</p>

        {mode === 'forgot' && <>
          <label>Email address</label>
          <input required type="email" autoComplete="email" value={email} disabled={resetSent} onChange={e => setEmail(e.target.value)} placeholder="you@business.com"/>
          {resetSent && <>
            <label>Reset code (if your email has one)</label>
            <input inputMode="numeric" autoComplete="one-time-code" maxLength={10} value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="Enter code"/>
          </>}
        </>}

        {mode !== 'forgot' && !otpStep && <>
          <label>Email address</label>
          <input required type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@business.com"/>
          <label>Password</label>
          <input required minLength={6} type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"/>
          {mode === 'signin' && <button type="button" className="forgot-link" onClick={() => switchMode('forgot')}>Forgot password?</button>}
          {mode === 'signup' && <label className="consent">
            <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} required/>
            <span>I'm signing up for business use and agree to the <a href="/terms" target="_blank" rel="noreferrer">Terms of Service</a> and <a href="/privacy" target="_blank" rel="noreferrer">Privacy Policy</a>, including the <a href="/dpa" target="_blank" rel="noreferrer">Data Processing Addendum</a>.</span>
          </label>}
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

        <button className="primary wide" disabled={busy || (otpStep && otp.length < 6) || (mode === 'forgot' && resetSent && otp.length < 6)}>
          {busy ? 'Working…' : mode === 'forgot' ? (resetSent ? 'Verify code' : 'Send reset email') : otpStep ? 'Verify email' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>

        {okMsg && <div className="form-ok">{okMsg}</div>}
        {msg && <div className="form-msg">{msg}</div>}

        {mode === 'forgot' ? (
          <div className="switch-auth">
            {resetSent ? <>Didn't get it? <button type="button" onClick={() => { setResetSent(false); setOtp(''); setOkMsg('') }}>Send again</button> · </> : null}
            <button type="button" onClick={() => switchMode('signin')}>Back to sign in</button>
          </div>
        ) : otpStep ? (
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
        <nav className="auth-links">
          <a href="/help">Help</a><a href="/terms">Terms</a><a href="/privacy">Privacy</a><a href="/cookies">Cookies</a><a href="/contact">Contact</a>
        </nav>
      </form>
    </section>
  </div>
}

function Brand() {
  return <div className="brand"><LogoMark size={31}/>SlotRecover</div>
}

function Dashboard({ session, demo, onExitDemo }) {
  const [nav, setNav] = useState('Overview')
  const [mobileNav, setMobileNav] = useState(false)
  const [practiceName, setPracticeName] = useState(demo ? 'Atelier No. 7' : '')
  const [practiceId, setPracticeId] = useState(null)
  const [practice, setPractice] = useState(null)
  const [services, setServices] = useState([])
  const [busy, setBusy] = useState(false)
  const [needsSetup, setNeedsSetup] = useState(false)
  const [modal, setModal] = useState(null)
  const [toast, setToast] = useState('')
  const [reminder, setReminder] = useState(null)
  const [showInstall, setShowInstall] = useState(false)
  const [msgKey, setMsgKey] = useState(0)
  const install = useInstallState()
  const emptyData = { appointments: [], revenue: 0, atRisk: 0, recoveryRate: 0, noShow: 0, recoveredSlots: 0, cancelledSlots: 0, activity: [], waitlist: [] }
  const [loaded, setLoaded] = useState(demo)
  const [data, setData] = useState(!demo ? emptyData : {
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

  // Close the mobile menu with Escape.
  useEffect(() => {
    if (!mobileNav) return
    const onKey = e => { if (e.key === 'Escape') setMobileNav(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mobileNav])

  // Notifications open /?remind=<appointment id> to jump straight to the WhatsApp reminder.
  useEffect(() => {
    if (demo || !loaded || !practice) return
    const id = new URLSearchParams(window.location.search).get('remind')
    if (!id) return
    window.history.replaceState({}, '', window.location.pathname)
    fetchReminderAppointment(id).then(a => a && setReminder(a)).catch(() => notify('Appointment not found'))
  }, [loaded, practice, demo])

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
      setLoaded(true)
      return
    }
    if (!practices?.length) {
      setData({ appointments: [], revenue: 0, atRisk: 0, recoveryRate: 0, noShow: 0, recoveredSlots: 0, cancelledSlots: 0, activity: [], waitlist: [] })
      setPracticeName('Your practice')
      setPracticeId(null)
      setPractice(null)
      setServices([])
      setNeedsSetup(true)
      setBusy(false)
      setLoaded(true)
      return
    }

    const p = practices[0]
    setMoneyCurrency(p.currency)
    setPractice(p)
    setPracticeName(p.name)
    setPracticeId(p.id)
    setNeedsSetup(false)
    const today = new Date(); today.setHours(0,0,0,0)

    const [{ data: svc }, { data: appts }, { data: rev }, { data: offers }, { data: waitlist }] = await Promise.all([
      supabase.from('services').select('id,name,duration_minutes,price_cents').eq('practice_id', p.id).eq('active', true).order('created_at'),
      supabase.from('appointments')
        .select(reminderSelect)
        .eq('practice_id', p.id).gte('start_at', today.toISOString()).order('start_at').limit(20),
      supabase.from('revenue_events').select('id,event_type,amount_cents,created_at').eq('practice_id', p.id).order('created_at',{ascending:false}).limit(30),
      supabase.from('recovery_offers')
        .select('id,status,offered_at,expires_at,clients(first_name,last_name),appointments(start_at,services(name,price_cents))')
        .eq('practice_id', p.id).order('offered_at',{ascending:false}).limit(20),
      supabase.from('waitlist_entries')
        .select('id,status,window_start,window_end,min_notice_minutes,clients(first_name,last_name),services(name,price_cents),staff(name)')
        .eq('practice_id', p.id).order('created_at',{ascending:false}).limit(20)
    ])

    setServices(svc || [])

    const appointments = (appts || []).map(a => ({
      id: a.id,
      time: new Date(a.start_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', timeZone: p.timezone }),
      date: new Date(a.start_at).toLocaleDateString([], { month:'short', day:'numeric', timeZone: p.timezone }),
      client: [a.clients?.first_name || 'Client', a.clients?.last_name || ''].join(' ').trim(),
      service: a.services?.name || 'Service',
      staff: a.staff?.name || '',
      raw: a,
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
        service:(w.services?.name||'Service') + (w.staff?.name ? ' · with ' + w.staff.name : ''),
        status:w.status,
        window:formatWindow(w.window_start, w.window_end, p.timezone),
        value:(w.services?.price_cents||0)/100
      }))
    })
    setBusy(false)
    setLoaded(true)
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
    {mobileNav && <div className="nav-backdrop" onClick={() => setMobileNav(false)} aria-hidden="true"/>}
    <aside className={'sidebar ' + (mobileNav ? 'open' : '')}>
      <Brand />
      <button className="close-nav" onClick={() => setMobileNav(false)}><X size={20}/></button>
      <div className="practice-chip">
        <div className="avatar">{(practiceName || '··').slice(0,2).toUpperCase()}</div>
        <div><strong>{practiceName || 'Loading…'}</strong><span>{demo ? 'Demo workspace' : 'Live workspace'}</span></div>
        <ChevronRight size={16}/>
      </div>
      <nav>
        {navItems.map(([label, Icon]) => <button key={label} className={nav === label ? 'active' : ''} onClick={() => { setNav(label); setMobileNav(false) }}>
          <Icon size={18}/>{label}{label === 'Recovery' && <span className="new-badge">CORE</span>}
        </button>)}
      </nav>
      <div className="sidebar-bottom">
        {!install.standalone && <button onClick={() => { setShowInstall(true); setMobileNav(false) }}><Download size={18}/>Install app</button>}
        <button onClick={() => { window.location.href = '/help' }}><HelpCircle size={18}/>Help Center</button>
        <button className={nav === 'Settings' ? 'active' : ''} onClick={() => { setNav('Settings'); setMobileNav(false) }}><Settings size={18}/>Settings</button>
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
          <div className="profile"><div className="profile-avatar">{((session?.user?.user_metadata?.full_name || session?.user?.email || 'Demo User').split(/[\s@.]+/).filter(Boolean).map(x => x[0]).slice(0, 2).join('') || 'SR').toUpperCase()}</div><span>{session?.user?.email || 'Demo user'}</span></div>
        </div>
      </header>

      {!demo && <BillingBanner session={session} onOpenSettings={() => setNav('Settings')} />}
      {!loaded ? <div className="boot inline"><div className="spinner" />Loading your workspace…</div> :
        needsSetup && !demo ? <Onboarding session={session} onDone={loadLive}/> :
        nav === 'Overview' ? <Overview data={data} busy={busy} refresh={loadLive} demo={demo} onNew={() => setModal('appointment')} onRemind={demo ? null : a => setReminder(a.raw)}/> :
        nav === 'Appointments' ? <Appointments appointments={data.appointments} onNew={() => setModal('appointment')} onRemind={demo ? null : a => setReminder(a.raw)}/> :
        nav === 'Recovery' ? <Recovery waitlist={data.waitlist} onNew={() => setModal('appointment')}/> :
        nav === 'Clients' ? <EmptyPanel title="Client intelligence" text="Client history, confirmation behavior, and waitlist preferences will live here." icon={UsersRound}/> :
        nav === 'Messaging' ? <MessagingPage practice={practice} demo={demo} refreshKey={msgKey} onRemind={demo ? null : a => setReminder(a)}/> :
        <SettingsPage practice={practice} demo={demo} notify={notify} onChanged={loadLive}/>
      }
    </main>

    {modal === 'appointment' && (demo
      ? <DemoNotice onClose={() => setModal(null)}/>
      : <AppointmentModal practiceId={practiceId} practice={practice} services={services} onClose={() => setModal(null)} onSaved={kind => { setModal(null); notify(kind === 'waitlist' ? 'Added to the waitlist' : 'Appointment created'); loadLive() }}/>)}
    {showInstall && <InstallModal onClose={() => setShowInstall(false)}/>}
    {reminder && <ReminderModal appointment={reminder} practice={practice} onClose={() => setReminder(null)} onSent={() => setMsgKey(k => k + 1)}/>}
    {toast && <div className="toast">{toast}</div>}
  </div>
}

function BillingBanner({ session, onOpenSettings }) {
  const [billing, setBilling] = useState(null)

  useEffect(() => {
    if (!session || !supabase) return
    fetchBillingStatus().then(setBilling).catch(() => {})
  }, [session?.user?.id])

  if (!billing) return null
  const until = accessUntil(billing)
  const fmt = d => d ? new Date(d).toLocaleDateString([], { month: 'short', day: 'numeric' }) : ''
  const trialMs = new Date(billing.trial_ends_at).getTime() - Date.now()
  const daysLeft = Math.max(0, Math.ceil(trialMs / 86400000))

  let title, text
  if (billing.status === 'cancelled' || billing.cancel_at_period_end) {
    title = 'Subscription cancelled'
    text = 'You have access until ' + fmt(until) + '. Restart any time from Settings.'
  } else if (billing.status === 'past_due') {
    title = 'Payment failed'
    text = 'Razorpay could not charge your payment method. Update it to avoid interruption.'
  } else if (trialMs > 0) {
    title = 'Free trial · billing authorized'
    text = daysLeft + ' day' + (daysLeft === 1 ? '' : 's') + ' left. Your plan starts on ' + fmt(billing.trial_ends_at) + ' unless you cancel.'
  } else {
    return null
  }

  return <div className="billing-banner">
    <div><strong>{title}</strong><span>{text}</span></div>
    <button className="ghost" onClick={onOpenSettings}>Manage subscription</button>
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

function Overview({ data, busy, refresh, demo, onNew, onRemind }) {
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
          {data.appointments.length ? data.appointments.slice(0,8).map(a => <AppointmentRow key={a.id} a={a} onRemind={onRemind}/>) :
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

function AppointmentRow({ a, onRemind }) {
  const map = {
    confirmed:['Confirmed','ok'], awaiting:['Awaiting reply','wait'], 'at-risk':['At risk','danger'],
    recovered:['Recovered','recover'], booked:['Booked','wait'], cancelled:['Cancelled','danger'],
    completed:['Completed','ok'], no_show:['No-show','danger']
  }
  const [label,tone] = map[a.status] || [a.status,'wait']
  const canRemind = onRemind && a.raw && ['booked','confirmed'].includes(a.status) && new Date(a.raw.start_at) > new Date()
  return <div className={'appt-row' + (onRemind ? ' with-action' : '')}>
    <div className="appt-time">{a.date && <small>{a.date}</small>}{a.time}</div>
    <div className="client-cell"><div className="tiny-avatar">{a.client.split(' ').map(x=>x[0]).slice(0,2).join('')}</div><div><strong>{a.client}</strong><span>{a.service}{a.staff && <> · <b className="appt-staff">{a.staff}</b></>}</span></div></div>
    <div className="appt-value">{money(a.value)}</div>
    <div><span className={'status ' + tone}>{tone === 'recover' && <RefreshCw size={12}/>} {label}</span></div>
    {onRemind && <div className="appt-action">{canRemind && <button className="wa-btn" title="Send WhatsApp reminder" aria-label={'Send WhatsApp reminder to ' + a.client} onClick={() => onRemind(a)}><MessageCircleMore size={16}/></button>}</div>}
  </div>
}

function Appointments({ appointments, onNew, onRemind }) {
  return <div className="page">
    <div className="page-heading"><div><div className="eyebrow-dark">SCHEDULE</div><h1>Appointments</h1><p>Every booking, confirmation, cancellation, and refill in one place.</p></div><button className="primary" onClick={onNew}><Plus size={17}/>New appointment</button></div>
    <section className="panel table-panel">
      <div className="filters"><button className="filter active">Upcoming</button></div>
      {appointments.length ? appointments.map(a => <AppointmentRow a={a} key={a.id} onRemind={onRemind}/>) : <div className="empty-inline"><CalendarDays size={22}/><strong>No appointments yet</strong><span>Create one to begin scheduling.</span></div>}
    </section>
  </div>
}

function Recovery({ waitlist, onNew }) {
  return <div className="page">
    <div className="page-heading"><div><div className="eyebrow-dark">AUTOMATED CAPACITY RECOVERY</div><h1>Recovery engine</h1><p>Turn cancellations into a sequenced waitlist offer before the slot goes cold.</p></div></div>
    <div className="recovery-flow">
      <FlowStep n="01" title="Cancellation detected" text="The original appointment is marked at risk and the slot becomes recoverable." icon={XCircle}/>
      <FlowStep n="02" title="Best waitlist match" text="Service, timing, notice preference, and priority determine who gets the offer first." icon={UsersRound}/>
      <FlowStep n="03" title="15-minute offer" text="No response automatically advances to the next matching client." icon={Clock3}/>
      <FlowStep n="04" title="Revenue recovered" text="The replacement appointment is booked and attributed to recovered revenue." icon={CircleDollarSign}/>
    </div>
    <section className="panel waitlist-panel">
      <div className="panel-head"><div><h2>Current waitlist</h2><p>Clients waiting for a time that was booked. Added from New appointment or the client reschedule page.</p></div></div>
      {waitlist?.length ? waitlist.map(w => <div className="wait-row" key={w.id}>
        <div className="tiny-avatar">{w.client.split(' ').map(x=>x[0]).slice(0,2).join('')}</div>
        <div><strong>{w.client}</strong><span>{w.service} · {w.window}</span></div>
        <div className="appt-value">{money(w.value)}</div>
        <span className={'status ' + (w.status === 'active' ? 'ok' : 'wait')}>{w.status}</span>
      </div>) : <div className="empty-inline"><UsersRound size={22}/><strong>No waitlist entries</strong><span>When a client's preferred time is taken in New appointment, add them to the waitlist from there.</span><button className="ghost small" onClick={onNew}><Plus size={15}/>New appointment</button></div>}
    </section>
  </div>
}

function FlowStep({ n, title, text, icon: Icon }) {
  return <div className="flow-step"><div className="flow-top"><span>{n}</span><div className="flow-icon"><Icon size={18}/></div></div><h3>{title}</h3><p>{text}</p></div>
}

function DemoNotice({ onClose }) {
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
    <div className="modal-card"><div className="modal-form">
      <h2 className="demo-title">Demo workspace</h2>
      <p className="confirm-text">Booking is disabled in the demo. Create a free account to add appointments, see live availability and build a waitlist.</p>
      <div className="modal-actions"><button className="primary" onClick={onClose}>Got it</button></div>
    </div></div>
  </div>
}

function formatWindow(start, end, tz) {
  const opts = { timeZone: tz || undefined }
  const d = x => new Date(x).toLocaleDateString([], { ...opts, month: 'short', day: 'numeric' })
  const t = x => new Date(x).toLocaleTimeString([], { ...opts, hour: 'numeric', minute: '2-digit' })
  return d(start) === d(end) ? d(start) + ', ' + t(start) + ' – ' + t(end) : d(start) + ' ' + t(start) + ' – ' + d(end) + ' ' + t(end)
}

function EmptyPanel({ title, text, icon: Icon }) {
  return <div className="page"><div className="empty-page"><div className="empty-big"><Icon size={28}/></div><h1>{title}</h1><p>{text}</p><button className="ghost">Preview planned workflow <ArrowUpRight size={16}/></button></div></div>
}

registerServiceWorker()
createRoot(document.getElementById('root')).render(<App />)
