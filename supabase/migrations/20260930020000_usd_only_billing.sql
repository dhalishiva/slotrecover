-- Bill everyone, including India, in USD: add a live $29 plan and retire the ₹299 plan.
-- The billing function creates the matching Razorpay plan on first checkout.
insert into public.billing_plans (code, name, amount_paise, currency, period, interval_count, trial_days, test_mode, active, plan_group)
select 'live_monthly_usd', 'SlotRecover Monthly', 2900, 'USD', 'monthly', 1, 7, false, true, 'standard'
where not exists (select 1 from public.billing_plans where code = 'live_monthly_usd');

update public.billing_plans set active = true,  updated_at = now() where code = 'live_monthly_usd';
update public.billing_plans set active = false, updated_at = now() where code = 'live_monthly_inr';

-- New signups get the live USD plan.
create or replace function public.handle_new_user_billing()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan_id uuid;
  v_trial_days integer;
begin
  select id, trial_days into v_plan_id, v_trial_days
  from public.billing_plans
  where active = true and plan_group = 'standard'
  order by test_mode asc, (currency = 'USD') desc, created_at asc
  limit 1;

  if v_plan_id is not null then
    insert into public.billing_accounts(user_id, plan_id, status, trial_started_at, trial_ends_at)
    values (new.id, v_plan_id, 'trialing', now(), now() + make_interval(days => v_trial_days))
    on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;

-- Accounts that never authorized an INR mandate move to USD; an unauthorized INR subscription can't be reused.
update public.billing_accounts
set plan_id = (select id from public.billing_plans where code = 'live_monthly_usd'),
    razorpay_subscription_id = null,
    razorpay_payment_id = null,
    razorpay_customer_id = null,
    authorization_verified_at = null,
    status = 'trialing',
    updated_at = now()
where plan_id = (select id from public.billing_plans where code = 'live_monthly_inr')
  and status in ('trialing', 'authorization_pending');
