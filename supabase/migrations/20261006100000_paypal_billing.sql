-- Switch paid plans from Razorpay to PayPal subscriptions.
-- Razorpay columns stay for history; no live Razorpay subscriptions exist.

alter table public.billing_plans
  add column if not exists paypal_plan_id text unique,
  add column if not exists paypal_sandbox_plan_id text unique;

alter table public.billing_accounts
  add column if not exists payment_provider text,
  add column if not exists paypal_subscription_id text unique;

alter table public.billing_accounts drop constraint if exists billing_accounts_payment_provider_check;
alter table public.billing_accounts
  add constraint billing_accounts_payment_provider_check
  check (payment_provider is null or payment_provider in ('razorpay', 'paypal'));

alter table public.billing_events
  add column if not exists paypal_subscription_id text;

create index if not exists billing_events_paypal_subscription_idx
  on public.billing_events (paypal_subscription_id) where paypal_subscription_id is not null;

-- Clients only ever read these tables (through RLS). Nothing else is needed.
revoke truncate, references, trigger on public.billing_accounts, public.billing_plans, public.billing_events from anon, authenticated;
