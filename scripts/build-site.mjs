// Pre-renders the public marketing site into dist/ as static HTML (fast, fully
// crawlable), plus sitemap.xml and robots.txt. Runs after `vite build`.
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { SITE_URL, PRODUCT, COMPANY, PRICES, TRIAL_DAYS, FEATURES, STEPS, HOME_FAQ, PRICING_FAQ, INDUSTRIES } from './site-content.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'dist')
// Google Analytics 4 measurement ID. Leave empty to keep GA off (no cookie banner shown).
const GA_ID = process.env.VITE_GA_ID || ''

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const write = (rel, content) => {
  const file = path.join(dist, rel)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content)
}

const LOGO = `<svg width="30" height="30" viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7d84ff"/><stop offset="1" stop-color="#4a51dc"/></linearGradient></defs><rect width="64" height="64" rx="15" fill="url(#lg)"/><g fill="none" stroke="#fff" stroke-width="5.2" stroke-linecap="round" stroke-linejoin="round"><path d="M42 21.5c-2.4-3-6-4.5-10-4.5-6 0-10.5 3.6-10.5 8.3 0 4.8 4.2 6.8 10.5 8.2 6.3 1.4 10.5 3.4 10.5 8.2 0 4.7-4.5 8.3-10.5 8.3-4.4 0-8.2-1.8-10.6-5"/><path d="M17 40.5l4.4 4.6 4.9-4.2"/></g></svg>`

const priceTag = (cls = '') => `<span class="price ${cls}" data-price>${PRICES.USD.symbol}${PRICES.USD.amount}</span>`

function layout({ route, title, description, body, jsonLd = [], ogType = 'website' }) {
  const url = SITE_URL + (route === '/' ? '/' : route)
  const ld = jsonLd.map(o => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`).join('\n')
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${url}">
<link rel="alternate" hreflang="en" href="${url}">
<link rel="alternate" hreflang="x-default" href="${url}">
<meta name="robots" content="index, follow, max-image-preview:large">
<meta name="theme-color" content="#0d0f14">
<meta name="color-scheme" content="light">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
<link rel="manifest" href="/manifest.webmanifest">
<meta property="og:type" content="${ogType}">
<meta property="og:site_name" content="${PRODUCT}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE_URL}/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${SITE_URL}/og.png">
<link rel="preload" href="/fonts/manrope-800.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/site.css">
${ld}
<script>
// Old links (emails, password resets, notifications) pointed at "/". Send them to the app.
(function(){var s=location.search,h=location.hash;if(/[?&](action|remind|signup)=/.test(s)||/access_token|type=recovery|error_description/.test(h)){location.replace('/app'+s+h)}})();
</script>
</head>
<body>
<header class="nav">
  <div class="wrap nav-in">
    <a class="brand" href="/">${LOGO}<span>${PRODUCT}</span></a>
    <input type="checkbox" id="nav-toggle" class="nav-toggle" aria-label="Menu">
    <label for="nav-toggle" class="nav-burger" aria-hidden="true"><span></span></label>
    <nav class="nav-links">
      <a href="/industries">Industries</a>
      <a href="/pricing">Pricing</a>
      <a href="/help">Help</a>
      <a href="/app" class="nav-signin" data-app-link>Sign in</a>
      <a href="/app?signup=1" class="btn btn-dark nav-cta">Start free trial</a>
    </nav>
  </div>
</header>
<main>
${body}
</main>
<footer class="footer">
  <div class="wrap footer-in">
    <div class="footer-brand"><a class="brand" href="/">${LOGO}<span>${PRODUCT}</span></a><p>Recover revenue from cancellations and no-shows automatically.</p></div>
    <div><h4>Product</h4><a href="/pricing">Pricing</a><a href="/industries">Industries</a><a href="/help">Help Center</a><a href="/app">Sign in</a></div>
    <div><h4>Popular</h4>${INDUSTRIES.slice(0, 5).map(i => `<a href="/industries/${i.slug}">${esc(i.name)}</a>`).join('')}</div>
    <div><h4>Legal</h4><a href="/terms">Terms</a><a href="/privacy">Privacy</a><a href="/cookies">Cookies</a><a href="/dpa">DPA</a><a href="/contact">Contact</a></div>
  </div>
  <div class="wrap footer-base">© ${new Date().getFullYear()} ${COMPANY}. ${PRODUCT} is operated by ${COMPANY}.</div>
</footer>
${GA_ID ? consentBanner() : ''}
<script>
window.SR_PRICES=${JSON.stringify(PRICES)};
(function(){
  // Show "Open app" instead of "Sign in" for people already signed in.
  try{for(var i=0;i<localStorage.length;i++){if(/^sb-.*-auth-token$/.test(localStorage.key(i))){document.querySelectorAll('[data-app-link]').forEach(function(a){a.textContent='Open app'});break}}}catch(e){}
  // Local currency: saved choice, then location from /api/geo, then timezone guess.
  var P=window.SR_PRICES;
  function fmt(c){var p=P[c]||P.USD;return p.symbol+p.amount.toLocaleString('en-US')}
  function apply(c){if(!P[c])c='USD';document.querySelectorAll('[data-price]').forEach(function(el){el.textContent=fmt(c)});document.querySelectorAll('[data-currency]').forEach(function(el){el.textContent=P[c].label});document.querySelectorAll('[data-cur-btn]').forEach(function(b){b.classList.toggle('on',b.getAttribute('data-cur-btn')===c)});document.documentElement.setAttribute('data-cur',c)}
  function guess(){try{var tz=Intl.DateTimeFormat().resolvedOptions().timeZone||'';if(tz==='Europe/London')return'GBP';if(/^Europe\\//.test(tz))return'EUR'}catch(e){}return'USD'}
  var saved=null;try{saved=localStorage.getItem('sr_currency')}catch(e){}
  apply(saved||guess());
  if(!saved){fetch('/api/geo').then(function(r){return r.ok?r.json():null}).then(function(d){if(d&&d.currency)apply(d.currency)}).catch(function(){})}
  document.querySelectorAll('[data-cur-btn]').forEach(function(b){b.addEventListener('click',function(){var c=b.getAttribute('data-cur-btn');try{localStorage.setItem('sr_currency',c)}catch(e){}apply(c)})});
})();
</script>
<script defer src="/_vercel/insights/script.js"></script>
</body>
</html>`
}

function consentBanner() {
  // GA4 with Consent Mode v2: nothing is stored until the visitor accepts.
  return `<div class="consent" id="consent" hidden>
  <p>We use analytics cookies to understand how people find ${PRODUCT}. <a href="/cookies">Cookie Policy</a></p>
  <div><button class="btn btn-light" data-consent="denied">Decline</button><button class="btn btn-dark" data-consent="granted">Accept</button></div>
</div>
<script>
window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}
gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied'});
gtag('js',new Date());gtag('config','${GA_ID}',{anonymize_ip:true});
(function(){var k='sr_consent',v=null;try{v=localStorage.getItem(k)}catch(e){}
function load(){var s=document.createElement('script');s.async=true;s.src='https://www.googletagmanager.com/gtag/js?id=${GA_ID}';document.head.appendChild(s)}
function set(val){gtag('consent','update',{analytics_storage:val});try{localStorage.setItem(k,val)}catch(e){}if(val==='granted')load()}
if(v){if(v==='granted')set('granted')}else{var b=document.getElementById('consent');b.hidden=false;b.querySelectorAll('[data-consent]').forEach(function(x){x.addEventListener('click',function(){set(x.getAttribute('data-consent'));b.hidden=true})})}})();
</script>`
}

const faqBlock = (faqs, heading = 'Frequently asked questions') => `
<section class="section"><div class="wrap narrow">
  <h2>${esc(heading)}</h2>
  <div class="faq">${faqs.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div>
</div></section>`

const faqLd = faqs => ({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) })
const orgLd = { '@context': 'https://schema.org', '@type': 'Organization', name: PRODUCT, legalName: COMPANY, url: SITE_URL, logo: SITE_URL + '/icons/icon-512.png' }
const appLd = { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: PRODUCT, applicationCategory: 'BusinessApplication', operatingSystem: 'Web, Android, iOS', url: SITE_URL, description: 'Appointment confirmation and cancellation-recovery software that refills empty slots from a waitlist.', offers: Object.entries(PRICES).map(([cur, p]) => ({ '@type': 'Offer', price: String(p.amount), priceCurrency: cur, category: 'subscription' })) }
const crumbs = items => ({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items.map(([name, route], i) => ({ '@type': 'ListItem', position: i + 1, name, item: SITE_URL + route })) })

const ctaBand = (text = 'Stop losing revenue to empty slots.') => `
<section class="cta-band"><div class="wrap cta-in">
  <div><h2>${esc(text)}</h2><p>${TRIAL_DAYS}-day free trial. Cancel any time.</p></div>
  <a class="btn btn-light btn-lg" href="/app?signup=1">Start free trial</a>
</div></section>`

const heroCard = `
<div class="hero-card" aria-hidden="true">
  <div class="hc-row"><span class="dot red"></span><div><b>2:30 PM · Color & cut</b><small>Cancelled by client · 9:12 AM</small></div><em class="tag red">Slot open</em></div>
  <div class="hc-row"><span class="dot violet"></span><div><b>Offered to waitlist</b><small>Maya L. · matches service & time</small></div><em class="tag violet">15 min offer</em></div>
  <div class="hc-row"><span class="dot green"></span><div><b>Accepted · slot filled</b><small>Confirmed · 9:18 AM</small></div><em class="tag green">+$180</em></div>
  <div class="hc-total"><span>Recovered this month</span><strong>$2,840</strong></div>
</div>`

// ---------- Pages ----------
function home() {
  const body = `
<section class="hero"><div class="wrap hero-in">
  <div>
    <p class="eyebrow">Appointment confirmations + waitlist recovery</p>
    <h1>Fill cancelled appointments automatically</h1>
    <p class="lead">${PRODUCT} confirms every booking, catches cancellations early, and instantly offers the empty slot to the right client on your waitlist. Less empty time, more revenue.</p>
    <div class="hero-cta"><a class="btn btn-light btn-lg" href="/app?signup=1">Start ${TRIAL_DAYS}-day free trial</a><a class="btn btn-ghost btn-lg" href="#how">See how it works</a></div>
    <p class="hero-note">From ${priceTag()}/month · Nothing charged during the trial · Cancel any time</p>
  </div>
  ${heroCard}
</div></section>

<section class="section" id="how"><div class="wrap">
  <p class="kicker">How it works</p>
  <h2>An empty slot is lost revenue. ${PRODUCT} tries to recover it.</h2>
  <div class="steps">${STEPS.map(([t, d], i) => `<div class="step"><span>0${i + 1}</span><h3>${esc(t)}</h3><p>${esc(d)}</p></div>`).join('')}</div>
</div></section>

<section class="section alt"><div class="wrap">
  <p class="kicker">Features</p>
  <h2>Everything you need to protect your calendar</h2>
  <div class="grid3">${FEATURES.map(([t, d]) => `<div class="card"><h3>${esc(t)}</h3><p>${esc(d)}</p></div>`).join('')}</div>
</div></section>

<section class="section"><div class="wrap">
  <p class="kicker">Who it’s for</p>
  <h2>Built for appointment-based businesses</h2>
  <p class="sub">Salons, studios, trainers, tutors and service pros where every empty slot costs money.</p>
  <div class="chips">${INDUSTRIES.map(i => `<a class="chip" href="/industries/${i.slug}">${esc(i.short)}</a>`).join('')}</div>
</div></section>

<section class="section alt"><div class="wrap price-teaser">
  <div><p class="kicker">Pricing</p><h2>One simple plan</h2><p class="sub">Everything included, for your whole team. Shown in your local currency.</p></div>
  <div class="price-box">${priceTag('big')}<span class="per">/ month</span><a class="btn btn-dark" href="/pricing">See pricing</a></div>
</div></section>
${faqBlock(HOME_FAQ)}
${ctaBand()}`
  return layout({ route: '/', title: `No-Show & Cancellation Recovery Software | ${PRODUCT}`, description: `${PRODUCT} confirms appointments automatically and refills cancelled slots from your waitlist. Reduce no-shows and recover lost revenue. ${TRIAL_DAYS}-day free trial.`, body, jsonLd: [orgLd, appLd, faqLd(HOME_FAQ)] })
}

function pricing() {
  const included = ['Unlimited appointments', 'Automatic confirmation emails', 'Self-filling waitlist with timed offers', 'WhatsApp reminders in one tap', 'Staff and services', 'Recovered-revenue dashboard', 'Messaging history', 'Install on Android & iPhone', 'Cancel any time']
  const body = `
<section class="page-hero"><div class="wrap narrow center">
  <p class="kicker">Pricing</p>
  <h1>Simple pricing that pays for itself</h1>
  <p class="lead dark">One plan, everything included. Recover one or two cancelled appointments a month and it has paid for itself.</p>
  <div class="cur-switch" role="group" aria-label="Currency">${Object.keys(PRICES).map(c => `<button type="button" data-cur-btn="${c}">${c}</button>`).join('')}</div>
</div></section>
<section class="section tight"><div class="wrap narrow">
  <div class="plan">
    <div class="plan-head"><h2>${PRODUCT}</h2><p>For solo professionals and small teams</p></div>
    <div class="plan-price">${priceTag('big')}<span class="per">/ month · <span data-currency>USD</span></span></div>
    <p class="plan-trial">${TRIAL_DAYS}-day free trial · then billed monthly · taxes extra where applicable</p>
    <a class="btn btn-dark btn-lg wide" href="/app?signup=1">Start free trial</a>
    <ul class="ticks">${included.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
  </div>
</div></section>
${faqBlock(PRICING_FAQ)}
${ctaBand('Try it free for a week.')}`
  return layout({ route: '/pricing', title: `Pricing · ${PRODUCT}`, description: `${PRODUCT} pricing: one monthly plan with everything included, shown in USD, EUR or GBP. ${TRIAL_DAYS}-day free trial, cancel any time.`, body, jsonLd: [appLd, faqLd(PRICING_FAQ), crumbs([['Home', '/'], ['Pricing', '/pricing']])] })
}

function industriesIndex() {
  const body = `
<section class="page-hero"><div class="wrap narrow center">
  <p class="kicker">Industries</p>
  <h1>No-show and cancellation recovery for every appointment business</h1>
  <p class="lead dark">See how ${PRODUCT} confirms bookings and refills empty slots in your industry.</p>
</div></section>
<section class="section tight"><div class="wrap"><div class="grid3">
  ${INDUSTRIES.map(i => `<a class="card link" href="/industries/${i.slug}"><h3>${esc(i.short)}</h3><p>${esc(i.desc)}</p><span class="more">Learn more →</span></a>`).join('')}
</div></div></section>
${ctaBand()}`
  return layout({ route: '/industries', title: `Industries · ${PRODUCT}`, description: `How ${PRODUCT} reduces no-shows and refills cancelled appointments for salons, barbers, spas, trainers, tutors, groomers and service businesses.`, body, jsonLd: [crumbs([['Home', '/'], ['Industries', '/industries']])] })
}

function industryPage(ind) {
  const idx = INDUSTRIES.indexOf(ind)
  const related = [1, 2, 3].map(k => INDUSTRIES[(idx + k) % INDUSTRIES.length])
  const body = `
<section class="page-hero"><div class="wrap narrow">
  <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/industries">Industries</a> / <span>${esc(ind.name)}</span></nav>
  <p class="kicker">${esc(ind.short)}</p>
  <h1>${esc(ind.h1)}</h1>
  <p class="lead dark">${esc(ind.intro)}</p>
  <div class="hero-cta"><a class="btn btn-dark btn-lg" href="/app?signup=1">Start ${TRIAL_DAYS}-day free trial</a><a class="btn btn-outline btn-lg" href="/pricing"><span>From ${priceTag()}/mo</span></a></div>
</div></section>
<section class="section tight"><div class="wrap narrow two-col">
  <div class="card"><h2 class="h3">Where the revenue leaks</h2><ul class="dots">${ind.leaks.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
  <div class="card"><h2 class="h3">How ${PRODUCT} fills the gap</h2><ul class="ticks">${ind.helps.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
</div></section>
<section class="section tight"><div class="wrap narrow">
  <div class="example"><strong>How a cancellation gets recovered</strong><p>${esc(ind.example)}</p></div>
  <h2 class="h3">Typical appointments</h2>
  <div class="chips">${ind.appointments.map(a => `<span class="chip static">${esc(a)}</span>`).join('')}</div>
</div></section>
<section class="section alt"><div class="wrap">
  <h2>How it works for ${esc(ind.name.toLowerCase())}</h2>
  <div class="steps">${STEPS.map(([t, d], i) => `<div class="step"><span>0${i + 1}</span><h3>${esc(t)}</h3><p>${esc(d)}</p></div>`).join('')}</div>
</div></section>
${faqBlock(ind.faqs, `${ind.name}: common questions`)}
<section class="section tight"><div class="wrap narrow">
  <h2 class="h3">Also built for</h2>
  <div class="chips">${related.map(r => `<a class="chip" href="/industries/${r.slug}">${esc(r.short)}</a>`).join('')}<a class="chip" href="/industries">All industries →</a></div>
</div></section>
${ctaBand('Start filling cancelled appointments today.')}`
  return layout({ route: `/industries/${ind.slug}`, title: ind.title, description: ind.desc, body, jsonLd: [faqLd(ind.faqs), crumbs([['Home', '/'], ['Industries', '/industries'], [ind.name, `/industries/${ind.slug}`]])] })
}

// ---------- Write everything ----------
if (!fs.existsSync(path.join(dist, 'app', 'index.html'))) {
  console.error('dist/app/index.html missing — run vite build first'); process.exit(1)
}
write('index.html', home())
write('pricing/index.html', pricing())
write('industries/index.html', industriesIndex())
for (const ind of INDUSTRIES) write(`industries/${ind.slug}/index.html`, industryPage(ind))

// Self-hosted fonts for the static site.
const fontSrc = path.join(root, 'node_modules', '@fontsource')
const fonts = [['dm-sans', 'dm-sans-latin-400-normal.woff2', 'dm-sans-400.woff2'], ['dm-sans', 'dm-sans-latin-700-normal.woff2', 'dm-sans-700.woff2'], ['manrope', 'manrope-latin-800-normal.woff2', 'manrope-800.woff2']]
fs.mkdirSync(path.join(dist, 'fonts'), { recursive: true })
for (const [pkg, file, out] of fonts) fs.copyFileSync(path.join(fontSrc, pkg, 'files', file), path.join(dist, 'fonts', out))
fs.copyFileSync(path.join(root, 'scripts', 'site.css'), path.join(dist, 'site.css'))

const today = new Date().toISOString().slice(0, 10)
const urls = [['/', '1.0'], ['/pricing', '0.9'], ['/industries', '0.8'], ...INDUSTRIES.map(i => [`/industries/${i.slug}`, '0.8']), ['/help', '0.6'], ['/terms', '0.3'], ['/privacy', '0.3'], ['/cookies', '0.2'], ['/dpa', '0.2'], ['/subprocessors', '0.2'], ['/acceptable-use', '0.2'], ['/refunds', '0.3'], ['/contact', '0.4']]
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(([u, p]) => `  <url><loc>${SITE_URL}${u === '/' ? '/' : u}</loc><lastmod>${today}</lastmod><priority>${p}</priority></url>`).join('\n')}\n</urlset>\n`)
write('robots.txt', `User-agent: *\nAllow: /\nDisallow: /app\nDisallow: /api/\n\nSitemap: ${SITE_URL}/sitemap.xml\n`)
console.log(`Built marketing site: ${3 + INDUSTRIES.length} pages, sitemap with ${urls.length} URLs`)
