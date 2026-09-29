-- One plan per currency, grouped so the app can pick the visitor's currency.
-- USD/EUR/GBP stay inactive until Razorpay international payments are enabled.
alter table public.billing_plans add column if not exists plan_group text not null default 'standard';

insert into public.billing_plans (code, name, amount_paise, currency, period, interval_count, trial_days, test_mode, active, plan_group)
select v.code, 'SlotRecover Test Monthly', v.amount, v.currency, 'monthly', 1, 7, true, false, 'standard'
from (values ('test_monthly_usd', 100, 'USD'), ('test_monthly_eur', 100, 'EUR'), ('test_monthly_gbp', 100, 'GBP')) as v(code, amount, currency)
where not exists (select 1 from public.billing_plans p where p.code = v.code);
