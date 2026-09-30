-- Longer billing terms alongside the $29 monthly plan.
insert into public.billing_plans (code, name, amount_paise, currency, period, interval_count, trial_days, test_mode, active, plan_group)
select v.code, v.name, v.amount, 'USD', v.period, v.interval_count, 7, false, true, 'standard'
from (values
  ('live_6month_usd', 'SlotRecover 6 Months', 16500, 'monthly', 6),
  ('live_yearly_usd', 'SlotRecover Yearly',   29900, 'yearly',  1)
) as v(code, name, amount, period, interval_count)
where not exists (select 1 from public.billing_plans p where p.code = v.code);

-- New signups default to the monthly USD plan; they can pick a longer term at activation.
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
  order by test_mode asc, (currency = 'USD') desc, (period = 'monthly' and interval_count = 1) desc, created_at asc
  limit 1;

  if v_plan_id is not null then
    insert into public.billing_accounts(user_id, plan_id, status, trial_started_at, trial_ends_at)
    values (new.id, v_plan_id, 'trialing', now(), now() + make_interval(days => v_trial_days))
    on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;

-- Same rule as hasAccess() in the app: an authorized trial, a paid plan, or a
-- cancelled plan that hasn't run out yet. Practices whose owner has no billing row are allowed.
create or replace function private.practice_billing_active(p_practice_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select b.status in ('authenticated', 'active')
        or (b.status = 'cancelled' and greatest(b.trial_ends_at, b.current_period_end) > now())
    from public.practices p
    join public.billing_accounts b on b.user_id = p.owner_id
    where p.id = p_practice_id
  ), true);
$$;

-- Users can explore and set up without activating, but adding appointments or
-- waitlist entries needs a trial or plan. Service-role work (no auth.uid()) is untouched.
create or replace function private.require_active_billing()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and not private.practice_billing_active(new.practice_id) then
    raise exception using
      message = 'Activate your plan to add appointments.',
      hint = 'activation_required';
  end if;
  return new;
end;
$$;

drop trigger if exists appointments_require_active_billing on public.appointments;
create trigger appointments_require_active_billing
  before insert on public.appointments
  for each row execute function private.require_active_billing();

drop trigger if exists waitlist_entries_require_active_billing on public.waitlist_entries;
create trigger waitlist_entries_require_active_billing
  before insert on public.waitlist_entries
  for each row execute function private.require_active_billing();
