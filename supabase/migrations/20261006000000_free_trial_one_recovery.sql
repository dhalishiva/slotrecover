-- 30-day free trial with no card. During the free trial a workspace can book, confirm and
-- message as normal, but the recovery engine fills only ONE cancelled slot. After that the
-- dashboard asks the owner to upgrade. When the trial ends without a plan, the workspace locks
-- (data kept) until they upgrade.

-- 1. Trial length.
update public.billing_plans set trial_days = 30, updated_at = now() where plan_group = 'standard';

-- Existing free-trial accounts (no card, no subscription) get the full 30 days from signup.
update public.billing_accounts
set trial_ends_at = trial_started_at + interval '30 days', updated_at = now()
where status = 'trialing'
  and razorpay_subscription_id is null
  and authorization_verified_at is null;

-- 2. One place that says what a workspace is entitled to.
--    'paid'    : authorised or active plan, or a cancelled plan still inside its paid period
--    'free'    : free trial (no card) that hasn't ended
--    'expired' : anything else (trial over, payment failed, cancelled and run out)
--    Practices whose owner has no billing row are treated as paid (internal/legacy accounts).
create or replace function private.practice_plan_state(p_practice_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select case
      when b.status in ('authenticated', 'active') then 'paid'
      when b.status = 'cancelled' and greatest(b.trial_ends_at, b.current_period_end) > now() then 'paid'
      -- Free trial, including someone who opened checkout but didn't finish it.
      when b.status in ('trialing', 'authorization_pending')
           and b.authorization_verified_at is null
           and b.trial_ends_at > now() then 'free'
      else 'expired'
    end
    from public.practices p
    join public.billing_accounts b on b.user_id = p.owner_id
    where p.id = p_practice_id
  ), 'paid');
$$;

-- Number of recovered slots the free trial includes.
create or replace function private.free_recovery_limit()
returns integer language sql immutable set search_path = '' as $$ select 1 $$;

-- A free-trial recovery counts once it is recovered OR an offer for it is out, so two
-- cancellations at once can't both be filled for free.
create or replace function private.free_recoveries_used(p_practice_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select (select count(*)::int from public.revenue_events where practice_id = p_practice_id and event_type = 'recovered')
       + (select count(*)::int from public.recovery_offers where practice_id = p_practice_id and status = 'offered');
$$;

create or replace function private.practice_can_recover(p_practice_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case private.practice_plan_state(p_practice_id)
    when 'paid' then true
    when 'free' then private.free_recoveries_used(p_practice_id) < private.free_recovery_limit()
    else false
  end;
$$;

-- 3. Booking is allowed on a paid plan or during the free trial (replaces the old rule that
--    required a card-authorised trial). Used by the appointment/waitlist insert triggers.
create or replace function private.practice_billing_active(p_practice_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.practice_plan_state(p_practice_id) <> 'expired';
$$;

create or replace function private.require_active_billing()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and not private.practice_billing_active(new.practice_id) then
    raise exception using
      message = 'Your free trial has ended. Upgrade to add appointments.',
      hint = 'activation_required';
  end if;
  return new;
end;
$$;

revoke all on function private.practice_plan_state(uuid) from public, anon, authenticated;
revoke all on function private.free_recoveries_used(uuid) from public, anon, authenticated;
revoke all on function private.practice_can_recover(uuid) from public, anon, authenticated;
revoke all on function private.free_recovery_limit() from public, anon, authenticated;

-- 4. Recovery engine: same as before, plus the plan check.
create or replace function public.create_next_recovery_offer(p_appointment_id uuid)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare
  appt public.appointments%rowtype;
  candidate public.waitlist_entries%rowtype;
  offer_id uuid;
begin
  select * into appt from public.appointments where id = p_appointment_id for update;
  if not found or appt.status <> 'cancelled' then return null; end if;
  if exists (select 1 from public.recovery_offers where appointment_id = p_appointment_id and status = 'offered') then return null; end if;

  -- Free trial includes one recovered slot; expired workspaces get none.
  perform pg_advisory_xact_lock(hashtextextended('recovery-quota:' || appt.practice_id::text, 0));
  if not private.practice_can_recover(appt.practice_id) then return null; end if;

  -- The freed time must still be bookable with the original staff member
  -- (someone may already have been booked into it manually).
  if appt.staff_id is not null
     and not private.staff_is_free(appt.practice_id, appt.staff_id, appt.start_at, appt.end_at, appt.id) then
    return null;
  end if;

  select * into candidate
  from public.waitlist_entries w
  where w.practice_id = appt.practice_id
    and w.service_id = appt.service_id
    and w.status = 'active'
    and (w.staff_id is null or appt.staff_id is null or w.staff_id = appt.staff_id)
    and appt.start_at between w.window_start and w.window_end
    and appt.start_at >= now() + make_interval(mins => w.min_notice_minutes)
  order by w.priority asc, w.created_at asc
  limit 1
  for update skip locked;
  if not found then return null; end if;

  update public.waitlist_entries set status = 'offered' where id = candidate.id;
  insert into public.recovery_offers(practice_id, appointment_id, waitlist_entry_id, client_id, expires_at)
  values (appt.practice_id, appt.id, candidate.id, candidate.client_id, now() + interval '15 minutes')
  returning id into offer_id;
  return offer_id;
end; $$;

-- 5. What the app shows: plan state and free recoveries used, for the signed-in owner's practice.
create or replace function private.my_plan_status_internal()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'state', private.practice_plan_state(p.id),
    'free_recoveries_used', (select count(*)::int from public.revenue_events r where r.practice_id = p.id and r.event_type = 'recovered'),
    'free_recovery_limit', private.free_recovery_limit()
  )
  from public.practices p
  where p.owner_id = auth.uid()
  order by p.created_at
  limit 1;
$$;
revoke all on function private.my_plan_status_internal() from public, anon;
grant execute on function private.my_plan_status_internal() to authenticated;

create or replace function public.my_plan_status()
returns jsonb
language sql
stable
set search_path = ''
as $$ select private.my_plan_status_internal(); $$;
revoke all on function public.my_plan_status() from public, anon;
grant execute on function public.my_plan_status() to authenticated;
