import React from 'react'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import { site } from './siteConfig'
import { LogoMark } from './ui'

const S = ({ h, children }) => <section><h2>{h}</h2>{children}</section>
const Mail = ({ to }) => <a href={'mailto:' + to}>{to}</a>
const L = ({ to, children }) => <a href={to}>{children}</a>

export const legalLinks = [
  ['/terms', 'Terms of Service'],
  ['/privacy', 'Privacy Policy'],
  ['/cookies', 'Cookie Policy'],
  ['/dpa', 'Data Processing Addendum'],
  ['/subprocessors', 'Subprocessors'],
  ['/acceptable-use', 'Acceptable Use Policy'],
  ['/refunds', 'Refund & Cancellation'],
  ['/contact', 'Contact'],
]

function Terms() {
  return <>
    <S h="1. Agreement">
      <p>These Terms of Service ("Terms") are a binding agreement between you and {site.company}, {site.companyDescription} ("we", "us"), which operates {site.product} (the "Service"). By creating an account, starting a trial or using the Service, you agree to these Terms, our <L to="/privacy">Privacy Policy</L>, our <L to="/acceptable-use">Acceptable Use Policy</L> and, where applicable, our <L to="/dpa">Data Processing Addendum</L>.</p>
      <p>If you accept on behalf of a business, you confirm you are authorised to bind that business, and "you" means that business.</p>
    </S>
    <S h="2. Business use only">
      <p>The Service is provided to businesses and professionals for use in their trade or profession. It is not offered to consumers. You must be at least 18 years old and legally able to enter contracts.</p>
    </S>
    <S h="3. What the Service does">
      <p>{site.product} helps appointment-based businesses manage appointments, request confirmations, detect cancellations, and offer released time slots to waitlisted clients. We work to recover revenue from cancellations and no-shows, but <strong>we do not guarantee any level of confirmations, recovered appointments or revenue</strong>.</p>
      <p>Features may change as we improve the Service. We will give reasonable notice of changes that materially reduce core functionality.</p>
    </S>
    <S h="4. Your account">
      <ul>
        <li>Keep your login credentials confidential; you are responsible for activity under your account.</li>
        <li>Provide accurate information and keep it up to date.</li>
        <li>Tell us promptly at <Mail to={site.supportEmail}/> if you suspect unauthorised access.</li>
      </ul>
    </S>
    <S h="5. Your clients and your data">
      <p>You keep all rights to the information you or your clients put into the Service ("Customer Data"), including client names, contact details and appointment records. You grant us a limited licence to host, process and transmit Customer Data only to provide, secure and support the Service.</p>
      <p>For personal data about your clients, you are the controller (or "business") and we act as your processor (or "service provider"). Our <L to="/dpa">Data Processing Addendum</L> forms part of these Terms.</p>
      <p>You are responsible for having a lawful basis and any required notices or consents to send appointment emails and messages to your clients through the Service, and for complying with laws that apply to your business.</p>
    </S>
    <S h="6. Health and sensitive information">
      <p>The Service is not designed to store health records or other special-category data. <strong>We are not a HIPAA business associate and do not sign Business Associate Agreements.</strong> Do not enter protected health information, diagnoses, treatment notes, payment card numbers, government identifiers or similar sensitive data into the Service.</p>
    </S>
    <S h="7. Free trial, subscription and payment">
      <ul>
        <li>New accounts receive a {site.trialDays}-day free trial. <strong>No payment method is required.</strong> The free trial includes {site.freeRecoveries} recovered slot from your waitlist; all other features work during the trial. When the trial ends, access pauses until you choose a paid plan. Your data is kept.</li>
        <li><strong>All payments for {site.product} are made to {site.company}</strong>, the business that operates the Service, through our payment processor (currently Razorpay). Charges appear on your statement under that name.</li>
        <li>When you upgrade, your paid plan starts immediately and <strong>renews automatically each billing period</strong> (monthly, every 6 months or yearly, as chosen) at the price shown at checkout, until you cancel.</li>
        <li>Fees are charged in advance for each billing period. Prices exclude taxes unless stated; you are responsible for applicable taxes, including VAT or GST under reverse-charge rules where they apply.</li>
        <li>We may change prices with at least 30 days' notice before your next renewal. If you do not agree, you may cancel before the change takes effect.</li>
        <li>If a payment fails, we may retry it and suspend access until the balance is paid.</li>
      </ul>
      <p>See our <L to="/refunds">Refund & Cancellation Policy</L> for how to cancel and when refunds apply.</p>
    </S>
    <S h="8. Acceptable use">
      <p>You must follow our <L to="/acceptable-use">Acceptable Use Policy</L>. We may suspend access to protect the Service, other customers or recipients if you breach it.</p>
    </S>
    <S h="9. Our intellectual property">
      <p>We own the Service, including its software, design and content, and all related intellectual property. These Terms give you a limited, non-exclusive, non-transferable right to use the Service during your subscription. You may not copy, resell, reverse engineer or build a competing product from the Service. If you send us feedback, we may use it without obligation.</p>
    </S>
    <S h="10. Availability and support">
      <p>We aim for high availability but do not promise uninterrupted service. Scheduled maintenance and events outside our reasonable control (including failures of hosting, email or payment providers) may cause interruptions. Support is available by email at <Mail to={site.supportEmail}/>.</p>
    </S>
    <S h="11. Term, cancellation and termination">
      <p>You may cancel at any time as described in the <L to="/refunds">Refund & Cancellation Policy</L>. We may suspend or terminate your account for material breach of these Terms, non-payment, or where required by law. After termination you may request an export of your Customer Data within 30 days; after that we delete it as described in our <L to="/privacy">Privacy Policy</L>.</p>
    </S>
    <S h="12. Disclaimers">
      <p>To the maximum extent permitted by law, the Service is provided "as is" and "as available", without warranties of any kind, whether express or implied, including merchantability, fitness for a particular purpose and non-infringement. You are responsible for decisions you make about your appointments, clients and staffing.</p>
    </S>
    <S h="13. Limitation of liability">
      <p>To the maximum extent permitted by law: (a) neither party is liable for indirect, incidental, special, consequential or punitive damages, or loss of profits, revenue, goodwill or data; and (b) our total liability arising out of or relating to the Service is limited to the fees you paid us in the 12 months before the event giving rise to the claim. Nothing in these Terms limits liability that cannot be limited by law, such as liability for fraud, or for death or personal injury caused by negligence.</p>
    </S>
    <S h="14. Indemnity">
      <p>You will defend and indemnify us against third-party claims arising from Customer Data, your messages to your clients, or your breach of these Terms or applicable law.</p>
    </S>
    <S h="15. Governing law and disputes">
      <p>These Terms are governed by {site.governingLaw}, and disputes are subject to the exclusive jurisdiction of {site.venue}, except that either party may seek urgent injunctive relief in any competent court. Before starting proceedings, please contact us so we can try to resolve the issue informally.</p>
    </S>
    <S h="16. Changes to these Terms">
      <p>We may update these Terms. For material changes we will notify you by email or in the app at least 30 days in advance. Continuing to use the Service after changes take effect means you accept them.</p>
    </S>
    <S h="17. General">
      <p>You may not assign these Terms without our consent; we may assign them in connection with a merger or sale of the business. If any provision is unenforceable, the rest remains in effect. These Terms are the entire agreement about the Service.</p>
      <p>Contact: {site.company}, {site.address}. Email <Mail to={site.supportEmail}/>.</p>
    </S>
  </>
}

function Privacy() {
  return <>
    <S h="1. Who we are">
      <p>{site.company} ("we", "us") operates {site.product}. This policy explains how we handle personal data when you visit our site, create an account, or use the Service, and your rights under laws including the EU and UK GDPR, the California Consumer Privacy Act (as amended by the CPRA) and other US state privacy laws.</p>
      <p>Controller: {site.company}, {site.address}. Privacy contact: <Mail to={site.privacyEmail}/>.</p>
      <p>EU representative: {site.euRepresentative}<br/>UK representative: {site.ukRepresentative}</p>
    </S>
    <S h="2. Two kinds of data">
      <p><strong>Account data.</strong> Information about you as our customer (the business owner and your team). We are the <strong>controller</strong> of this data.</p>
      <p><strong>Client data.</strong> Information about your clients that you enter or that your clients provide when responding to appointment emails (name, email, phone, appointment times, waitlist preferences, responses). For client data we are a <strong>processor / service provider</strong> acting on your instructions under our <L to="/dpa">Data Processing Addendum</L>. Your clients should contact your business first with privacy requests; we will help you respond.</p>
    </S>
    <S h="3. What we collect">
      <ul>
        <li><strong>Account and contact details:</strong> email address, password (stored hashed by our authentication provider), business name, services and prices.</li>
        <li><strong>Billing details:</strong> subscription status, plan, and payment references from Razorpay. We do not receive or store full card numbers.</li>
        <li><strong>Usage and technical data:</strong> log data such as IP address, browser type, timestamps and error logs, used for security and troubleshooting.</li>
        <li><strong>Support communications:</strong> messages you send us.</li>
        <li><strong>Client data</strong> as described above, processed on your behalf.</li>
      </ul>
      <p>We do not use advertising trackers and we do not sell personal data.</p>
    </S>
    <S h="4. Why we use it and our legal bases (GDPR)">
      <table><tbody>
        <tr><th>Purpose</th><th>Legal basis</th></tr>
        <tr><td>Create and run your account, provide the Service, send appointment and recovery emails you configure</td><td>Performance of contract</td></tr>
        <tr><td>Billing, invoicing, tax and accounting records</td><td>Contract; legal obligation</td></tr>
        <tr><td>Security, fraud prevention, abuse detection, debugging</td><td>Legitimate interests</td></tr>
        <tr><td>Service announcements and important account notices</td><td>Contract; legitimate interests</td></tr>
        <tr><td>Product marketing emails (only if you opt in)</td><td>Consent, which you can withdraw at any time</td></tr>
      </tbody></table>
    </S>
    <S h="5. Who we share it with">
      <p>We share personal data only with service providers that help us run the Service, under contracts that protect it. The current list is on our <L to="/subprocessors">Subprocessors</L> page. We may also disclose data if required by law, to protect rights and safety, or as part of a merger or acquisition (with notice to you).</p>
    </S>
    <S h="6. International transfers">
      <p>Our main database is hosted in {site.dataRegion}. The European Commission and the UK have recognised South Korea as providing adequate data protection. Some providers (for example hosting, email delivery and payments) process data in the United States, India or other countries. Where data leaves the EEA, UK or Switzerland for a country without an adequacy decision, we rely on the European Commission's Standard Contractual Clauses (and the UK Addendum) or another lawful transfer mechanism.</p>
    </S>
    <S h="7. How long we keep it">
      <ul>
        <li>Account and client data: for as long as your account is active. After cancellation, you can export data for 30 days; we then delete it from active systems, and it is removed from backups on their normal rotation.</li>
        <li>Billing and tax records: as long as tax and accounting laws require (typically up to 8 years).</li>
        <li>Security logs: generally up to 90 days.</li>
      </ul>
    </S>
    <S h="8. Security">
      <p>We use encryption in transit (TLS), encryption at rest provided by our database host, database row-level security that separates each business's data, restricted administrative access, and random, unguessable tokens for public appointment links. No system is perfectly secure; if a breach affects your personal data we will notify you and regulators as the law requires.</p>
    </S>
    <S h="9. Your rights">
      <p><strong>EEA, UK and Switzerland:</strong> you can request access, correction, deletion, restriction, portability, and object to processing based on legitimate interests. Where we rely on consent, you can withdraw it at any time. You can complain to your local data protection authority.</p>
      <p><strong>California and other US states:</strong> you can request to know, access, correct and delete personal information, and to opt out of sale, sharing for targeted advertising and profiling. We do not sell or share personal information for targeted advertising and do not use sensitive personal information for purposes that require an opt-out. We will not discriminate against you for exercising your rights. You may use an authorised agent. If we deny your request, you may appeal by replying to our decision.</p>
      <p>To exercise any right, email <Mail to={site.privacyEmail}/>. We will verify your request and respond within the time required by law (one month under GDPR, 45 days under CCPA).</p>
    </S>
    <S h="10. Cookies">
      <p>We only use storage that is strictly necessary to keep you signed in and to process payments. See our <L to="/cookies">Cookie Policy</L>.</p>
    </S>
    <S h="11. Children">
      <p>The Service is for businesses and is not directed to children under 16. We do not knowingly collect their personal data.</p>
    </S>
    <S h="12. Changes">
      <p>We will post updates here and change the effective date. For material changes we will notify account holders by email or in the app.</p>
    </S>
  </>
}

function Cookies() {
  return <>
    <S h="Summary">
      <p>{site.product} does not use advertising cookies. We use browser storage that is strictly necessary to provide the Service, plus privacy-friendly analytics that do not use cookies. Under EU and UK law (the ePrivacy Directive and PECR), strictly necessary storage does not require consent. If we enable Google Analytics on our website, it only runs after you accept it in the cookie banner.</p>
    </S>
    <S h="What we use">
      <table><tbody>
        <tr><th>Name / type</th><th>Provider</th><th>Purpose</th><th>Duration</th></tr>
        <tr><td>Supabase auth session (browser local storage)</td><td>{site.product} via Supabase</td><td>Keeps you signed in and secures your session</td><td>Until you sign out or the session expires</td></tr>
        <tr><td>Vercel Web Analytics (no cookies)</td><td>Vercel</td><td>Counts page views and referrers on our website without cookies or cross-site tracking; no personal profile is created</td><td>Not stored on your device</td></tr>
        <tr><td>Currency preference (local storage)</td><td>{site.product}</td><td>Remembers the currency you chose on the pricing page</td><td>Until cleared</td></tr>
        <tr><td>Google Analytics cookies (_ga, _ga_*) — only if enabled and you accept</td><td>Google</td><td>Measures how visitors find and use our marketing website</td><td>Up to 13 months</td></tr>
        <tr><td>Razorpay Checkout cookies</td><td>Razorpay</td><td>Processes your subscription authorisation and prevents payment fraud; only set when you open checkout</td><td>Set by Razorpay; see Razorpay's policy</td></tr>
      </tbody></table>
    </S>
    <S h="Managing storage">
      <p>You can clear cookies and local storage in your browser settings. If you block strictly necessary storage, you will not be able to sign in.</p>
    </S>
  </>
}

function Dpa() {
  return <>
    <S h="1. Scope and roles">
      <p>This Data Processing Addendum ("DPA") forms part of the <L to="/terms">Terms of Service</L> between you ("Customer", controller) and {site.company} ("Processor") and applies when we process personal data about Customer's clients ("Client Personal Data") on Customer's behalf. It is designed to meet Article 28 of the EU GDPR and UK GDPR, and the service-provider requirements of the CCPA/CPRA.</p>
    </S>
    <S h="2. Details of processing">
      <table><tbody>
        <tr><th>Subject matter</th><td>Providing the {site.product} appointment confirmation and cancellation-recovery service</td></tr>
        <tr><th>Duration</th><td>The term of the subscription plus the deletion period in section 9</td></tr>
        <tr><th>Nature and purpose</th><td>Storing appointments and waitlists, sending confirmation, reschedule and recovery emails, recording responses and recovered revenue</td></tr>
        <tr><th>Data subjects</th><td>Customer's clients and prospective clients; Customer's staff users</td></tr>
        <tr><th>Personal data</th><td>Names, email addresses, phone numbers, appointment times and services, waitlist preferences, responses to messages, notes entered by Customer</td></tr>
        <tr><th>Special categories</th><td>None. Customer must not submit special-category data (e.g. health data)</td></tr>
      </tbody></table>
    </S>
    <S h="3. Processor obligations">
      <ul>
        <li>Process Client Personal Data only on Customer's documented instructions (these Terms and Customer's use of the Service), unless required by law.</li>
        <li>Ensure people authorised to process the data are bound by confidentiality.</li>
        <li>Implement appropriate technical and organisational measures (section 7).</li>
        <li>Not sell or share Client Personal Data, retain, use or disclose it outside the direct business relationship, or combine it with other data except as permitted by the CCPA.</li>
        <li>Assist Customer, taking into account the nature of processing, with data subject requests, security, breach notification, impact assessments and prior consultations.</li>
        <li>Make available information needed to demonstrate compliance and allow for reasonable audits, normally satisfied by written responses and documentation, no more than once per year unless required by a regulator or after a breach.</li>
      </ul>
    </S>
    <S h="4. Subprocessors">
      <p>Customer gives general authorisation to use the subprocessors listed on our <L to="/subprocessors">Subprocessors</L> page. We will give at least 30 days' notice of new subprocessors by updating that page and emailing account owners. Customer may object on reasonable data-protection grounds; if we cannot address the objection, Customer may terminate the affected Service and receive a refund of prepaid fees for the unused period. We impose data-protection terms on subprocessors at least as protective as this DPA and remain responsible for them.</p>
    </S>
    <S h="5. International transfers">
      <p>Where Client Personal Data is transferred from the EEA, UK or Switzerland to a country without an adequacy decision, the parties agree to the EU Standard Contractual Clauses (Commission Decision 2021/914), Module 2 (controller to processor), and for the UK the International Data Transfer Addendum, which are incorporated by reference. Module 3 applies to onward transfers to subprocessors.</p>
    </S>
    <S h="6. Personal data breaches">
      <p>We will notify Customer without undue delay, and where feasible within 48 hours, after becoming aware of a personal data breach affecting Client Personal Data, and provide the information Customer reasonably needs to meet its own notification duties.</p>
    </S>
    <S h="7. Security measures">
      <ul>
        <li>Encryption in transit (TLS 1.2+) and at rest (provided by our database host).</li>
        <li>Logical separation of each customer's data using database row-level security.</li>
        <li>Least-privilege administrative access; secrets stored in managed secret stores, never in source code.</li>
        <li>Opaque, unguessable tokens for public appointment and offer links.</li>
        <li>Backups and point-in-time recovery provided by our database host.</li>
        <li>Monitoring of logs for errors and abuse.</li>
      </ul>
    </S>
    <S h="8. Data subject requests">
      <p>If we receive a request from one of Customer's clients, we will redirect it to Customer and not respond directly unless authorised. The Service lets Customer access, correct and delete client records.</p>
    </S>
    <S h="9. Return and deletion">
      <p>On termination, Customer may export Client Personal Data for 30 days. We then delete it from active systems, and it is removed from backups on their normal rotation, unless law requires retention.</p>
    </S>
    <S h="10. Precedence">
      <p>If this DPA conflicts with the Terms, this DPA prevails for Client Personal Data. If the Standard Contractual Clauses apply and conflict with this DPA, the Clauses prevail. To request a countersigned copy, email <Mail to={site.privacyEmail}/>.</p>
    </S>
  </>
}

function Subprocessors() {
  const rows = [
    ['Supabase, Inc.', 'Database, authentication, serverless functions and scheduled jobs', site.dataRegion + '; USA (support and operations)'],
    ['Vercel, Inc.', 'Web hosting, content delivery and cookieless website analytics', 'Global edge network; USA'],
    ['Razorpay Software Private Limited', 'Subscription billing and payment processing (account holders only)', 'India'],
    ['[Email delivery provider — TODO]', 'Sending account verification, appointment confirmation and recovery emails', '[Region — TODO]'],
  ]
  return <>
    <S h="Current subprocessors">
      <p>These third parties process personal data on our behalf to provide {site.product}. See our <L to="/dpa">DPA</L> for how we manage them and how you can object to changes.</p>
      <table><tbody>
        <tr><th>Subprocessor</th><th>Purpose</th><th>Location</th></tr>
        {rows.map(r => <tr key={r[0]}><td>{r[0]}</td><td>{r[1]}</td><td>{r[2]}</td></tr>)}
      </tbody></table>
    </S>
    <S h="Updates">
      <p>We give at least 30 days' notice before adding a subprocessor. To receive notices, make sure your account email is current or write to <Mail to={site.privacyEmail}/>.</p>
    </S>
  </>
}

function AcceptableUse() {
  return <>
    <S h="Purpose">
      <p>This policy keeps {site.product} safe and reliable for customers and the people who receive messages from it. It forms part of our <L to="/terms">Terms of Service</L>.</p>
    </S>
    <S h="Messaging rules">
      <ul>
        <li>Only send messages to people who have booked with you, asked to join your waitlist, or otherwise have an existing relationship with your business.</li>
        <li>Use the Service for appointment-related messages only. No marketing blasts, newsletters or promotions.</li>
        <li>Honour opt-out and "stop contacting me" requests promptly.</li>
        <li>Follow the laws that apply to you, including CAN-SPAM (US), GDPR and ePrivacy rules (EU/UK), and CASL (Canada).</li>
      </ul>
    </S>
    <S h="You must not">
      <ul>
        <li>Upload protected health information, payment card data, government ID numbers or other sensitive data.</li>
        <li>Use the Service for anything illegal, fraudulent, deceptive, harassing or discriminatory.</li>
        <li>Impersonate another person or business, or send misleading sender information.</li>
        <li>Try to access other customers' data, probe or bypass security, or disrupt the Service.</li>
        <li>Scrape, resell or sublicense the Service, or use automated means to create accounts.</li>
        <li>Upload malware or harmful code.</li>
      </ul>
    </S>
    <S h="Enforcement">
      <p>We may remove content, pause messaging, or suspend accounts that break this policy, with notice where practical. Report abuse to <Mail to={site.supportEmail}/>.</p>
    </S>
  </>
}

function Refunds() {
  return <>
    <S h="Free trial">
      <p>Every new account gets a {site.trialDays}-day free trial. <strong>No payment method is needed and nothing is charged automatically.</strong> The trial includes {site.freeRecoveries} recovered slot from your waitlist; you can upgrade at any time for unlimited recovery. When the trial ends, your workspace pauses until you choose a plan.</p>
    </S>
    <S h="Who you pay">
      <p>All payments for {site.product} are made to <strong>{site.company}</strong>, which operates the Service, and are processed securely by Razorpay. Charges appear on your bank or card statement under that name.</p>
    </S>
    <S h="Automatic renewal">
      <p>Subscriptions renew automatically at the end of each billing period at the price shown at sign-up, until you cancel. We will email you before any price change takes effect.</p>
    </S>
    <S h="How to cancel">
      <p>Cancel online at any time in <strong>Settings → Subscription → Cancel subscription</strong>. The free trial needs no cancellation, since nothing is charged. If you cancel during a paid period, renewal stops and you keep access until the end of that period.</p>
      <p>You can also email <Mail to={site.billingEmail}/> from your account email with the subject "Cancel subscription"; we confirm within one business day.</p>
    </S>
    <S h="Refunds">
      <ul>
        <li>Fees are charged in advance and are generally non-refundable, including for partially used billing periods.</li>
        <li>If you were charged after cancelling in time, charged twice, or charged in error, we refund the full amount.</li>
        <li>If you contact us within 7 days of your first payment and haven’t used the paid Service, we will refund that payment.</li>
        <li>Where local law gives you additional rights, those rights apply.</li>
      </ul>
      <p>Approved refunds go back to the original payment method, usually within 5–10 business days depending on your bank.</p>
    </S>
    <S h="Delivery">
      <p>{site.product} is a digital, cloud-based service. No physical goods are shipped. Access is available immediately after sign-up and email verification.</p>
    </S>
  </>
}

function Contact() {
  return <>
    <S h="Get in touch">
      <table><tbody>
        <tr><th>General support</th><td><Mail to={site.supportEmail}/></td></tr>
        <tr><th>Billing and cancellations</th><td><Mail to={site.billingEmail}/></td></tr>
        <tr><th>Privacy and data requests</th><td><Mail to={site.privacyEmail}/></td></tr>
        <tr><th>Business</th><td>{site.company}<br/>{site.address}</td></tr>
      </tbody></table>
      <p>We reply to support requests within one business day (Monday–Friday). Many answers are in the <L to="/help">Help Center</L>.</p>
    </S>
  </>
}

const docs = {
  '/terms': ['Terms of Service', Terms],
  '/privacy': ['Privacy Policy', Privacy],
  '/cookies': ['Cookie Policy', Cookies],
  '/dpa': ['Data Processing Addendum', Dpa],
  '/subprocessors': ['Subprocessors', Subprocessors],
  '/acceptable-use': ['Acceptable Use Policy', AcceptableUse],
  '/refunds': ['Refund & Cancellation Policy', Refunds],
  '/contact': ['Contact', Contact],
}

export const isLegalPath = (path) => Boolean(docs[path])

export function SiteHeader() {
  return <header className="site-header">
    <a href="/" className="site-brand"><LogoMark size={30}/>{site.product}</a>
    <a href="/app" className="site-back"><ArrowLeft size={15}/> Back to app</a>
  </header>
}

export function SiteFooter() {
  return <footer className="site-footer">
    <nav>
      <a href="/help">Help Center</a>
      {legalLinks.map(([to, label]) => <a key={to} href={to}>{label}</a>)}
    </nav>
    <p>© {new Date().getFullYear()} {site.company}. {site.product} is operated by {site.company}.</p>
  </footer>
}

export function LegalPage({ path }) {
  const [title, Body] = docs[path]
  return <div className="site-shell">
    <SiteHeader />
    <div className="legal-layout">
      <aside className="legal-nav">
        <p>Legal</p>
        {legalLinks.map(([to, label]) => <a key={to} href={to} className={to === path ? 'active' : ''}>{label}</a>)}
      </aside>
      <article className="legal-doc">
        <p className="legal-kicker">{site.product} · {site.company}</p>
        <h1>{title}</h1>
        <p className="legal-date">Effective {site.effectiveDate}</p>
        <Body />
      </article>
    </div>
    <SiteFooter />
  </div>
}
