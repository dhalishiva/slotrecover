-- Business hours per practice, timezone-aware slot availability,
-- and database-level protection against double booking.

alter table public.practices
  add column if not exists open_time time not null default '09:00',
  add column if not exists close_time time not null default '18:00',
  add column if not exists working_days smallint[] not null default '{1,2,3,4,5}',
  add column if not exists slot_interval_minutes integer not null default 30;

do $$ begin
  alter table public.practices
    add constraint practices_hours_valid check (close_time > open_time);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.practices
    add constraint practices_slot_interval_valid check (slot_interval_minutes in (15, 30, 60));
exception when duplicate_object then null; end $$;

-- All candidate slots for one practice/service/day in the practice's timezone.
create or replace function private.practice_day_slots(
  p_practice_id uuid,
  p_service_id uuid,
  p_date date,
  p_exclude_appointment_id uuid default null
)
returns table(start_at timestamptz, end_at timestamptz, available boolean)
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_practice public.practices%rowtype;
  v_duration integer;
  v_open timestamptz;
  v_close timestamptz;
begin
  select * into v_practice from public.practices where id = p_practice_id;
  if not found then return; end if;

  select duration_minutes into v_duration
  from public.services
  where id = p_service_id and practice_id = p_practice_id;
  if v_duration is null then return; end if;

  if not (extract(isodow from p_date)::smallint = any(v_practice.working_days)) then
    return;
  end if;

  v_open := (p_date + v_practice.open_time) at time zone v_practice.timezone;
  v_close := (p_date + v_practice.close_time) at time zone v_practice.timezone;

  return query
  select gs,
         gs + make_interval(mins => v_duration),
         not exists (
           select 1 from public.appointments a
           where a.practice_id = p_practice_id
             and a.status in ('booked', 'confirmed')
             and (p_exclude_appointment_id is null or a.id <> p_exclude_appointment_id)
             and gs < a.end_at
             and gs + make_interval(mins => v_duration) > a.start_at
         )
  from generate_series(
    v_open,
    v_close - make_interval(mins => v_duration),
    make_interval(mins => v_practice.slot_interval_minutes)
  ) gs
  where gs > now()
  order by gs;
end;
$$;

revoke all on function private.practice_day_slots(uuid, uuid, date, uuid) from public, anon, authenticated;

-- Staff-facing availability used by the New appointment form.
create or replace function public.get_practice_availability(
  p_practice_id uuid,
  p_service_id uuid,
  p_date date
)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_practice public.practices%rowtype;
  v_slots jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not private.user_can_access_practice(p_practice_id) then
    raise exception 'You do not have access to this practice';
  end if;

  select * into v_practice from public.practices where id = p_practice_id;

  select coalesce(jsonb_agg(jsonb_build_object(
           'start_at', s.start_at, 'end_at', s.end_at, 'available', s.available)
           order by s.start_at), '[]'::jsonb)
  into v_slots
  from private.practice_day_slots(p_practice_id, p_service_id, p_date) s;

  return jsonb_build_object(
    'ok', true,
    'timezone', v_practice.timezone,
    'closed', not (extract(isodow from p_date)::smallint = any(v_practice.working_days)),
    'day_start', (p_date + v_practice.open_time) at time zone v_practice.timezone,
    'day_end', (p_date + v_practice.close_time) at time zone v_practice.timezone,
    'slots', v_slots
  );
end;
$$;

revoke all on function public.get_practice_availability(uuid, uuid, date) from public, anon;
grant execute on function public.get_practice_availability(uuid, uuid, date) to authenticated;

-- Public reschedule page: same hours/timezone rules, free slots only.
create or replace function public.get_reschedule_availability(p_token uuid, p_date date)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  appt public.appointments%rowtype;
  slots jsonb;
begin
  select * into appt from public.appointments where public_token = p_token;
  if not found then raise exception 'Appointment link is invalid'; end if;
  if appt.status in ('cancelled', 'completed', 'no_show') then
    raise exception 'Appointment can no longer be rescheduled';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('start_at', s.start_at, 'end_at', s.end_at)
           order by s.start_at), '[]'::jsonb)
  into slots
  from private.practice_day_slots(appt.practice_id, appt.service_id, p_date, appt.id) s
  where s.available;

  return jsonb_build_object(
    'ok', true,
    'service_id', appt.service_id,
    'current_start_at', appt.start_at,
    'slots', slots
  );
end;
$$;

-- Create appointment with a per-practice lock and overlap check.
create or replace function private.create_appointment_internal(
  p_practice_id uuid, p_service_id uuid, p_first_name text, p_last_name text,
  p_email text, p_phone text, p_start_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_client_id uuid;
  v_appointment_id uuid;
  v_duration integer;
  v_end_at timestamptz;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if not exists (
    select 1 from public.practice_members
    where practice_id = p_practice_id and user_id = v_user_id
  ) then raise exception 'You do not have access to this practice'; end if;

  select duration_minutes into v_duration
  from public.services
  where id = p_service_id and practice_id = p_practice_id and active = true;

  if v_duration is null then raise exception 'Service not found'; end if;
  if nullif(btrim(p_first_name), '') is null then raise exception 'Client first name is required'; end if;
  if p_start_at is null then raise exception 'Start time is required'; end if;

  v_end_at := p_start_at + make_interval(mins => v_duration);

  -- Serialise bookings per practice so two requests cannot take the same slot.
  perform pg_advisory_xact_lock(hashtextextended(p_practice_id::text, 0));

  if exists (
    select 1 from public.appointments a
    where a.practice_id = p_practice_id
      and a.status in ('booked', 'confirmed')
      and p_start_at < a.end_at
      and v_end_at > a.start_at
  ) then
    raise exception using
      message = 'That time is already booked. Choose another time or add the client to the waitlist.',
      hint = 'slot_unavailable';
  end if;

  insert into public.clients(practice_id, first_name, last_name, email, phone)
  values (
    p_practice_id, btrim(p_first_name), nullif(btrim(p_last_name), ''),
    nullif(btrim(p_email), ''), nullif(btrim(p_phone), '')
  )
  returning id into v_client_id;

  insert into public.appointments(practice_id, service_id, client_id, start_at, end_at, status, source)
  values (p_practice_id, p_service_id, v_client_id, p_start_at, v_end_at, 'booked', 'manual')
  returning id into v_appointment_id;

  return v_appointment_id;
end;
$$;

-- Reschedule with the same per-practice lock.
create or replace function public.handle_appointment_reschedule(p_token uuid, p_start_at timestamptz)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  appt public.appointments%rowtype;
  v_duration integer;
  v_end_at timestamptz;
  v_new_id uuid;
begin
  if p_start_at is null or p_start_at <= now() then
    raise exception 'Please choose a future time';
  end if;

  select * into appt from public.appointments where public_token = p_token for update;
  if not found then raise exception 'Appointment link is invalid'; end if;
  if appt.status in ('cancelled', 'completed', 'no_show') then
    raise exception 'Appointment can no longer be rescheduled';
  end if;

  select duration_minutes into v_duration from public.services where id = appt.service_id;
  v_end_at := p_start_at + make_interval(mins => v_duration);

  perform pg_advisory_xact_lock(hashtextextended(appt.practice_id::text, 0));

  if exists (
    select 1 from public.appointments a
    where a.practice_id = appt.practice_id
      and a.id <> appt.id
      and a.status in ('booked', 'confirmed')
      and p_start_at < a.end_at
      and v_end_at > a.start_at
  ) then
    return jsonb_build_object('ok', false, 'reason', 'slot_unavailable');
  end if;

  insert into public.appointments(practice_id, service_id, client_id, start_at, end_at, status, source)
  values (appt.practice_id, appt.service_id, appt.client_id, p_start_at, v_end_at, 'confirmed', appt.source)
  returning id into v_new_id;

  -- Cancelling the original slot triggers the recovery engine for it.
  update public.appointments set status = 'cancelled' where id = appt.id;

  return jsonb_build_object('ok', true, 'action', 'rescheduled', 'appointment_id', v_new_id);
end;
$$;
