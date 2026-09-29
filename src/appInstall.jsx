import React, { useEffect, useState } from 'react'
import { Bell, BellOff, CheckCircle2, Download, Share, SquarePlus } from 'lucide-react'
import { Modal } from './ui'
import { disablePush, enablePush, installState, onInstallChange, promptInstall, pushStatus, sendTestPush } from './pwa'

export function useInstallState() {
  const [state, setState] = useState(() => installState())
  useEffect(() => onInstallChange(() => setState(installState())), [])
  return state
}

export function InstallModal({ onClose }) {
  const st = useInstallState()
  return <Modal title="Install SlotRecover" subtitle="Add it to your home screen to open it like an app and get notifications." onClose={onClose}>
    <div className="modal-form">
      {st.standalone ? <p className="confirm-text"><CheckCircle2 size={16}/> SlotRecover is already installed on this device.</p>
        : st.isIOS ? <ol className="install-steps">
          <li><Share size={16}/> Open this page in <strong>Safari</strong> and tap the <strong>Share</strong> button.</li>
          <li><SquarePlus size={16}/> Choose <strong>Add to Home Screen</strong>, then <strong>Add</strong>.</li>
          <li><Bell size={16}/> Open SlotRecover from your Home Screen and turn on notifications in Settings. iPhone notifications need iOS 16.4 or newer.</li>
        </ol>
        : st.canPrompt ? <p className="confirm-text">Your browser can install SlotRecover as an app on this device.</p>
        : <ol className="install-steps">
          <li><Download size={16}/> On Android, open this page in <strong>Chrome</strong>, tap the <strong>⋮</strong> menu and choose <strong>Install app</strong> (or <strong>Add to Home screen</strong>).</li>
          <li><Download size={16}/> On a computer, use the install icon at the right of Chrome or Edge's address bar.</li>
        </ol>}
      <div className="modal-actions">
        <button type="button" className="ghost" onClick={onClose}>Close</button>
        {st.canPrompt && !st.standalone && <button type="button" className="primary" onClick={async () => { await promptInstall(); onClose() }}><Download size={16}/>Install app</button>}
      </div>
    </div>
  </Modal>
}

export function NotificationsControl({ practiceId, notify }) {
  const st = useInstallState()
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function refresh() { try { setStatus(await pushStatus()) } catch { setStatus({ supported: false }) } }
  useEffect(() => { refresh() }, [])

  async function run(fn, okMsg) {
    setBusy(true); setError('')
    try { const r = await fn(); if (okMsg) notify(typeof okMsg === 'function' ? okMsg(r) : okMsg) } catch (e) { setError(e.message) }
    setBusy(false); refresh()
  }

  if (!status) return <div className="spinner"/>
  if (!status.supported) {
    return <p className="settings-note block">{st.isIOS && !st.standalone
      ? 'On iPhone, install SlotRecover to your Home Screen first, then open it from there to turn on notifications.'
      : "This browser doesn't support notifications. Try Chrome on Android or a desktop browser."}</p>
  }
  return <div className="notif-row">
    <div>
      <strong>{status.subscribed ? 'Notifications are on for this device' : 'Notifications are off for this device'}</strong>
      <span>Get a notification when a confirmation email goes out, with a shortcut to send a WhatsApp reminder.</span>
      {status.permission === 'denied' && <span className="warn">Notifications are blocked. Allow them for this site in your browser or phone settings.</span>}
      {error && <span className="warn">{error}</span>}
    </div>
    <div className="notif-actions">
      {status.subscribed
        ? <>
          <button type="button" className="ghost small" disabled={busy} onClick={() => run(sendTestPush, r => r.sent ? 'Test notification sent' : 'No device received it. Try turning notifications off and on.')}>Send test</button>
          <button type="button" className="ghost small" disabled={busy} onClick={() => run(disablePush, 'Notifications turned off')}><BellOff size={14}/>Turn off</button>
        </>
        : <button type="button" className="primary small" disabled={busy || status.permission === 'denied'} onClick={() => run(() => enablePush(practiceId), 'Notifications turned on')}><Bell size={14}/>{busy ? 'Turning on…' : 'Turn on'}</button>}
    </div>
  </div>
}
