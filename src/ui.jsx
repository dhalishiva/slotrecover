import React from 'react'
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
