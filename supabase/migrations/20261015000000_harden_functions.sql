-- From the Supabase security advisor: pin search_path on the remaining
-- functions, and stop exposing trigger and helper functions to anonymous
-- callers through /rest/v1/rpc. Policies run as the signed-in user, so
-- is_member and baby_in_family stay executable by `authenticated`.

alter function public.touch_updated_at() set search_path = '';
alter function public.entries_stamp() set search_path = '';

revoke all on function public.entries_record_history() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;

revoke all on function public.is_member(uuid, public.family_role) from public, anon;
revoke all on function public.baby_in_family(uuid, uuid) from public, anon;
grant execute on function public.is_member(uuid, public.family_role) to authenticated;
grant execute on function public.baby_in_family(uuid, uuid) to authenticated;
