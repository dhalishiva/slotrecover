-- Switch billing from the ₹10 test plan to the live ₹299 plan.
update public.billing_plans set active = true,  updated_at = now() where code = 'live_monthly_inr';
update public.billing_plans set active = false, updated_at = now() where code = 'test_monthly';

-- New signups get the live standard plan (INR until international plans are switched on).
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
  order by test_mode asc, (currency = 'INR') desc, created_at asc
  limit 1;

  if v_plan_id is not null then
    insert into public.billing_accounts(user_id, plan_id, status, trial_started_at, trial_ends_at)
    values (new.id, v_plan_id, 'trialing', now(), now() + make_interval(days => v_trial_days))
    on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;

-- Existing (test) accounts move to the live plan; test-mode subscription IDs don't exist in live mode.
update public.billing_accounts
set plan_id = (select id from public.billing_plans where code = 'live_monthly_inr'),
    razorpay_subscription_id = null,
    razorpay_payment_id = null,
    razorpay_customer_id = null,
    authorization_verified_at = null,
    updated_at = now()
where plan_id = (select id from public.billing_plans where code = 'test_monthly');
