import { supabase } from './supabase'
import { invokeError } from './ui'

// Access continues after cancellation until the paid/trial period ends.
export function accessUntil(billing) {
  if (!billing) return null
  const dates = [billing.trial_ends_at, billing.current_period_end].filter(Boolean).map(d => new Date(d).getTime())
  return dates.length ? new Date(Math.max(...dates)) : null
}

export function hasAccess(billing) {
  if (!billing) return true
  if (['authenticated', 'active'].includes(billing.status)) return true
  if (billing.status === 'cancelled') {
    const until = accessUntil(billing)
    return Boolean(until && until.getTime() > Date.now())
  }
  return false
}

function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve(true)
  return new Promise(resolve => {
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}

// Creates (or reuses) the Razorpay subscription, opens Checkout and verifies it.
// Resolves to { ok: true } or { ok: false, message }, or { ok: false, dismissed: true }.
export async function startCheckout() {
  const { data, error } = await supabase.functions.invoke('slotrecover-billing', { body: { action: 'create_subscription' } })
  if (error || data?.error) return { ok: false, message: await invokeError(error, data, 'Unable to start Razorpay.') }
  if (!(await loadRazorpay())) return { ok: false, message: 'Unable to load Razorpay Checkout.' }

  return await new Promise(resolve => {
    const checkout = new window.Razorpay({
      key: data.key_id,
      subscription_id: data.subscription_id,
      name: 'Dhali Services',
      description: data.description,
      prefill: data.prefill,
      theme: { color: '#17191e' },
      handler: async response => {
        const { data: verified, error: verifyError } = await supabase.functions.invoke('slotrecover-billing', {
          body: {
            action: 'verify_checkout',
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_subscription_id: response.razorpay_subscription_id,
            razorpay_signature: response.razorpay_signature
          }
        })
        if (verifyError || verified?.error) {
          resolve({ ok: false, message: await invokeError(verifyError, verified, 'Authorization could not be verified.') })
          return
        }
        resolve({ ok: true })
      },
      modal: { ondismiss: () => resolve({ ok: false, dismissed: true }) }
    })
    checkout.open()
  })
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
