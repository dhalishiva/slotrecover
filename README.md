# SlotRecover MVP

Revenue recovery SaaS for appointment-based solo practitioners. The first release focuses on confirmations, cancellation detection, waitlist refill workflows, and recovered-revenue reporting.

## Stack

- React 19 + Vite
- Supabase Auth + Postgres + RLS
- Supabase Edge Functions / cron-backed recovery workflows
- Vercel for frontend hosting

## Run locally

```bash
npm install
cp .env.example .env
npm run dev
```

Set these variables in `.env`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

If the variables are absent, the frontend opens in demo mode and does not connect to a backend.

## Deploy to Vercel

Import this GitHub repository into Vercel.

- Framework preset: Vite
- Build command: `npm run build`
- Output directory: `dist`

Add both Supabase variables in Vercel project settings and redeploy.
