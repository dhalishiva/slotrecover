// Returns the visitor's country (from Vercel's edge geolocation) and the
// currency we price in for that country. No personal data is stored.
const EUR = new Set(['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE','IS','LI','NO','CH','MC','SM','VA','AD','ME','XK'])

export function currencyFor(country) {
  const c = (country || '').toUpperCase()
  if (c === 'IN') return 'INR'
  if (c === 'GB' || c === 'GG' || c === 'JE' || c === 'IM') return 'GBP'
  if (EUR.has(c)) return 'EUR'
  return 'USD'
}

export default function handler(req, res) {
  const country = req.headers['x-vercel-ip-country'] || ''
  res.setHeader('Cache-Control', 'private, no-store')
  res.status(200).json({ country, currency: currencyFor(country) })
}
