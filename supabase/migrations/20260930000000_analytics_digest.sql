-- Aggregate counts for the Telegram analytics digest. Only the service role may call it.
create or replace function public.slotrecover_digest_stats(p_since timestamptz, p_today timestamptz)
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select jsonb_build_object(
    'signups_window',     (select count(*) from auth.users where created_at >= p_since),
    'signups_today',      (select count(*) from auth.users where created_at >= p_today),
    'users_total',        (select count(*) from auth.users),
    'practices_today',    (select count(*) from public.practices where created_at >= p_today),
    'trials_today',       (select count(*) from public.billing_accounts where trial_started_at >= p_today),
    'active_accounts',    (select count(*) from public.billing_accounts where status in ('authenticated','active')),
    'appointments_today', (select count(*) from public.appointments where created_at >= p_today),
    'recovered_today',    (select count(*) from public.appointments where recovered_from_id is not null and created_at >= p_today)
  );
$$;
revoke all on function public.slotrecover_digest_stats(timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.slotrecover_digest_stats(timestamptz, timestamptz) to service_role;

-- Every 2 hours on the even hour, India time (UTC :30 on even hours = IST :00).
select cron.schedule(
  'slotrecover-analytics-digest',
  '30 */2 * * *',
  $$
  select net.http_post(
    url := 'https://uziailbuahrzfijqbkbc.supabase.co/functions/v1/slotrecover-analytics-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-slotrecover-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'slotrecover_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
  $$
);
