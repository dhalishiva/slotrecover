import { supabase } from './supabase'

// ---- Install ----
let deferredPrompt = null
const listeners = new Set()
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault()
    deferredPrompt = e
    listeners.forEach(fn => fn())
  })
  window.addEventListener('appinstalled', () => { deferredPrompt = null; listeners.forEach(fn => fn()) })
}

export function onInstallChange(fn) { listeners.add(fn); return () => listeners.delete(fn) }

export function installState() {
  const ua = navigator.userAgent || ''
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true
  return { isIOS, standalone, canPrompt: Boolean(deferredPrompt) }
}

export async function promptInstall() {
  if (!deferredPrompt) return false
  deferredPrompt.prompt()
  const choice = await deferredPrompt.userChoice.catch(() => null)
  deferredPrompt = null
  listeners.forEach(fn => fn())
  return choice?.outcome === 'accepted'
}

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return
  window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}) })
}

// ---- Push notifications ----
export function pushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

async function registration() {
  const reg = await navigator.serviceWorker.getRegistration()
  return reg || navigator.serviceWorker.register('/sw.js')
}

export async function pushStatus() {
  if (!pushSupported()) return { supported: false }
  const reg = await registration()
  const sub = await reg.pushManager.getSubscription()
  return { supported: true, permission: Notification.permission, subscribed: Boolean(sub) }
}

export async function enablePush(practiceId) {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error(permission === 'denied'
    ? 'Notifications are blocked for this site. Allow them in your browser or phone settings, then try again.'
    : 'Notification permission was not granted.')
  const { data, error } = await supabase.functions.invoke('slotrecover-push', { body: { action: 'public_key' } })
  if (error || !data?.public_key) throw new Error('Could not set up notifications. Please try again.')
  const reg = await registration()
  await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(data.public_key) })
  const json = sub.toJSON()
  const { error: saveError } = await supabase.from('push_subscriptions').upsert({
    practice_id: practiceId, endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth,
    user_agent: navigator.userAgent.slice(0, 250)
  }, { onConflict: 'endpoint' })
  if (saveError) throw new Error(saveError.message)
}

export async function disablePush() {
  const reg = await registration()
  const sub = await reg.pushManager.getSubscription()
  if (!sub) return
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
  await sub.unsubscribe()
}

export async function sendTestPush() {
  const { data, error } = await supabase.functions.invoke('slotrecover-push', { body: { action: 'test' } })
  if (error || data?.error) throw new Error('Test notification failed.')
  return data
}
