// Captures marketing screenshots of the real app running against mock-supabase.js.
// 1) npx vite build --config scripts/screenshots/vite.config.js
// 2) serve dist-shots on :4400 (python3 -m http.server 4400)
// 3) node capture.mjs  (OUT=dir)
// The app is loaded under https://www.slotrecover.pro so generated links show the real domain,
// but every request is answered from the local mock build. Nothing touches production.
import { chromium } from 'playwright'
const LOCAL = process.env.LOCAL || 'http://localhost:4400'
const SITE = 'https://www.slotrecover.pro'
const OUT = process.env.OUT || 'shots'
const hide = `.help-bubble,.help-fab,[class*="help-bubble"],.toast{display:none!important}`

const b = await chromium.launch()
async function page(viewport, scale = 2) {
  const ctx = await b.newContext({ viewport, deviceScaleFactor: scale, timezoneId: 'America/New_York', locale: 'en-US' })
  await ctx.route(SITE + '/**', async route => {
    const url = new URL(route.request().url())
    const res = await fetch(LOCAL + url.pathname)
    if (!res.ok) return route.fulfill({ status: 404, body: '' })
    route.fulfill({ status: 200, body: Buffer.from(await res.arrayBuffer()), headers: { 'content-type': res.headers.get('content-type') || 'text/plain' } })
  })
  await ctx.route(/\/_vercel\//, r => r.fulfill({ status: 204, body: '' }))
  const p = await ctx.newPage()
  await p.goto(SITE + '/app/index.html'); await p.addStyleTag({ content: hide })
  await p.waitForSelector('.hero-metric', { timeout: 15000 }); await p.waitForTimeout(700)
  return p
}
const nav = async (p, label) => { await p.locator('.sidebar nav button', { hasText: label }).click(); await p.waitForTimeout(800) }
const D = { width: 1440, height: 900 }

let p = await page(D)
await p.screenshot({ path: `${OUT}/dashboard.png` })

await p.locator('button.primary', { hasText: 'New appointment' }).first().click(); await p.waitForTimeout(900)
const inputs = p.locator('.modal-form input')
await inputs.nth(0).fill('Hannah'); await inputs.nth(1).fill('Reed')
await inputs.nth(2).fill('hannah@example.com'); await inputs.nth(3).fill('+1 212 555 0184')
await p.locator('.slot-btn:not(.taken)', { hasText: '12:30 PM' }).first().click(); await p.waitForTimeout(400)
await p.screenshot({ path: `${OUT}/new-appointment.png` })

p = await page(D)
await p.locator('.wa-btn').first().click(); await p.waitForTimeout(800)
await p.screenshot({ path: `${OUT}/whatsapp.png` })

p = await page(D)
await nav(p, 'Recovery'); await p.screenshot({ path: `${OUT}/recovery.png` })
await nav(p, 'Messaging'); await p.waitForTimeout(500); await p.screenshot({ path: `${OUT}/messaging.png` })

p = await page({ width: 390, height: 844 }, 3)
await p.screenshot({ path: `${OUT}/mobile.png` })
await b.close()
console.log('done')
