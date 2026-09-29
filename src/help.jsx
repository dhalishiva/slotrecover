import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, HelpCircle, Mail, Search, X, BookOpen } from 'lucide-react'
import { site } from './siteConfig'
import { SiteHeader, SiteFooter } from './legal'

// Keep answers accurate to what the product does today. Update as features ship.
export const faqs = [
  // Getting started
  { c: 'Getting started', q: 'What does SlotRecover do?', a: `SlotRecover asks your clients to confirm upcoming appointments, notices cancellations and reschedules straight away, and offers the released slot to the best-matching client on your waitlist. When someone takes the slot, the recovered revenue shows up on your dashboard.`, t: 'overview how it works recover revenue' },
  { c: 'Getting started', q: 'How do I set up my workspace?', a: `After you sign up and verify your email, you start the ${site.trialDays}-day trial and then create your workspace with your business name, your first service and its price. You can then add appointments and waitlist entries.`, t: 'onboarding setup practice workspace' },
  { c: 'Getting started', q: 'Can I try it without signing up?', a: 'Yes. Choose "Explore demo workspace" on the sign-in screen to look around with sample data. Nothing you do in the demo is saved.', t: 'demo try sample' },
  { c: 'Getting started', q: 'Who is SlotRecover for?', a: 'Appointment-based businesses where an empty slot means lost revenue: salons, spas, studios, trainers, consultants, tutors, wellness practices and similar businesses.', t: 'industries salon spa who' },

  // Appointments & confirmations
  { c: 'Appointments', q: 'How do I add an appointment?', a: 'Click "New appointment", enter the client\'s details, pick the service and date, then choose one of the free times shown. Times follow your opening hours and timezone, and booked times are greyed out.', t: 'create new appointment booking add' },
  { c: 'Appointments', q: 'When are confirmation emails sent?', a: 'SlotRecover checks every 5 minutes for booked appointments starting within the next 24 hours and sends each one a single confirmation email with Confirm, Reschedule and Cancel buttons. It never sends the same confirmation twice.', t: 'reminder confirmation email 24 hours when' },
  { c: 'Appointments', q: 'What happens when a client confirms?', a: 'The appointment status changes to Confirmed and the time is recorded. Nothing else is sent.', t: 'confirm confirmed status' },
  { c: 'Appointments', q: 'What happens when a client cancels?', a: 'The appointment is marked Cancelled, its value counts as revenue at risk, and SlotRecover immediately looks for a matching waitlisted client to offer the slot to.', t: 'cancel cancellation at risk' },
  { c: 'Appointments', q: 'How does rescheduling work?', a: 'The client picks a preferred date and sees the times that are actually free. SlotRecover re-checks the time when they choose it so two people can\'t take the same slot, moves the booking, and then offers the old slot to your waitlist.', t: 'reschedule move change time availability' },
  { c: 'Appointments', q: 'Can I set my business hours?', a: 'Yes. Go to Settings → Opening hours to choose your working days, opening and closing times, and slot spacing. Your timezone is under Settings → Business details. Available times for new bookings and client reschedules follow these settings.', t: 'business hours working hours timezone days off settings' },
  { c: 'Appointments', q: 'Can I edit or cancel an appointment myself?', a: `Editing, manual cancel and confirm, and no-show tracking are on the way. Until then, email ${site.supportEmail} and we'll help.`, t: 'edit change manual cancel no-show' },

  // Waitlist & recovery
  { c: 'Waitlist & recovery', q: 'How do I add someone to the waitlist?', a: 'In New appointment, click a time marked "Booked". You can add the client to the waitlist for that exact time or for any time that day. If the slot opens up, they get an offer automatically.', t: 'waitlist add join booked full' },
  { c: 'Waitlist & recovery', q: 'How is a waitlisted client chosen for a slot?', a: 'SlotRecover looks for active waitlist entries for the same service whose time window includes the free slot and whose minimum notice can be met. It then picks by priority and by who joined first.', t: 'matching priority chosen order' },
  { c: 'Waitlist & recovery', q: 'How long does a client have to accept an offer?', a: `Each offer lasts ${site.offerExpiryMinutes} minutes. If the client declines or doesn't answer in time, the slot is offered to the next matching client automatically.`, t: 'offer expiry expire minutes accept decline' },
  { c: 'Waitlist & recovery', q: 'How is recovered revenue calculated?', a: 'When a cancelled slot is taken by a waitlisted client, the service price of the new appointment is recorded as recovered revenue. Revenue at risk is the price of cancelled appointments.', t: 'recovered revenue metric dashboard calculation' },
  { c: 'Waitlist & recovery', q: 'Can clients join the waitlist themselves?', a: 'Yes, from the reschedule page. If no time works on the day they want, they can join the waitlist for that date.', t: 'self join waitlist client' },

  // Billing
  { c: 'Billing & trial', q: 'How does the free trial work?', a: `You get ${site.trialDays} days free. You authorise a recurring payment with Razorpay when you start, but you aren't charged the subscription fee until the trial ends. Cancel before it ends and you pay nothing.`, t: 'trial free days charge' },
  { c: 'Billing & trial', q: 'Why do I need to add a payment method for a free trial?', a: 'So your subscription can continue without interruption when the trial ends. Your bank may show a small temporary authorisation that is reversed automatically.', t: 'card payment method authorization mandate' },
  { c: 'Billing & trial', q: 'How do I cancel my subscription?', a: `Go to Settings → Subscription and click "Cancel subscription". If you're still in your trial you won't be charged at all. Otherwise renewal stops and you keep access until the end of the period you paid for. You can also email ${site.billingEmail}.`, t: 'cancel subscription stop billing' },
  { c: 'Billing & trial', q: 'Do you offer refunds?', a: 'Fees are generally non-refundable for partial periods. We refund duplicate or mistaken charges, and first charges if you forgot to cancel your trial and contact us within 7 days without using the paid Service. See the Refund & Cancellation Policy for details.', t: 'refund money back' },
  { c: 'Billing & trial', q: 'Who is "Dhali Services" on my statement?', a: `${site.company} is the company that operates SlotRecover, so charges appear under that name.`, t: 'statement charge name dhali services' },

  // Privacy & security
  { c: 'Privacy & security', q: 'Is my clients\' data safe?', a: 'Each business\'s data is kept separate with database row-level security, encrypted in transit and at rest, and only used to run the Service. We never sell data or use advertising trackers.', t: 'security safe encryption data' },
  { c: 'Privacy & security', q: 'Is SlotRecover GDPR and CCPA compliant?', a: 'We act as your processor for client data under our Data Processing Addendum (with EU Standard Contractual Clauses), offer data access and deletion, and list every subprocessor. You remain responsible for your own obligations as the controller.', t: 'gdpr ccpa compliance dpa europe california' },
  { c: 'Privacy & security', q: 'Can I store health information?', a: 'No. SlotRecover is not HIPAA-compliant and we don\'t sign Business Associate Agreements. Keep appointment details generic, for example "Consultation", and don\'t enter diagnoses or treatment notes.', t: 'hipaa health medical phi baa' },
  { c: 'Privacy & security', q: 'How do I delete my account or export my data?', a: `Email ${site.privacyEmail} from your account email. We'll export your data on request and delete it within 30 days of cancellation, except records we must keep for tax purposes.`, t: 'delete account export data gdpr erase' },
  { c: 'Privacy & security', q: 'I didn\'t receive my verification code', a: 'Check your spam or promotions folder, wait a minute, and make sure the email address is correct. The code can be 6–10 digits. If it still doesn\'t arrive, contact support.', t: 'otp code verification email not received' },
]

export const categories = [...new Set(faqs.map(f => f.c))]

export function searchFaqs(query) {
  const q = query.toLowerCase().trim()
  if (!q) return faqs
  const words = q.split(/\s+/).filter(w => w.length > 1)
  return faqs
    .map(f => {
      const hay = { q: f.q.toLowerCase(), t: f.t.toLowerCase(), a: f.a.toLowerCase() }
      let score = hay.q.includes(q) ? 10 : 0
      for (const w of words) {
        if (hay.q.includes(w)) score += 4
        if (hay.t.includes(w)) score += 3
        if (hay.a.includes(w)) score += 1
      }
      return [score, f]
    })
    .filter(([s]) => s > 0)
    .sort((a, b) => b[0] - a[0])
    .map(([, f]) => f)
}

function FaqItem({ f, open, onToggle }) {
  return <div className={'faq-item' + (open ? ' open' : '')}>
    <button type="button" onClick={onToggle} aria-expanded={open}>
      <span>{f.q}</span><ChevronDown size={16}/>
    </button>
    {open && <p>{f.a}</p>}
  </div>
}

export function HelpCenter() {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(null)
  const results = useMemo(() => searchFaqs(query), [query])
  const grouped = query.trim()
    ? (results.length ? [[`${results.length} result${results.length === 1 ? '' : 's'}`, results]] : [])
    : categories.map(c => [c, results.filter(f => f.c === c)]).filter(([, list]) => list.length)

  return <div className="site-shell">
    <SiteHeader />
    <div className="help-hero">
      <p className="legal-kicker">Help Center</p>
      <h1>How can we help?</h1>
      <label className="help-search">
        <Search size={18}/>
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search e.g. cancel, waitlist, trial, GDPR" autoFocus/>
      </label>
    </div>
    <div className="help-body">
      {grouped.length === 0 && <div className="help-empty">
        <p>No answers match "{query}".</p>
        <a className="primary" href={'mailto:' + site.supportEmail + '?subject=' + encodeURIComponent('Question: ' + query)}><Mail size={16}/> Ask support</a>
      </div>}
      {grouped.map(([c, list]) => <section key={c} className="help-section">
        <h2>{c}</h2>
        {list.map(f => <FaqItem key={f.q} f={f} open={open === f.q} onToggle={() => setOpen(open === f.q ? null : f.q)}/>)}
      </section>)}
      <div className="help-contact">
        <div><strong>Still stuck?</strong><span>We reply within one business day.</span></div>
        <a className="primary" href={'mailto:' + site.supportEmail}><Mail size={16}/> Email support</a>
      </div>
    </div>
    <SiteFooter />
  </div>
}

const suggested = ['When are confirmation emails sent?', 'How long does a client have to accept an offer?', 'How does the free trial work?', 'How do I cancel my subscription?']

export function HelpBubble() {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(null)
  const panelRef = useRef(null)
  const results = useMemo(() => query.trim() ? searchFaqs(query).slice(0, 6) : faqs.filter(f => suggested.includes(f.q)), [query])

  useEffect(() => {
    if (!isOpen) return
    const onKey = e => { if (e.key === 'Escape') setIsOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen])

  return <>
    {isOpen && <div className="help-panel" ref={panelRef} role="dialog" aria-label="Help">
      <div className="help-panel-head">
        <div><strong>Quick help</strong><span>Answers to common questions</span></div>
        <button type="button" className="help-close" onClick={() => setIsOpen(false)} aria-label="Close help"><X size={18}/></button>
      </div>
      <label className="help-panel-search">
        <Search size={16}/>
        <input autoFocus value={query} onChange={e => { setQuery(e.target.value); setActive(null) }} placeholder="Type your question…"/>
      </label>
      <div className="help-panel-list">
        {!query.trim() && <p className="help-panel-label">Popular</p>}
        {results.length === 0 && <div className="help-panel-empty">
          <p>No quick answer for that yet.</p>
          <a href={'mailto:' + site.supportEmail + '?subject=' + encodeURIComponent('Question: ' + query)}>Ask our team →</a>
        </div>}
        {results.map(f => <FaqItem key={f.q} f={f} open={active === f.q} onToggle={() => setActive(active === f.q ? null : f.q)}/>)}
      </div>
      <div className="help-panel-foot">
        <a href="/help"><BookOpen size={15}/> Help Center</a>
        <a href={'mailto:' + site.supportEmail}><Mail size={15}/> Email support</a>
      </div>
    </div>}
    <button type="button" className={'help-bubble' + (isOpen ? ' is-open' : '')} onClick={() => setIsOpen(!isOpen)} aria-label={isOpen ? 'Close help' : 'Open help'}>
      {isOpen ? <X size={22}/> : <HelpCircle size={24}/>}
    </button>
  </>
}
