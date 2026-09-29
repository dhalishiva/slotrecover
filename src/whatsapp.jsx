import React, { useEffect, useState } from 'react'
import { Copy, MessageCircle } from 'lucide-react'
import { supabase } from './supabase'
import { Field, Modal } from './ui'

// Turn whatever was typed into the digits wa.me expects (country code + number).
export function normalizePhone(raw, defaultCode = '+1') {
  if (!raw) return ''
  let v = String(raw).trim().replace(/[\s\-().]/g, '')
  if (v.startsWith('+')) return v.slice(1).replace(/\D/g, '')
  if (v.startsWith('00')) return v.slice(2).replace(/\D/g, '')
  v = v.replace(/\D/g, '').replace(/^0+/, '')
  if (!v) return ''
  return String(defaultCode || '+1').replace(/\D/g, '') + v
}

export function buildReminderText(appt, practice) {
  const base = window.location.origin
  const tz = practice?.timezone
  const when = new Date(appt.start_at)
  const day = when.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: tz })
  const time = when.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: tz })
  const first = appt.clients?.first_name || 'there'
  const service = appt.services?.name || 'appointment'
  const staff = appt.staff?.name
  const lines = [
    `Hi ${first}! This is ${practice?.name || 'us'}.`,
    '',
    `Reminder: your ${service} appointment${staff ? ' with ' + staff : ''} is on ${day} at ${time}.`,
    '',
    `✅ Confirm: ${base}/?action=confirm&token=${appt.public_token}`,
    `🔁 Reschedule: ${base}/?action=reschedule&token=${appt.public_token}`,
    `❌ Cancel: ${base}/?action=cancel&token=${appt.public_token}`,
  ]
  if (practice?.client_note) lines.push('', `Note: ${practice.client_note}`)
  return lines.join('\n')
}

export const reminderSelect = 'id,start_at,status,public_token,services(name,price_cents),clients(first_name,last_name,phone),staff(name)'

export async function fetchReminderAppointment(id) {
  const { data, error } = await supabase.from('appointments').select(reminderSelect).eq('id', id).maybeSingle()
  if (error) throw error
  return data
}

export function ReminderModal({ appointment, practice, onClose, onSent }) {
  const [phone, setPhone] = useState(appointment.clients?.phone || '')
  const [text, setText] = useState(() => buildReminderText(appointment, practice))
  const [copied, setCopied] = useState(false)
  useEffect(() => { setText(buildReminderText(appointment, practice)) }, [appointment?.id])

  const digits = normalizePhone(phone, practice?.default_country_code)
  const href = digits ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}` : null
  const name = [appointment.clients?.first_name, appointment.clients?.last_name].filter(Boolean).join(' ') || 'client'

  // Record that a reminder was opened in WhatsApp so it shows in the Message center.
  function logSent() {
    if (!practice?.id || !appointment?.id) return
    supabase.from('message_events').insert({ practice_id: practice.id, appointment_id: appointment.id, channel: 'whatsapp', kind: 'reminder' })
      .then(() => onSent && onSent())
  }

  async function copy() {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch {}
  }

  return <Modal title="Send WhatsApp reminder" subtitle={`Opens WhatsApp with this message for ${name}. You press send.`} onClose={onClose}>
    <div className="modal-form">
      <Field label="WhatsApp number" hint={digits ? `Will open chat with +${digits}` : `Add the number with country code, or it uses ${practice?.default_country_code || '+1'}.`}>
        <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 555 123 4567" inputMode="tel"/>
      </Field>
      <Field label="Message"><textarea rows={10} value={text} onChange={e => setText(e.target.value)}/></Field>
      <div className="modal-actions">
        <button type="button" className="ghost" onClick={copy}><Copy size={15}/>{copied ? 'Copied' : 'Copy message'}</button>
        {href
          ? <a className="primary whatsapp-btn" href={href} target="_blank" rel="noreferrer" onClick={() => { logSent(); setTimeout(onClose, 400) }}><MessageCircle size={16}/>Open WhatsApp</a>
          : <button type="button" className="primary" disabled>Add a phone number</button>}
      </div>
    </div>
  </Modal>
}
