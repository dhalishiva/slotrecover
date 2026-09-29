-- Web push subscriptions for business users, and a service-role-only
-- accessor for app secrets kept in Supabase Vault (used for VAPID keys).

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  practice_id uuid not null references public.practices(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_practice_idx on public.push_subscriptions(practice_id);

alter table public.push_subscriptions enable row level security;
drop policy if exists push_subscriptions_own on public.push_subscriptions;
create policy push_subscriptions_own on public.push_subscriptions for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and private.user_can_access_practice(practice_id));

-- Returns the named secret, creating it with p_initial_value if it doesn't exist yet.
-- Only the service role (Edge Functions) can call it.
create or replace function public.app_secret_get_or_init(p_name text, p_initial_value text default null)
returns text language plpgsql security definer set search_path to '' as $$
declare v text;
begin
  perform pg_advisory_xact_lock(hashtextextended('app_secret:' || p_name, 0));
  select decrypted_secret into v from vault.decrypted_secrets where name = p_name limit 1;
  if v is null and p_initial_value is not null then
    perform vault.create_secret(p_initial_value, p_name, 'SlotRecover app secret');
    v := p_initial_value;
  end if;
  return v;
end; $$;
revoke all on function public.app_secret_get_or_init(text, text) from public, anon, authenticated;
grant execute on function public.app_secret_get_or_init(text, text) to service_role;
