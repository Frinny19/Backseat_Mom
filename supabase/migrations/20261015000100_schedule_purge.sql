-- Runs the purge nightly. On a hosted project, enable pg_cron first under
-- Database > Extensions; creating it from a migration can time out there.

create extension if not exists pg_cron;

select cron.schedule('purge-deleted-entries', '17 3 * * *', 'select public.purge_deleted_entries()');
