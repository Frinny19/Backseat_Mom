-- Lets phones hear about changes as they happen (Supabase Realtime), so a nap
-- started on one phone shows as running on the others within a second or two.
-- Realtime applies the same row level security as reads.

alter publication supabase_realtime add table public.entries, public.medications, public.babies, public.family_members;
