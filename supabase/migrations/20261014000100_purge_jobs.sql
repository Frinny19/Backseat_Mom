-- Nightly housekeeping (plan section 8): entries in "Recently deleted" for more
-- than 30 days are purged, and expired unused invites are removed.

create extension if not exists pg_cron;

create or replace function public.purge_deleted_entries()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.entries where deleted_at < now() - interval '30 days';
  delete from public.invites where used_at is null and expires_at < now() - interval '1 day';
$$;

revoke all on function public.purge_deleted_entries() from public, anon, authenticated;

select cron.schedule('purge-deleted-entries', '17 3 * * *', 'select public.purge_deleted_entries()');
