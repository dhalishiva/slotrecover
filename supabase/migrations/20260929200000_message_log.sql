-- Message log for things the database can't infer on its own (WhatsApp reminders
-- opened from the app), and a link from a rescheduled appointment to its replacement.

create table if not exists public.message_events (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete cascade,
  channel text not null check (channel in ('whatsapp', 'email', 'sms')),
  kind text not null check (kind in ('reminder', 'confirmation', 'offer', 'other')),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists message_events_practice_idx on public.message_events(practice_id, created_at desc);

alter table public.message_events enable row level security;
drop policy if exists message_events_all on public.message_events;
create policy message_events_all on public.message_events for all to authenticated
  using (private.user_can_access_practice(practice_id))
  with check (private.user_can_access_practice(practice_id));

alter table public.appointments add column if not exists rescheduled_to_id uuid references public.appointments(id) on delete set null;

create or replace function public.handle_appointment_reschedule(p_token uuid, p_start_at timestamptz, p_staff_id uuid default null)
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

  v_staff := private.pick_free_staff(appt.practice_id, appt.service_id, p_start_at, v_end_at,
               coalesce(p_staff_id, appt.staff_id), p_staff_id is not null, appt.id);
  if v_staff is null then
    return jsonb_build_object('ok', false, 'reason', 'slot_unavailable');
  end if;

  insert into public.appointments(practice_id, service_id, client_id, staff_id, start_at, end_at, status, source)
  values (appt.practice_id, appt.service_id, appt.client_id, v_staff, p_start_at, v_end_at, 'confirmed', appt.source)
  returning id into v_new_id;

  -- Cancelling the original slot triggers the recovery engine for it.
  update public.appointments set status = 'cancelled', rescheduled_to_id = v_new_id where id = appt.id;

  return jsonb_build_object('ok', true, 'action', 'rescheduled', 'appointment_id', v_new_id);
end; $$;
revoke all on function public.handle_appointment_reschedule(uuid, timestamptz, uuid) from public, anon, authenticated;
grant execute on function public.handle_appointment_reschedule(uuid, timestamptz, uuid) to service_role;
