// Fake Supabase client used only to render marketing screenshots of the real app.
// Everything here is invented sample data for a fictional salon. Never shipped to users.

const TZ = 'America/New_York'
const OFFSET = '-04:00' // EDT; fine for screenshot purposes

function nyDate(dayOffset = 0) {
  const d = new Date(Date.now() + dayOffset * 864e5)
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}
const at = (day, hh, mm = 0) => `${nyDate(day)}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00${OFFSET}`
const ago = mins => new Date(Date.now() - mins * 60000).toISOString()

const user = { id: 'u1', email: 'maya@luxehairstudio.com', user_metadata: { full_name: 'Maya Lopez' } }
const session = { user, access_token: 'x' }

const practice = {
  id: 'p1', owner_id: 'u1', name: 'Luxe Hair Studio', timezone: TZ, currency: 'USD', contact_email: 'hello@luxehair.example',
  open_time: '09:00', close_time: '18:00', working_days: [1, 2, 3, 4, 5, 6], slot_interval_minutes: 30,
  client_note: 'Please arrive 5 minutes early. Free parking behind the salon.', default_country_code: '1', created_at: ago(90000),
}

const services = [
  { id: 's1', name: 'Balayage & finish', duration_minutes: 150, price_cents: 18000, active: true },
  { id: 's2', name: 'Cut & style', duration_minutes: 60, price_cents: 8500, active: true },
  { id: 's3', name: 'Color correction', duration_minutes: 180, price_cents: 24000, active: true },
  { id: 's4', name: 'Root touch-up', duration_minutes: 90, price_cents: 12000, active: true },
  { id: 's5', name: 'Blowout', duration_minutes: 45, price_cents: 5500, active: true },
]
const svc = id => { const s = services.find(x => x.id === id); return { name: s.name, price_cents: s.price_cents } }
const staff = [{ id: 't1', name: 'Jess', active: true }, { id: 't2', name: 'Marco', active: true }, { id: 't3', name: 'Priya', active: true }]
const st = id => ({ name: staff.find(x => x.id === id).name })

const clients = {
  olivia: { first_name: 'Olivia', last_name: 'Martin', phone: '+12125550143', email: 'olivia@example.com' },
  sophia: { first_name: 'Sophia', last_name: 'Chen', phone: '+12125550178', email: 'sophia@example.com' },
  ava: { first_name: 'Ava', last_name: 'Johnson', phone: '+12125550112', email: 'ava@example.com' },
  emma: { first_name: 'Emma', last_name: 'Davis', phone: '+12125550166', email: 'emma@example.com' },
  noah: { first_name: 'Noah', last_name: 'Williams', phone: '+12125550190', email: 'noah@example.com' },
  lily: { first_name: 'Lily', last_name: 'Brooks', phone: '+12125550121', email: 'lily@example.com' },
  grace: { first_name: 'Grace', last_name: 'Kim', phone: '+12125550155', email: 'grace@example.com' },
  zoe: { first_name: 'Zoe', last_name: 'Parker', phone: '+12125550137', email: 'zoe@example.com' },
  hannah: { first_name: 'Hannah', last_name: 'Reed', phone: '+12125550184', email: 'hannah@example.com' },
}

const appt = (id, day, hh, mm, s, t, c, status, extra = {}) => ({
  id, start_at: at(day, hh, mm), status, public_token: 'tok' + id, rescheduled_to_id: null,
  services: svc(s), clients: clients[c], staff: st(t), confirmed_at: status === 'confirmed' ? ago(300) : null, cancelled_at: null, ...extra,
})
const appointments = [
  appt('a1', 0, 9, 30, 's1', 't1', 'olivia', 'confirmed'),
  appt('a2', 0, 11, 0, 's2', 't2', 'sophia', 'booked'),
  appt('a3', 0, 13, 30, 's4', 't3', 'ava', 'confirmed', { recovered: true }),
  appt('a4', 0, 15, 0, 's5', 't1', 'emma', 'confirmed'),
  appt('a5', 0, 16, 30, 's2', 't2', 'noah', 'booked'),
  appt('a6', 1, 10, 0, 's3', 't1', 'lily', 'confirmed'),
  appt('a7', 1, 12, 30, 's2', 't3', 'grace', 'booked'),
  appt('a8', 1, 14, 0, 's4', 't2', 'zoe', 'confirmed'),
]

const revenue_events = [
  { id: 'r1', event_type: 'recovered', amount_cents: 12000, created_at: ago(35) },
  { id: 'r2', event_type: 'at_risk', amount_cents: 12000, created_at: ago(52) },
  { id: 'r3', event_type: 'recovered', amount_cents: 18000, created_at: ago(60 * 26) },
  { id: 'r4', event_type: 'at_risk', amount_cents: 18000, created_at: ago(60 * 27) },
  { id: 'r5', event_type: 'recovered', amount_cents: 24000, created_at: ago(60 * 50) },
  { id: 'r6', event_type: 'at_risk', amount_cents: 24000, created_at: ago(60 * 51) },
  { id: 'r7', event_type: 'recovered', amount_cents: 8500, created_at: ago(60 * 75) },
  { id: 'r8', event_type: 'at_risk', amount_cents: 8500, created_at: ago(60 * 76) },
  { id: 'r9', event_type: 'recovered', amount_cents: 12000, created_at: ago(60 * 100) },
  { id: 'r10', event_type: 'at_risk', amount_cents: 12000, created_at: ago(60 * 101) },
  { id: 'r11', event_type: 'recovered', amount_cents: 18000, created_at: ago(60 * 140) },
  { id: 'r12', event_type: 'at_risk', amount_cents: 18000, created_at: ago(60 * 141) },
  { id: 'r13', event_type: 'recovered', amount_cents: 5500, created_at: ago(60 * 170) },
  { id: 'r14', event_type: 'at_risk', amount_cents: 5500, created_at: ago(60 * 171) },
  { id: 'r15', event_type: 'recovered', amount_cents: 18000, created_at: ago(60 * 200) },
  { id: 'r16', event_type: 'at_risk', amount_cents: 18000, created_at: ago(60 * 201) },
  { id: 'r17', event_type: 'at_risk', amount_cents: 8500, created_at: ago(60 * 220) },
  { id: 'r18', event_type: 'at_risk', amount_cents: 12000, created_at: ago(60 * 230) },
]

const recovery_offers = [
  { id: 'o1', status: 'accepted', offered_at: ago(40), expires_at: ago(25), responded_at: ago(36), notified_at: ago(40), notification_error: null, clients: clients.ava, appointments: { start_at: at(0, 13, 30), services: svc('s4'), staff: st('t3') } },
  { id: 'o2', status: 'expired', offered_at: ago(50), expires_at: ago(35), responded_at: null, notified_at: ago(50), notification_error: null, clients: clients.hannah, appointments: { start_at: at(0, 13, 30), services: svc('s4'), staff: st('t3') } },
  { id: 'o3', status: 'accepted', offered_at: ago(60 * 26), expires_at: ago(60 * 26 - 15), responded_at: ago(60 * 26 - 6), notified_at: ago(60 * 26), notification_error: null, clients: clients.lily, appointments: { start_at: at(-1, 10, 0), services: svc('s1'), staff: st('t1') } },
]

const waitlist_entries = [
  { id: 'w1', status: 'active', window_start: at(0, 15, 0), window_end: at(0, 15, 0), min_notice_minutes: 60, clients: clients.hannah, services: svc('s5'), staff: st('t1') },
  { id: 'w2', status: 'active', window_start: at(1, 10, 0), window_end: at(1, 10, 0), min_notice_minutes: 120, clients: clients.zoe, services: svc('s3'), staff: st('t1') },
  { id: 'w3', status: 'active', window_start: at(1, 12, 30), window_end: at(1, 12, 30), min_notice_minutes: 60, clients: clients.noah, services: svc('s2'), staff: null },
  { id: 'w4', status: 'offered', window_start: at(2, 11, 0), window_end: at(2, 11, 0), min_notice_minutes: 60, clients: clients.grace, services: svc('s4'), staff: st('t2') },
]

const reminder_jobs = appointments.slice(0, 7).map((a, i) => ({
  id: 'j' + i, channel: 'email', template_key: 'confirm_24h', status: 'sent', scheduled_for: ago(60 * (20 - i)), sent_at: ago(60 * (20 - i)),
  last_error: null, created_at: ago(60 * (20 - i)), appointments: a,
}))
const message_events = [
  { id: 'm1', channel: 'whatsapp', kind: 'reminder', created_at: ago(95), appointments: appointments[1] },
  { id: 'm2', channel: 'whatsapp', kind: 'reminder', created_at: ago(180), appointments: appointments[4] },
]

const staff_services = staff.flatMap(t => services.map(s => ({ staff_id: t.id, service_id: s.id })))

const billing = {
  status: 'active', trial_started_at: ago(60 * 24 * 20), trial_ends_at: ago(60 * 24 * 13), current_period_end: new Date(Date.now() + 17 * 864e5).toISOString(),
  cancel_at_period_end: false, razorpay_subscription_id: 'sub_x', authorization_verified_at: ago(60 * 24 * 20),
  billing_plans: { name: 'SlotRecover', amount_paise: 2900, currency: 'USD', period: 'monthly', trial_days: 7 },
}

const tables = {
  practices: [practice], services, appointments, revenue_events, recovery_offers, waitlist_entries,
  reminder_jobs, message_events, staff, staff_services, billing_accounts: [billing], push_subscriptions: [],
}

function builder(table) {
  let rows = tables[table] || []
  let single = false
  const b = {
    select() { return b }, eq() { return b }, gte() { return b }, lte() { return b }, in() { return b }, is() { return b },
    order() { return b }, limit(n) { rows = rows.slice(0, n); return b },
    insert() { return b }, update() { return b }, upsert() { return b }, delete() { return b },
    single() { single = true; return b }, maybeSingle() { single = true; return b },
    then(resolve, reject) { return Promise.resolve({ data: single ? rows[0] || null : rows, error: null }).then(resolve, reject) },
  }
  return b
}

// Slots for the New appointment screen: every 30 min, 9:00–17:30, a few fully booked.
function availability({ p_date, p_staff_id }) {
  const booked = new Set(['09:30', '11:00', '13:30', '15:00'])
  const busyish = { '10:00': 1, '12:00': 1, '14:30': 2, '16:30': 1 }
  const slots = []
  for (let m = 9 * 60; m <= 17 * 60 + 30; m += 30) {
    const hh = String(Math.floor(m / 60)).padStart(2, '0'), mm = String(m % 60).padStart(2, '0')
    const key = `${hh}:${mm}`
    const full = booked.has(key)
    slots.push({ start_at: `${p_date}T${key}:00${OFFSET}`, available: !full, free_count: full ? 0 : p_staff_id ? 1 : 3 - (busyish[key] || 0) })
  }
  return { closed: false, slots, staff: staff.map(({ id, name }) => ({ id, name })) }
}

export const supabaseConfigured = true
export const supabase = {
  auth: {
    getSession: async () => ({ data: { session } }),
    getUser: async () => ({ data: { user } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signOut: async () => ({}), updateUser: async () => ({ error: null }), signInWithPassword: async () => ({ error: null }),
  },
  from: builder,
  rpc: async (name, args) => name === 'get_practice_availability' ? { data: availability(args), error: null } : { data: null, error: null },
  functions: {
    invoke: async (name, { body } = {}) => {
      if (name === 'slotrecover-billing') return { data: { ok: true, billing }, error: null }
      return { data: { ok: true }, error: null }
    },
  },
}
