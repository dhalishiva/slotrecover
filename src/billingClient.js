import { supabase } from './supabase'
import { invokeError } from './ui'

// Visitor's pricing currency: country from Vercel's edge (/api/geo), else a timezone guess.
let currencyPromise = null
export function detectCurrency() {
  if (!currencyPromise) {
    const guess = () => {
      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''
        if (tz === 'Europe/London') return 'GBP'
        if (/^Europe\//.test(tz)) return 'EUR'
      } catch {}
      return 'USD'
    }
    currencyPromise = fetch('/api/geo').then(r => (r.ok ? r.json() : null)).then(d => d?.currency || guess()).catch(guess)
  }
  return currencyPromise
}

// Access continues after cancellation until the paid/trial period ends.
export function accessUntil(billing) {
  if (!billing) return null
  const dates = [billing.trial_ends_at, billing.current_period_end].filter(Boolean).map(d => new Date(d).getTime())
  return dates.length ? new Date(Math.max(...dates)) : null
}

// Months covered by one billing cycle, and how to say it ("month", "6 months", "year").
export function planMonths(plan) {
  return (plan?.period === 'yearly' ? 12 : 1) * (plan?.interval_count || 1)
}
export function planTerm(plan) {
  const m = planMonths(plan)
  return m === 12 ? 'year' : m === 1 ? 'month' : m + ' months'
}

// Free trial: no card needed. Includes FREE_RECOVERY_LIMIT recovered slot(s); everything else
// (bookings, confirmations, reminders) works fully until the trial ends.
// Must match private.practice_plan_state() in the database.
export const FREE_RECOVERY_LIMIT = 1

// On the free plan path: never upgraded (opening checkout without finishing still counts).
export function onFreeTrial(billing) {
  return Boolean(billing && ['trialing', 'authorization_pending'].includes(billing.status) && !billing.authorization_verified_at)
}
export function freeTrialActive(billing) {
  return onFreeTrial(billing) && new Date(billing.trial_ends_at).getTime() > Date.now()
}
export function trialDaysLeft(billing) {
  return Math.max(0, Math.ceil((new Date(billing?.trial_ends_at).getTime() - Date.now()) / 86400000))
}
// Kept for older call sites: "signed up, never paid" (trial running or over).
export const notActivated = onFreeTrial

export async function fetchPlans(currency) {
  const { data, error } = await supabase.from('billing_plans')
    .select('code,name,amount_paise,currency,period,interval_count,trial_days')
    .eq('active', true).eq('test_mode', false).eq('plan_group', 'standard').eq('currency', currency)
  if (error) throw error
  return (data || []).sort((a, b) => planMonths(a) - planMonths(b))
}

export function hasAccess(billing) {
  if (!billing) return true
  if (freeTrialActive(billing)) return true
  if (['authenticated', 'active'].includes(billing.status)) return true
  if (billing.status === 'cancelled') {
    const until = accessUntil(billing)
    return Boolean(until && until.getTime() > Date.now())
  }
  return false
}

// Creates the PayPal subscription and sends the customer to PayPal to approve it.
// PayPal then returns to /app?paypal=return&subscription_id=..., handled by confirmPaypalReturn.
// Resolves to { ok: false, redirecting: true } while leaving the page, or { ok: false, message }.
export async function startCheckout(planCode) {
  const currency = await detectCurrency()
  const { data, error } = await supabase.functions.invoke('slotrecover-billing', { body: { action: 'create_subscription', currency, plan_code: planCode || undefined } })
  if (error || data?.error) return { ok: false, message: await invokeError(error, data, 'Unable to start PayPal checkout.') }
  if (!data?.approve_url) return { ok: false, message: 'PayPal did not return a checkout link. Please try again.' }
  window.location.assign(data.approve_url)
  return { ok: false, redirecting: true }
}

// PayPal's own buttons (PayPal + Debit or Credit Card) shown right on the upgrade screen.
let sdkPromise = null
export function loadPaypalSdk() {
  if (!sdkPromise) {
    sdkPromise = (async () => {
      const { data, error } = await supabase.functions.invoke('slotrecover-billing', { body: { action: 'checkout_config' } })
      if (error || data?.error) throw new Error(await invokeError(error, data, 'PayPal is not available right now.'))
      if (!window.paypal?.Buttons) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script')
          script.src = 'https://www.paypal.com/sdk/js?client-id=' + encodeURIComponent(data.client_id) +
            '&vault=true&intent=subscription&components=buttons&disable-funding=paylater,venmo'
          script.onload = resolve
          script.onerror = () => reject(new Error('PayPal could not load. Check your connection or ad blocker and try again.'))
          document.head.appendChild(script)
        })
      }
      return window.paypal
    })().catch(e => { sdkPromise = null; throw e })
  }
  return sdkPromise
}

// Creates the subscription on the server; the PayPal buttons then ask the customer to approve it.
export async function createPaypalSubscription(planCode) {
  const currency = await detectCurrency()
  const { data, error } = await supabase.functions.invoke('slotrecover-billing', { body: { action: 'create_subscription', currency, plan_code: planCode || undefined } })
  if (error || data?.error) throw new Error(await invokeError(error, data, 'Unable to start PayPal checkout.'))
  return data.subscription_id
}

// Confirms an approved subscription, retrying while PayPal finishes activating it.
export async function confirmWithRetry(subscriptionId, attempts = 3) {
  let res
  for (let i = 0; i < attempts; i++) {
    res = await confirmPaypalReturn(subscriptionId)
    if (res.ok) return res
    if (i < attempts - 1) await new Promise(r => setTimeout(r, 2500))
  }
  return res
}

// Back from PayPal: confirm the subscription on the server. Resolves to { ok, message }.
export async function confirmPaypalReturn(subscriptionId) {
  const { data, error } = await supabase.functions.invoke('slotrecover-billing', { body: { action: 'verify_checkout', subscription_id: subscriptionId } })
  if (error || data?.error) return { ok: false, message: await invokeError(error, data, 'We could not confirm your PayPal subscription.') }
  return { ok: true, status: data.status }
}

export async function fetchBillingStatus() {
  const { data, error } = await supabase.functions.invoke('slotrecover-billing', { body: { action: 'status' } })
  if (error || data?.error) throw new Error(await invokeError(error, data, 'Unable to load billing.'))
  return data.billing
}

export async function cancelSubscription() {
  const { data, error } = await supabase.functions.invoke('slotrecover-billing', { body: { action: 'cancel_subscription' } })
  if (error || data?.error) throw new Error(await invokeError(error, data, 'Unable to cancel the subscription.'))
  return data
}
