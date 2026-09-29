import React, { useId } from 'react'
import { X } from 'lucide-react'

// Currency follows the practice setting once the workspace loads.
let moneyCurrency = 'USD'
export function setMoneyCurrency(code) { if (code) moneyCurrency = code }
export const money = (v, currency) => {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || moneyCurrency, maximumFractionDigits: 0 }).format(v || 0)
  } catch {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v || 0)
  }
}

export function Modal({ title, subtitle, onClose, children, wide }) {
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
    <div className={'modal-card' + (wide ? ' modal-wide' : '')}>
      <div className="modal-head"><div><h2>{title}</h2><p>{subtitle}</p></div><button type="button" className="icon-btn" onClick={onClose}><X size={18}/></button></div>
      {children}
    </div>
  </div>
}

export function Field({ label, children, hint }) {
  return <label className="field"><span>{label}</span>{children}{hint && <small className="field-hint">{hint}</small>}</label>
}

// Supabase functions.invoke hides the JSON body on non-2xx; dig it out.
export async function invokeError(error, data, fallback) {
  let detail = data?.message || data?.error || error?.message || fallback
  try {
    if (error?.context?.json) {
      const body = await error.context.json()
      detail = body?.message || body?.error || detail
    }
  } catch {}
  return detail
}

// SlotRecover mark: a looping "S" that returns on itself.
export function LogoMark({ size = 31 }) {
  const id = 'lg' + useId().replace(/[^a-zA-Z0-9]/g, '')
  return <svg className="logo-svg" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
    <defs><linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#7d84ff"/><stop offset="1" stopColor="#4a51dc"/></linearGradient></defs>
    <rect width="64" height="64" rx="15" fill={'url(#' + id + ')'}/>
    <g fill="none" stroke="#fff" strokeWidth="5.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M42 21.5c-2.4-3-6-4.5-10-4.5-6 0-10.5 3.6-10.5 8.3 0 4.8 4.2 6.8 10.5 8.2 6.3 1.4 10.5 3.4 10.5 8.2 0 4.7-4.5 8.3-10.5 8.3-4.4 0-8.2-1.8-10.6-5"/>
      <path d="M17 40.5l4.4 4.6 4.9-4.2"/>
    </g>
  </svg>
}
