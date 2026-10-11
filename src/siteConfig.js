// Single source of truth for business details used across legal pages,
// the Help Center and the help bubble. Fill in every value marked TODO
// before public launch, then have a lawyer review the legal pages.
export const site = {
  product: 'SlotRecover',
  company: 'Shiva Dhali Services',
  // TODO: legal form, e.g. "a sole proprietorship registered in India"
  companyDescription: 'a business registered in India',
  // TODO: full registered postal address (required on invoices, GDPR and CAN-SPAM)
  address: '[Registered business address], Noida, Uttar Pradesh, India',
  // One inbox for everything for now; split later by changing these.
  supportEmail: 'support@kriosity.in',
  privacyEmail: 'support@kriosity.in',
  billingEmail: 'support@kriosity.in',
  // WhatsApp for customers: shown as text, linked as wa.me/<digits>.
  whatsapp: '+91 97164 14417',
  whatsappDigits: '919716414417',
  url: 'https://www.slotrecover.pro',
  // TODO: appoint before actively marketing to the EU / UK (GDPR Art. 27)
  euRepresentative: 'To be appointed. Until then, contact support@kriosity.in.',
  ukRepresentative: 'To be appointed. Until then, contact support@kriosity.in.',
  governingLaw: 'the laws of India',
  venue: 'the courts of New Delhi, India',
  effectiveDate: 'September 29, 2026',
  dataRegion: 'South Korea (Seoul, ap-northeast-2)',
  trialDays: 30,
  freeRecoveries: 1,
  offerExpiryMinutes: 15,
}
