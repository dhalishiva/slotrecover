-- Staff members, the services each can perform, per-staff availability,
-- client note / default country code on practices.

-- ---------- Tables ----------
create table if not exists public.staff (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists staff_practice_idx on public.staff(practice_id);

create table if not exists public.staff_services (
  staff_id uuid not null references public.staff(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  practice_id uuid not null references public.practices(id) on delete cascade,
  primary key (staff_id, service_id)
);
create index if not exists staff_services_service_idx on public.staff_services(service_id);

alter table public.appointments add column if not exists staff_id uuid references public.staff(id) on delete set null;
alter table public.waitlist_entries add column if not exists staff_id uuid references public.staff(id) on delete set null;
create index if not exists appointments_staff_start_idx on public.appointments(staff_id, start_at);

alter table public.practices
  add column if not exists client_note text,
  add column if not exists default_country_code text not null default '+1';
do $$ begin
  alter table public.practices add constraint practices_client_note_len check (client_note is null or length(client_note) <= 600);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.practices add constraint practices_country_code_format check (default_country_code ~ '^\+[0-9]{1,4}$');
exception when duplicate_object then null; end $$;

-- ---------- RLS ----------
alter table public.staff enable row level security;
alter table public.staff_services enable row level security;

drop policy if exists staff_all on public.staff;
create policy staff_all on public.staff for all to authenticated
  using (private.user_can_access_practice(practice_id))
  with check (private.user_can_access_practice(practice_id));

drop policy if exists staff_services_all on public.staff_services;
create policy staff_services_all on public.staff_services for all to authenticated
  using (private.user_can_access_practice(practice_id))
  with check (private.user_can_access_practice(practice_id));

-- Staff, service and link row must all belong to the same practice.
create or replace function private.staff_services_same_practice()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
  if not exists (select 1 from public.staff where id = new.staff_id and practice_id = new.practice_id)
     or not exists (select 1 from public.services where id = new.service_id and practice_id = new.practice_id) then
    raise exception 'Staff member and service must belong to the same business';
  end if;
  return new;
end; $$;
drop trigger if exists staff_services_same_practice on public.staff_services;
create trigger staff_services_same_practice before insert or update on public.staff_services
  for each row execute function private.staff_services_same_practice();

-- New services are offered by every active staff member by default.
create or replace function private.assign_new_service_to_staff()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
  insert into public.staff_services(staff_id, service_id, practice_id)
  select s.id, new.id, new.practice_id from public.staff s
  where s.practice_id = new.practice_id and s.active
  on conflict do nothing;
  return new;
end; $$;
drop trigger if exists services_assign_staff on public.services;
create trigger services_assign_staff after insert on public.services
  for each row execute function private.assign_new_service_to_staff();

-- ---------- Backfill: one staff member per existing practice ----------
insert into public.staff(practice_id, name)
select p.id, 'Owner' from public.practices p
where not exists (select 1 from public.staff s where s.practice_id = p.id);

insert into public.staff_services(staff_id, service_id, practice_id)
select st.id, sv.id, sv.practice_id
from public.services sv join public.staff st on st.practice_id = sv.practice_id
on conflict do nothing;

update public.appointments a set staff_id = (
  select s.id from public.staff s where s.practice_id = a.practice_id order by s.created_at limit 1)
where a.staff_id is null;

-- ---------- Availability helpers ----------
-- Qualified, active staff for a service (optionally one specific person).
create or replace function private.qualified_staff(p_practice_id uuid, p_service_id uuid, p_staff_id uuid default null)
returns setof uuid language sql stable security definer set search_path to '' as $$
  select s.id from public.staff s
  join public.staff_services ss on ss.staff_id = s.id and ss.service_id = p_service_id
  where s.practice_id = p_practice_id and s.active
    and (p_staff_id is null or s.id = p_staff_id)
$$;

-- Is a staff member free for [start, end)? Legacy unassigned bookings block everyone.
create or replace function private.staff_is_free(p_practice_id uuid, p_staff_id uuid, p_start timestamptz, p_end timestamptz, p_exclude uuid default null)
returns boolean language sql stable security definer set search_path to '' as $$
  select not exists (
    select 1 from public.appointments a
    where a.practice_id = p_practice_id
      and a.status in ('booked', 'confirmed')
      and (a.staff_id = p_staff_id or a.staff_id is null)
      and (p_exclude is null or a.id <> p_exclude)
      and p_start < a.end_at and p_end > a.start_at
  )
$$;

-- Choose a free qualified staff member: the preferred one if free, otherwise
-- (unless strict) whoever has the fewest bookings that day.
create or replace function private.pick_free_staff(
  p_practice_id uuid, p_service_id uuid, p_start timestamptz, p_end timestamptz,
  p_preferred uuid default null, p_strict boolean default false, p_exclude uuid default null
)
returns uuid language plpgsql stable security definer set search_path to '' as $$
declare v_id uuid;
begin
  if p_preferred is not null then
    select q into v_id from private.qualified_staff(p_practice_id, p_service_id, p_preferred) q
    where private.staff_is_free(p_practice_id, q, p_start, p_end, p_exclude);
    if v_id is not null or p_strict then return v_id; end if;
  end if;

  select q into v_id
  from private.qualified_staff(p_practice_id, p_service_id) q
  where private.staff_is_free(p_practice_id, q, p_start, p_end, p_exclude)
  order by (
    select count(*) from public.appointments a
    where a.staff_id = q and a.status in ('booked', 'confirmed')
      and a.start_at >= date_trunc('day', p_start) and a.start_at < date_trunc('day', p_start) + interval '1 day'
  ), q
  limit 1;
  return v_id;
end; $$;

drop function if exists private.practice_day_slots(uuid, uuid, date, uuid);
create function private.practice_day_slots(
  p_practice_id uuid, p_service_id uuid, p_date date,
  p_exclude_appointment_id uuid default null, p_staff_id uuid default null
)
returns table(start_at timestamptz, end_at timestamptz, available boolean, free_count integer)
language plpgsql stable security definer set search_path to '' as $$
declare
  v_practice public.practices%rowtype;
  v_duration integer;
  v_open timestamptz;
  v_close timestamptz;
begin
  select * into v_practice from public.practices where id = p_practice_id;
  if not found then return; end if;
  select duration_minutes into v_duration from public.services where id = p_service_id and practice_id = p_practice_id;
  if v_duration is null then return; end if;
  if not (extract(isodow from p_date)::smallint = any(v_practice.working_days)) then return; end if;

  v_open := (p_date + v_practice.open_time) at time zone v_practice.timezone;
  v_close := (p_date + v_practice.close_time) at time zone v_practice.timezone;

  return query
  with grid as (
    select gs as s, gs + make_interval(mins => v_duration) as e
    from generate_series(v_open, v_close - make_interval(mins => v_duration), make_interval(mins => v_practice.slot_interval_minutes)) gs
    where gs > now()
  )
  select g.s, g.e, c.n > 0, c.n
  from grid g
  cross join lateral (
    select count(*)::integer as n
    from private.qualified_staff(p_practice_id, p_service_id, p_staff_id) q
    where private.staff_is_free(p_practice_id, q, g.s, g.e, p_exclude_appointment_id)
  ) c
  order by g.s;
end; $$;

create or replace function private.service_staff_json(p_practice_id uuid, p_service_id uuid)
returns jsonb language sql stable security definer set search_path to '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name) order by s.name), '[]'::jsonb)
  from public.staff s join public.staff_services ss on ss.staff_id = s.id and ss.service_id = p_service_id
  where s.practice_id = p_practice_id and s.active
$$;

-- ---------- Staff-facing availability ----------
drop function if exists public.get_practice_availability(uuid, uuid, date);
drop function if exists private.get_practice_availability_internal(uuid, uuid, date);

create function private.get_practice_availability_internal(p_practice_id uuid, p_service_id uuid, p_date date, p_staff_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare
  v_practice public.practices%rowtype;
  v_slots jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not private.user_can_access_practice(p_practice_id) then raise exception 'You do not have access to this practice'; end if;
  select * into v_practice from public.practices where id = p_practice_id;

  select coalesce(jsonb_agg(jsonb_build_object('start_at', s.start_at, 'end_at', s.end_at, 'available', s.available, 'free_count', s.free_count) order by s.start_at), '[]'::jsonb)
  into v_slots
  from private.practice_day_slots(p_practice_id, p_service_id, p_date, null, p_staff_id) s;

  return jsonb_build_object(
    'ok', true,
    'timezone', v_practice.timezone,
    'closed', not (extract(isodow from p_date)::smallint = any(v_practice.working_days)),
    'staff', private.service_staff_json(p_practice_id, p_service_id),
    'slots', v_slots
  );
end; $$;
revoke all on function private.get_practice_availability_internal(uuid, uuid, date, uuid) from public, anon;
grant execute on function private.get_practice_availability_internal(uuid, uuid, date, uuid) to authenticated;

create function public.get_practice_availability(p_practice_id uuid, p_service_id uuid, p_date date, p_staff_id uuid default null)
returns jsonb language sql stable set search_path to '' as $$
  select private.get_practice_availability_internal(p_practice_id, p_service_id, p_date, p_staff_id);
$$;
revoke all on function public.get_practice_availability(uuid, uuid, date, uuid) from public, anon;
grant execute on function public.get_practice_availability(uuid, uuid, date, uuid) to authenticated;

-- ---------- Create appointment (with staff) ----------
drop function if exists public.create_appointment(uuid, uuid, text, text, text, text, timestamptz);
drop function if exists private.create_appointment_internal(uuid, uuid, text, text, text, text, timestamptz);

create function private.create_appointment_internal(
  p_practice_id uuid, p_service_id uuid, p_first_name text, p_last_name text,
  p_email text, p_phone text, p_start_at timestamptz, p_staff_id uuid
)
returns uuid language plpgsql security definer set search_path to '' as $$
declare
  v_user_id uuid := auth.uid();
  v_client_id uuid;
  v_appointment_id uuid;
  v_duration integer;
  v_end_at timestamptz;
  v_staff uuid;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.practice_members where practice_id = p_practice_id and user_id = v_user_id) then
    raise exception 'You do not have access to this practice';
  end if;

  select duration_minutes into v_duration from public.services
  where id = p_service_id and practice_id = p_practice_id and active = true;
  if v_duration is null then raise exception 'Service not found'; end if;
  if nullif(btrim(p_first_name), '') is null then raise exception 'Client first name is required'; end if;
  if p_start_at is null then raise exception 'Start time is required'; end if;

  v_end_at := p_start_at + make_interval(mins => v_duration);
  perform pg_advisory_xact_lock(hashtextextended(p_practice_id::text, 0));

  v_staff := private.pick_free_staff(p_practice_id, p_service_id, p_start_at, v_end_at, p_staff_id, p_staff_id is not null);
  if v_staff is null then
    raise exception using
      message = case when p_staff_id is null
        then 'Nobody who offers this service is free at that time. Choose another time or add the client to the waitlist.'
        else 'That staff member is already booked at that time. Choose another time, another staff member, or add the client to the waitlist.' end,
      hint = 'slot_unavailable';
  end if;

  insert into public.clients(practice_id, first_name, last_name, email, phone)
  values (p_practice_id, btrim(p_first_name), nullif(btrim(p_last_name), ''), nullif(btrim(p_email), ''), nullif(btrim(p_phone), ''))
  returning id into v_client_id;

  insert into public.appointments(practice_id, service_id, client_id, staff_id, start_at, end_at, status, source)
  values (p_practice_id, p_service_id, v_client_id, v_staff, p_start_at, v_end_at, 'booked', 'manual')
  returning id into v_appointment_id;

  return v_appointment_id;
end; $$;
revoke all on function private.create_appointment_internal(uuid, uuid, text, text, text, text, timestamptz, uuid) from public, anon;
grant execute on function private.create_appointment_internal(uuid, uuid, text, text, text, text, timestamptz, uuid) to authenticated;

create function public.create_appointment(
  p_practice_id uuid, p_service_id uuid, p_first_name text, p_last_name text default '',
  p_email text default '', p_phone text default '', p_start_at timestamptz default null, p_staff_id uuid default null
)
returns uuid language sql set search_path to '' as $$
  select private.create_appointment_internal(p_practice_id, p_service_id, p_first_name, p_last_name, p_email, p_phone, p_start_at, p_staff_id);
$$;
revoke all on function public.create_appointment(uuid, uuid, text, text, text, text, timestamptz, uuid) from public, anon;
grant execute on function public.create_appointment(uuid, uuid, text, text, text, text, timestamptz, uuid) to authenticated, service_role;

-- ---------- Waitlist (with optional staff preference) ----------
drop function if exists public.add_waitlist_entry(uuid, uuid, text, text, text, text, timestamptz, timestamptz, integer);
drop function if exists private.add_waitlist_entry_internal(uuid, uuid, text, text, text, text, timestamptz, timestamptz, integer);

create function private.add_waitlist_entry_internal(
  p_practice_id uuid, p_service_id uuid, p_first_name text, p_last_name text, p_email text, p_phone text,
  p_window_start timestamptz, p_window_end timestamptz, p_min_notice_minutes integer, p_staff_id uuid
)
returns uuid language plpgsql security definer set search_path to '' as $$
declare
  v_user_id uuid := auth.uid();
  v_client_id uuid;
  v_entry_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.practice_members where practice_id = p_practice_id and user_id = v_user_id) then
    raise exception 'You do not have access to this practice';
  end if;
  if not exists (select 1 from public.services where id = p_service_id and practice_id = p_practice_id and active = true) then
    raise exception 'Service not found';
  end if;
  if p_staff_id is not null and not exists (select 1 from public.staff where id = p_staff_id and practice_id = p_practice_id) then
    raise exception 'Staff member not found';
  end if;
  if nullif(btrim(p_first_name), '') is null then raise exception 'Client first name is required'; end if;
  if p_window_start is null or p_window_end is null or p_window_end <= p_window_start then raise exception 'Waitlist window is invalid'; end if;

  insert into public.clients(practice_id, first_name, last_name, email, phone)
  values (p_practice_id, btrim(p_first_name), nullif(btrim(p_last_name), ''), nullif(btrim(p_email), ''), nullif(btrim(p_phone), ''))
  returning id into v_client_id;

  insert into public.waitlist_entries(practice_id, client_id, service_id, staff_id, window_start, window_end, min_notice_minutes, priority, status)
  values (p_practice_id, v_client_id, p_service_id, p_staff_id, p_window_start, p_window_end, greatest(coalesce(p_min_notice_minutes, 60), 0), 100, 'active')
  returning id into v_entry_id;
  return v_entry_id;
end; $$;
revoke all on function private.add_waitlist_entry_internal(uuid, uuid, text, text, text, text, timestamptz, timestamptz, integer, uuid) from public, anon;
grant execute on function private.add_waitlist_entry_internal(uuid, uuid, text, text, text, text, timestamptz, timestamptz, integer, uuid) to authenticated;

create function public.add_waitlist_entry(
  p_practice_id uuid, p_service_id uuid, p_first_name text, p_last_name text default '', p_email text default '',
  p_phone text default '', p_window_start timestamptz default null, p_window_end timestamptz default null,
  p_min_notice_minutes integer default 60, p_staff_id uuid default null
)
returns uuid language sql set search_path to '' as $$
  select private.add_waitlist_entry_internal(p_practice_id, p_service_id, p_first_name, p_last_name, p_email, p_phone, p_window_start, p_window_end, p_min_notice_minutes, p_staff_id);
$$;
revoke all on function public.add_waitlist_entry(uuid, uuid, text, text, text, text, timestamptz, timestamptz, integer, uuid) from public, anon;
grant execute on function public.add_waitlist_entry(uuid, uuid, text, text, text, text, timestamptz, timestamptz, integer, uuid) to authenticated, service_role;

-- ---------- Workspace creation also creates the first staff member ----------
create or replace function private.create_practice_workspace_internal(p_name text, p_service_name text, p_price_cents integer)
returns uuid language plpgsql security definer set search_path to '' as $$
declare
  v_user_id uuid := auth.uid();
  v_practice_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if nullif(btrim(p_name), '') is null then raise exception 'Practice name is required'; end if;
  if nullif(btrim(p_service_name), '') is null then raise exception 'Service name is required'; end if;
  if p_price_cents is null or p_price_cents < 0 then raise exception 'Price must be zero or greater'; end if;

  insert into public.practices (owner_id, name) values (v_user_id, btrim(p_name)) returning id into v_practice_id;
  insert into public.staff (practice_id, name) values (v_practice_id, 'Owner');
  -- services_assign_staff trigger links the service to the owner.
  insert into public.services (practice_id, name, duration_minutes, price_cents)
  values (v_practice_id, btrim(p_service_name), 60, p_price_cents);
  return v_practice_id;
end; $$;

-- ---------- Public (token) functions used by the client-facing pages ----------
drop function if exists public.get_reschedule_availability(uuid, date);
create function public.get_reschedule_availability(p_token uuid, p_date date, p_staff_id uuid default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  appt public.appointments%rowtype;
  v_practice public.practices%rowtype;
  slots jsonb;
begin
  select * into appt from public.appointments where public_token = p_token;
  if not found then raise exception 'Appointment link is invalid'; end if;
  if appt.status in ('cancelled', 'completed', 'no_show') then raise exception 'Appointment can no longer be rescheduled'; end if;
  select * into v_practice from public.practices where id = appt.practice_id;

  select coalesce(jsonb_agg(jsonb_build_object('start_at', s.start_at, 'end_at', s.end_at) order by s.start_at), '[]'::jsonb)
  into slots
  from private.practice_day_slots(appt.practice_id, appt.service_id, p_date, appt.id, p_staff_id) s
  where s.available;

  return jsonb_build_object(
    'ok', true,
    'service_id', appt.service_id,
    'current_start_at', appt.start_at,
    'current_staff_id', appt.staff_id,
    'timezone', v_practice.timezone,
    'business_name', v_practice.name,
    'closed', not (extract(isodow from p_date)::smallint = any(v_practice.working_days)),
    'day_start', (p_date + v_practice.open_time) at time zone v_practice.timezone,
    'day_end', (p_date + v_practice.close_time) at time zone v_practice.timezone,
    'staff', private.service_staff_json(appt.practice_id, appt.service_id),
    'slots', slots
  );
end; $$;
revoke all on function public.get_reschedule_availability(uuid, date, uuid) from public, anon, authenticated;
grant execute on function public.get_reschedule_availability(uuid, date, uuid) to service_role;

drop function if exists public.handle_appointment_reschedule(uuid, timestamptz);
create function public.handle_appointment_reschedule(p_token uuid, p_start_at timestamptz, p_staff_id uuid default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  appt public.appointments%rowtype;
  v_duration integer;
  v_end_at timestamptz;
  v_new_id uuid;
  v_staff uuid;
begin
  if p_start_at is null or p_start_at <= now() then raise exception 'Please choose a future time'; end if;

  select * into appt from public.appointments where public_token = p_token for update;
  if not found then raise exception 'Appointment link is invalid'; end if;
  if appt.status in ('cancelled', 'completed', 'no_show') then raise exception 'Appointment can no longer be rescheduled'; end if;

  select duration_minutes into v_duration from public.services where id = appt.service_id;
  v_end_at := p_start_at + make_interval(mins => v_duration);

  perform pg_advisory_xact_lock(hashtextextended(appt.practice_id::text, 0));

  -- A chosen staff member is strict; "any" prefers the original staff member.
  v_staff := private.pick_free_staff(appt.practice_id, appt.service_id, p_start_at, v_end_at,
               coalesce(p_staff_id, appt.staff_id), p_staff_id is not null, appt.id);
  if v_staff is null then
    return jsonb_build_object('ok', false, 'reason', 'slot_unavailable');
  end if;

  insert into public.appointments(practice_id, service_id, client_id, staff_id, start_at, end_at, status, source)
  values (appt.practice_id, appt.service_id, appt.client_id, v_staff, p_start_at, v_end_at, 'confirmed', appt.source)
  returning id into v_new_id;

  -- Cancelling the original slot triggers the recovery engine for it.
  update public.appointments set status = 'cancelled' where id = appt.id;

  return jsonb_build_object('ok', true, 'action', 'rescheduled', 'appointment_id', v_new_id);
end; $$;
revoke all on function public.handle_appointment_reschedule(uuid, timestamptz, uuid) from public, anon, authenticated;
grant execute on function public.handle_appointment_reschedule(uuid, timestamptz, uuid) to service_role;

drop function if exists public.join_waitlist_from_appointment(uuid, timestamptz, timestamptz);
create function public.join_waitlist_from_appointment(p_token uuid, p_window_start timestamptz, p_window_end timestamptz, p_staff_id uuid default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  appt public.appointments%rowtype;
  entry_id uuid;
begin
  select * into appt from public.appointments where public_token = p_token;
  if not found then raise exception 'Appointment link is invalid'; end if;
  if p_window_start is null or p_window_end is null or p_window_end <= p_window_start then raise exception 'Waitlist window is invalid'; end if;
  if p_staff_id is not null and not exists (select 1 from public.staff where id = p_staff_id and practice_id = appt.practice_id) then
    raise exception 'Staff member not found';
  end if;

  insert into public.waitlist_entries(practice_id, client_id, service_id, staff_id, window_start, window_end, min_notice_minutes, priority, status)
  values (appt.practice_id, appt.client_id, appt.service_id, p_staff_id, p_window_start, p_window_end, 60, 100, 'active')
  returning id into entry_id;
  return jsonb_build_object('ok', true, 'waitlist_entry_id', entry_id);
end; $$;
revoke all on function public.join_waitlist_from_appointment(uuid, timestamptz, timestamptz, uuid) from public, anon, authenticated;
grant execute on function public.join_waitlist_from_appointment(uuid, timestamptz, timestamptz, uuid) to service_role;

-- ---------- Recovery engine respects staff ----------
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

create or replace function public.handle_recovery_offer(p_token uuid, p_action text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  offer public.recovery_offers%rowtype;
  appt public.appointments%rowtype;
  entry public.waitlist_entries%rowtype;
  new_appointment_id uuid;
  service_price integer;
  v_staff uuid;
begin
  select * into offer from public.recovery_offers where public_token = p_token for update;
  if not found then raise exception 'Recovery offer is invalid'; end if;
  if offer.status <> 'offered' then
    return jsonb_build_object('ok', false, 'reason', 'offer_not_active', 'status', offer.status);
  end if;

  if offer.expires_at <= now() then
    update public.recovery_offers set status = 'expired', responded_at = now() where id = offer.id;
    update public.waitlist_entries set status = 'passed' where id = offer.waitlist_entry_id;
    perform public.create_next_recovery_offer(offer.appointment_id);
    return jsonb_build_object('ok', false, 'reason', 'offer_expired');
  end if;

  if p_action = 'decline' then
    update public.recovery_offers set status = 'declined', responded_at = now() where id = offer.id;
    update public.waitlist_entries set status = 'passed' where id = offer.waitlist_entry_id;
    perform public.create_next_recovery_offer(offer.appointment_id);
    return jsonb_build_object('ok', true, 'action', 'decline');
  elsif p_action <> 'accept' then
    raise exception 'Unsupported action';
  end if;

  select * into appt from public.appointments where id = offer.appointment_id for update;
  if appt.status <> 'cancelled' then return jsonb_build_object('ok', false, 'reason', 'slot_unavailable'); end if;
  select * into entry from public.waitlist_entries where id = offer.waitlist_entry_id;

  perform pg_advisory_xact_lock(hashtextextended(appt.practice_id::text, 0));

  -- Prefer the staff member whose slot was freed; honour a strict waitlist preference.
  v_staff := private.pick_free_staff(appt.practice_id, appt.service_id, appt.start_at, appt.end_at,
               coalesce(entry.staff_id, appt.staff_id), entry.staff_id is not null);
  if v_staff is null then
    update public.recovery_offers set status = 'expired', responded_at = now() where id = offer.id;
    update public.waitlist_entries set status = 'active' where id = offer.waitlist_entry_id;
    return jsonb_build_object('ok', false, 'reason', 'slot_unavailable');
  end if;

  insert into public.appointments(practice_id, service_id, client_id, staff_id, start_at, end_at, status, source, recovered_from_id)
  values (appt.practice_id, appt.service_id, offer.client_id, v_staff, appt.start_at, appt.end_at, 'confirmed', 'waitlist_recovery', appt.id)
  returning id into new_appointment_id;

  update public.recovery_offers set status = 'accepted', responded_at = now() where id = offer.id;
  update public.waitlist_entries set status = 'filled' where id = offer.waitlist_entry_id;

  select price_cents into service_price from public.services where id = appt.service_id;
  insert into public.revenue_events(practice_id, appointment_id, event_type, amount_cents, metadata)
  values (appt.practice_id, appt.id, 'recovered', coalesce(service_price, 0), jsonb_build_object('replacement_appointment_id', new_appointment_id))
  on conflict (appointment_id, event_type)
  do update set amount_cents = excluded.amount_cents, metadata = excluded.metadata, created_at = now();

  return jsonb_build_object('ok', true, 'action', 'accept', 'appointment_id', new_appointment_id);
end; $$;

-- Lock down internal helpers.
revoke all on function private.qualified_staff(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function private.staff_is_free(uuid, uuid, timestamptz, timestamptz, uuid) from public, anon, authenticated;
revoke all on function private.pick_free_staff(uuid, uuid, timestamptz, timestamptz, uuid, boolean, uuid) from public, anon, authenticated;
revoke all on function private.practice_day_slots(uuid, uuid, date, uuid, uuid) from public, anon, authenticated;
revoke all on function private.service_staff_json(uuid, uuid) from public, anon, authenticated;
revoke all on function private.staff_services_same_practice() from public, anon, authenticated;
revoke all on function private.assign_new_service_to_staff() from public, anon, authenticated;
