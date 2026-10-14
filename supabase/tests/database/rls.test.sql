-- Row level security tests: one family can never see or change another's data,
-- and every caregiver can do everything with entries. Run with `supabase test db`.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(31);

-- People: Alice owns family A, Bob joins A by invite, Carol owns family B.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'alice@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@example.com'),
  ('00000000-0000-0000-0000-00000000000c', 'carol@example.com');

create temp table ids (k text primary key, v uuid) on commit drop;
create temp table codes (k text primary key, code text) on commit drop;
grant all on ids, codes to authenticated;

create function pg_temp.act_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  select set_config('role', 'authenticated', true);
$$;
create function pg_temp.reset_role() returns void language sql as $$
  select set_config('role', 'postgres', true);
  select set_config('request.jwt.claims', '', true);
$$;

select is((select count(*)::int from public.profiles where id::text like '00000000-0000-0000-0000-00000000000_'), 3, 'a profile is created for every new account');

-- Alice creates family A, a baby, and an invite.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
insert into ids select 'familyA', (public.create_family('The Koehlers')).id;
select is(
  (select role::text from public.family_members where user_id = '00000000-0000-0000-0000-00000000000a'),
  'owner', 'create_family makes the caller the owner');
insert into public.babies (family_id, name, birth_date)
  select v, 'Mila', '2026-06-01' from ids where k = 'familyA';
insert into ids select 'babyA', id from public.babies where name = 'Mila';
insert into codes select 'good', (public.create_invite((select v from ids where k = 'familyA'))).code;
select matches((select code from codes where k = 'good'), '^[A-Z0-9]{6}$', 'invite codes are six characters');

-- Carol creates family B with her own baby.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
insert into ids select 'familyB', (public.create_family('Family B')).id;
insert into public.babies (family_id, name) select v, 'Theo' from ids where k = 'familyB';
insert into ids select 'babyB', id from public.babies where name = 'Theo';

select is((select count(*)::int from public.babies), 1, 'Carol sees only her own baby');
select is((select count(*)::int from public.families), 1, 'Carol sees only her own family');
select throws_ok(
  format('select public.create_invite(%L)', (select v from ids where k = 'familyA')),
  '42501', null, 'non-owners cannot create invites');
select throws_ok(
  format($q$insert into public.entries (family_id, baby_id, category, kind, started_at)
            values (%L, %L, 'diaper', 'wet', now())$q$,
         (select v from ids where k = 'familyA'), (select v from ids where k = 'babyA')),
  '42501', null, 'Carol cannot log entries for another family');
select throws_ok(
  format($q$insert into public.entries (family_id, baby_id, category, kind, started_at)
            values (%L, %L, 'diaper', 'wet', now())$q$,
         (select v from ids where k = 'familyB'), (select v from ids where k = 'babyA')),
  '42501', null, 'an entry cannot point at a baby from another family');

-- Bob joins family A with the code.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select is((select count(*)::int from public.babies), 0, 'Bob sees nothing before joining');
select lives_ok(format('select public.accept_invite(%L)', lower((select code from codes where k = 'good'))),
  'accepting an invite works, case-insensitively');
select is((select count(*)::int from public.babies), 1, 'Bob sees family A''s baby after joining');
select is(
  (select role::text from public.family_members where user_id = '00000000-0000-0000-0000-00000000000b'),
  'caregiver', 'invited people join as caregivers');

-- Bob logs, edits and soft-deletes entries.
insert into public.entries (id, family_id, baby_id, category, kind, started_at, details)
  select '10000000-0000-0000-0000-000000000001', f.v, b.v, 'feed', 'bottle', now() - interval '1 hour',
         '{"kind":"bottle","amount":120,"unit":"ml"}'
  from ids f, ids b where f.k = 'familyA' and b.k = 'babyA';
select is(
  (select created_by from public.entries where id = '10000000-0000-0000-0000-000000000001'),
  '00000000-0000-0000-0000-00000000000b'::uuid, 'created_by is the person who logged it');
select throws_ok(
  format($q$insert into public.entries (family_id, baby_id, category, kind, started_at)
            values (%L, %L, 'diaper', 'sleepy', now())$q$,
         (select v from ids where k = 'familyA'), (select v from ids where k = 'babyA')),
  '23514', null, 'kind must match the category');
select throws_ok(
  format($q$insert into public.entries (family_id, baby_id, category, kind, started_at, ended_at)
            values (%L, %L, 'sleep', 'nap', now(), now() - interval '1 hour')$q$,
         (select v from ids where k = 'familyA'), (select v from ids where k = 'babyA')),
  '23514', null, 'an entry cannot end before it starts');

-- Alice edits Bob's entry: allowed, and recorded.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
update public.entries set details = '{"kind":"bottle","amount":150,"unit":"ml"}'
  where id = '10000000-0000-0000-0000-000000000001';
select is(
  (select updated_by from public.entries where id = '10000000-0000-0000-0000-000000000001'),
  '00000000-0000-0000-0000-00000000000a'::uuid, 'anyone in the family can edit any entry; updated_by follows');
select is(
  (select created_by from public.entries where id = '10000000-0000-0000-0000-000000000001'),
  '00000000-0000-0000-0000-00000000000b'::uuid, 'created_by never changes');
update public.entries set family_id = (select v from ids where k = 'familyB')
  where id = '10000000-0000-0000-0000-000000000001';
select is(
  (select family_id from public.entries where id = '10000000-0000-0000-0000-000000000001'),
  (select v from ids where k = 'familyA'), 'an entry cannot be moved to another family');

-- Soft delete, hard delete, restore.
update public.entries set deleted_at = now() where id = '10000000-0000-0000-0000-000000000001';
delete from public.entries where id = '10000000-0000-0000-0000-000000000001';
select is((select count(*)::int from public.entries), 1, 'hard deletes are blocked; the entry stays in Recently deleted');
update public.entries set deleted_at = null where id = '10000000-0000-0000-0000-000000000001';
select results_eq(
  $q$select op from public.entry_history where entry_id = '10000000-0000-0000-0000-000000000001' order by changed_at, op$q$,
  $q$values ('insert'), ('update'), ('update'), ('delete'), ('restore')$q$,
  'every change is in the edit history');
select is(
  (select (before -> 'details' ->> 'amount')::int from public.entry_history
    where entry_id = '10000000-0000-0000-0000-000000000001' and op = 'update' and changed_by = '00000000-0000-0000-0000-00000000000a'
    order by changed_at limit 1),
  120, 'history keeps the value before the edit');
select throws_ok(
  $q$insert into public.entry_history (entry_id, family_id, op) values (gen_random_uuid(), gen_random_uuid(), 'insert')$q$,
  '42501', null, 'history cannot be written directly');

-- Carol still cannot see any of it.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
select is((select count(*)::int from public.entries), 0, 'Carol cannot see family A''s entries');
select is((select count(*)::int from public.entry_history), 0, 'Carol cannot see family A''s history');
update public.entries set note = 'hacked' where id = '10000000-0000-0000-0000-000000000001';
select pg_temp.reset_role();
select is((select note from public.entries where id = '10000000-0000-0000-0000-000000000001'), null,
  'Carol cannot edit family A''s entries');

-- Member management is for owners.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
update public.family_members set role = 'owner' where user_id = '00000000-0000-0000-0000-00000000000b';
select is(
  (select role::text from public.family_members where user_id = '00000000-0000-0000-0000-00000000000b'),
  'caregiver', 'caregivers cannot promote themselves');

-- Invite codes are single use and expire.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
select throws_ok(format('select public.accept_invite(%L)', (select code from codes where k = 'good')),
  'P0002', null, 'a used invite cannot be used again');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
insert into codes select 'old', (public.create_invite((select v from ids where k = 'familyA'))).code;
select pg_temp.reset_role();
update public.invites set expires_at = now() - interval '1 minute' where code = (select code from codes where k = 'old');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
select throws_ok(format('select public.accept_invite(%L)', (select code from codes where k = 'old')),
  'P0002', null, 'an expired invite cannot be used');

-- Ribbon prefs are personal.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
insert into public.ribbon_prefs (baby_id, hidden) select v, '{pump}' from ids where k = 'babyA';
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select is((select count(*)::int from public.ribbon_prefs), 0, 'Bob cannot see Alice''s ribbon prefs');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
select throws_ok(
  format($q$insert into public.ribbon_prefs (baby_id) values (%L)$q$, (select v from ids where k = 'babyA')),
  '42501', null, 'ribbon prefs can only be set for your own family''s babies');

-- Anonymous visitors see nothing.
select pg_temp.reset_role();
set local role anon;
select is((select count(*)::int from public.entries), 0, 'anonymous visitors see no entries');

select * from finish();
rollback;
