-- Follow the project's pattern: public SECURITY INVOKER wrapper -> private SECURITY DEFINER internal.
alter function public.get_practice_availability(uuid, uuid, date) set schema private;
alter function private.get_practice_availability(uuid, uuid, date) rename to get_practice_availability_internal;
revoke all on function private.get_practice_availability_internal(uuid, uuid, date) from public, anon;
grant execute on function private.get_practice_availability_internal(uuid, uuid, date) to authenticated;

create or replace function public.get_practice_availability(p_practice_id uuid, p_service_id uuid, p_date date)
returns jsonb
language sql
stable
set search_path to ''
as $$
  select private.get_practice_availability_internal(p_practice_id, p_service_id, p_date);
$$;

revoke all on function public.get_practice_availability(uuid, uuid, date) from public, anon;
grant execute on function public.get_practice_availability(uuid, uuid, date) to authenticated;
