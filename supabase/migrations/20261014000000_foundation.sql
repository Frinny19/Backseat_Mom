-- Backseat Mom foundation schema (plan section 8).
-- Families own babies; people join families; every caregiver can view, add,
-- edit and delete any entry. Deletes are soft so they sync and can be restored.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  created_by uuid not null references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create type public.family_role as enum ('owner', 'caregiver', 'viewer');

create table public.family_members (
  family_id uuid not null references public.families (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.family_role not null default 'caregiver',
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (family_id, user_id)
);
create index family_members_user_idx on public.family_members (user_id);

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  code text not null unique check (code ~ '^[A-Z0-9]{6}$'),
  role public.family_role not null default 'caregiver' check (role <> 'owner'),
  created_by uuid not null references auth.users (id) default auth.uid(),
  expires_at timestamptz not null default now() + interval '7 days',
  used_by uuid references auth.users (id),
  used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.babies (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  birth_date date,
  sex text check (sex in ('female', 'male', 'other')),
  photo_path text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index babies_family_idx on public.babies (family_id);

create table public.medications (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  baby_id uuid not null references public.babies (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  default_dose numeric check (default_dose > 0),
  unit text,
  route text,
  min_interval_hours numeric check (min_interval_hours > 0),
  max_doses_per_day int check (max_doses_per_day > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index medications_baby_idx on public.medications (baby_id);

create table public.entries (
  -- Generated on the phone so offline inserts never collide.
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  baby_id uuid not null references public.babies (id) on delete cascade,
  category text not null check (category in ('feed', 'pump', 'sleep', 'diaper', 'medication', 'milestone')),
  kind text not null,
  started_at timestamptz not null,
  -- Null on a timed entry means it is running right now.
  ended_at timestamptz check (ended_at is null or ended_at >= started_at),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  note text check (note is null or char_length(note) <= 2000),
  medication_id uuid references public.medications (id) on delete set null,
  created_by uuid references auth.users (id) default auth.uid(),
  updated_by uuid references auth.users (id) default auth.uid(),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint entries_kind_matches_category check (
    (category = 'feed' and kind in ('breast', 'bottle', 'solids')) or
    (category = 'pump' and kind in ('single', 'double')) or
    (category = 'sleep' and kind in ('nap', 'night')) or
    (category = 'diaper' and kind in ('wet', 'dirty', 'mixed', 'dry')) or
    (category = 'medication' and kind = 'dose') or
    (category = 'milestone' and kind in ('developmental', 'first', 'growth'))
  )
);
-- Ribbon: latest live entry per category.
create index entries_ribbon_idx on public.entries (baby_id, category, started_at desc) where deleted_at is null;
-- Timeline.
create index entries_timeline_idx on public.entries (baby_id, started_at desc);
-- Active timers.
create index entries_active_idx on public.entries (baby_id, category) where ended_at is null and deleted_at is null;

create table public.entry_history (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null,
  family_id uuid not null references public.families (id) on delete cascade,
  changed_by uuid references auth.users (id),
  changed_at timestamptz not null default clock_timestamp(),
  op text not null check (op in ('insert', 'update', 'delete', 'restore')),
  before jsonb,
  after jsonb
);
create index entry_history_entry_idx on public.entry_history (entry_id, changed_at desc);

create table public.ribbon_prefs (
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  baby_id uuid not null references public.babies (id) on delete cascade,
  hidden text[] not null default '{}',
  "order" text[] not null default '{}',
  due_intervals jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, baby_id)
);

create table public.push_tokens (
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  token text not null,
  platform text not null check (platform in ('ios', 'android')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, token)
);

-- updated_at triggers
do $$
declare t text;
begin
  foreach t in array array['profiles', 'families', 'family_members', 'invites', 'babies', 'medications',
                           'entries', 'ribbon_prefs', 'push_tokens'] loop
    execute format('create trigger %I before update on public.%I for each row execute function public.touch_updated_at()',
                   t || '_touch_updated_at', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Membership checks
-- ---------------------------------------------------------------------------

-- True when the current user belongs to the family with at least `min_role`
-- (owner > caregiver > viewer). Security definer so policies on
-- family_members can use it without recursing.
create or replace function public.is_member(fid uuid, min_role public.family_role default 'viewer')
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.family_members m
    where m.family_id = fid
      and m.user_id = (select auth.uid())
      and case min_role
            when 'viewer' then true
            when 'caregiver' then m.role in ('owner', 'caregiver')
            when 'owner' then m.role = 'owner'
          end
  );
$$;

-- An entry, medication or ribbon pref must point at a baby in the same family.
create or replace function public.baby_in_family(bid uuid, fid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.babies b where b.id = bid and b.family_id = fid);
$$;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.invites enable row level security;
alter table public.babies enable row level security;
alter table public.medications enable row level security;
alter table public.entries enable row level security;
alter table public.entry_history enable row level security;
alter table public.ribbon_prefs enable row level security;
alter table public.push_tokens enable row level security;

-- profiles: yourself, plus people who share a family with you.
create policy profiles_select on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1 from public.family_members mine
      join public.family_members theirs on theirs.family_id = mine.family_id
      where mine.user_id = (select auth.uid()) and theirs.user_id = profiles.id
    )
  );
create policy profiles_insert on public.profiles for insert to authenticated
  with check (id = (select auth.uid()));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- families: members read; creation goes through create_family(); owners rename and delete.
create policy families_select on public.families for select to authenticated
  using (public.is_member(id));
create policy families_update on public.families for update to authenticated
  using (public.is_member(id, 'owner')) with check (public.is_member(id, 'owner'));
create policy families_delete on public.families for delete to authenticated
  using (public.is_member(id, 'owner'));

-- family_members: members read the list; owners manage it; anyone can leave.
create policy family_members_select on public.family_members for select to authenticated
  using (public.is_member(family_id));
create policy family_members_update on public.family_members for update to authenticated
  using (public.is_member(family_id, 'owner')) with check (public.is_member(family_id, 'owner'));
create policy family_members_delete on public.family_members for delete to authenticated
  using (public.is_member(family_id, 'owner') or user_id = (select auth.uid()));

-- invites: owners create and manage; accepting goes through accept_invite().
create policy invites_select on public.invites for select to authenticated
  using (public.is_member(family_id, 'owner'));
create policy invites_insert on public.invites for insert to authenticated
  with check (public.is_member(family_id, 'owner') and created_by = (select auth.uid()));
create policy invites_delete on public.invites for delete to authenticated
  using (public.is_member(family_id, 'owner'));

-- babies, medications, entries: any member reads; owners and caregivers write.
create policy babies_select on public.babies for select to authenticated
  using (public.is_member(family_id));
create policy babies_insert on public.babies for insert to authenticated
  with check (public.is_member(family_id, 'caregiver'));
create policy babies_update on public.babies for update to authenticated
  using (public.is_member(family_id, 'caregiver')) with check (public.is_member(family_id, 'caregiver'));
create policy babies_delete on public.babies for delete to authenticated
  using (public.is_member(family_id, 'caregiver'));

create policy medications_select on public.medications for select to authenticated
  using (public.is_member(family_id));
create policy medications_insert on public.medications for insert to authenticated
  with check (public.is_member(family_id, 'caregiver') and public.baby_in_family(baby_id, family_id));
create policy medications_update on public.medications for update to authenticated
  using (public.is_member(family_id, 'caregiver'))
  with check (public.is_member(family_id, 'caregiver') and public.baby_in_family(baby_id, family_id));
create policy medications_delete on public.medications for delete to authenticated
  using (public.is_member(family_id, 'caregiver'));

create policy entries_select on public.entries for select to authenticated
  using (public.is_member(family_id));
create policy entries_insert on public.entries for insert to authenticated
  with check (public.is_member(family_id, 'caregiver') and public.baby_in_family(baby_id, family_id));
create policy entries_update on public.entries for update to authenticated
  using (public.is_member(family_id, 'caregiver'))
  with check (public.is_member(family_id, 'caregiver') and public.baby_in_family(baby_id, family_id));
-- Hard deletes are reserved for the 30-day purge job; the app soft-deletes.
create policy entries_delete on public.entries for delete to authenticated
  using (false);

-- entry_history: written only by the trigger below; members read.
create policy entry_history_select on public.entry_history for select to authenticated
  using (public.is_member(family_id));

-- ribbon_prefs and push_tokens: only the person themself.
create policy ribbon_prefs_all on public.ribbon_prefs for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.babies b where b.id = baby_id and public.is_member(b.family_id))
  );
create policy push_tokens_all on public.push_tokens for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Entry bookkeeping: who changed it, and the edit history
-- ---------------------------------------------------------------------------

create or replace function public.entries_stamp()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(auth.uid(), new.created_by);
  else
    -- These never change after insert.
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    new.family_id := old.family_id;
  end if;
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end;
$$;

create trigger entries_stamp before insert or update on public.entries
  for each row execute function public.entries_stamp();

create or replace function public.entries_record_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  op text;
begin
  if tg_op = 'INSERT' then
    op := 'insert';
  elsif tg_op = 'DELETE' then
    return old;
  elsif old.deleted_at is null and new.deleted_at is not null then
    op := 'delete';
  elsif old.deleted_at is not null and new.deleted_at is null then
    op := 'restore';
  else
    op := 'update';
  end if;
  insert into public.entry_history (entry_id, family_id, changed_by, op, before, after)
  values (
    new.id, new.family_id, auth.uid(), op,
    case when tg_op = 'UPDATE' then to_jsonb(old) end,
    to_jsonb(new)
  );
  return new;
end;
$$;

create trigger entries_record_history after insert or update on public.entries
  for each row execute function public.entries_record_history();

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

-- Creates a family with the caller as owner, in one step.
create or replace function public.create_family(family_name text)
returns public.families
language plpgsql
security definer
set search_path = ''
as $$
declare
  f public.families;
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  insert into public.families (name, created_by) values (trim(family_name), uid) returning * into f;
  insert into public.family_members (family_id, user_id, role) values (f.id, uid, 'owner');
  return f;
end;
$$;

-- Creates a six-character invite code for a family. Owners only.
create or replace function public.create_invite(fid uuid, invite_role public.family_role default 'caregiver')
returns public.invites
language plpgsql
security definer
set search_path = ''
as $$
declare
  i public.invites;
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  new_code text;
begin
  if not public.is_member(fid, 'owner') then
    raise exception 'Only the family owner can invite people' using errcode = '42501';
  end if;
  loop
    select string_agg(substr(alphabet, 1 + (get_byte(b, n) % length(alphabet)), 1), '')
      into new_code
      from (select extensions.gen_random_bytes(6) as b) r, generate_series(0, 5) n;
    exit when not exists (select 1 from public.invites where code = new_code);
  end loop;
  insert into public.invites (family_id, code, role, created_by)
  values (fid, new_code, invite_role, auth.uid())
  returning * into i;
  return i;
end;
$$;

-- Joins the family behind an unused, unexpired invite code.
create or replace function public.accept_invite(invite_code text)
returns public.family_members
language plpgsql
security definer
set search_path = ''
as $$
declare
  i public.invites;
  m public.family_members;
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  select * into i from public.invites
   where code = upper(trim(invite_code)) and used_at is null and expires_at > now()
   for update;
  if not found then
    raise exception 'That code is invalid or has expired' using errcode = 'P0002';
  end if;
  insert into public.family_members (family_id, user_id, role)
  values (i.family_id, uid, i.role)
  on conflict (family_id, user_id) do nothing;
  update public.invites set used_by = uid, used_at = now() where id = i.id;
  select * into m from public.family_members where family_id = i.family_id and user_id = uid;
  return m;
end;
$$;

revoke all on function public.create_family(text) from public, anon;
revoke all on function public.create_invite(uuid, public.family_role) from public, anon;
revoke all on function public.accept_invite(text) from public, anon;
grant execute on function public.create_family(text) to authenticated;
grant execute on function public.create_invite(uuid, public.family_role) to authenticated;
grant execute on function public.accept_invite(text) to authenticated;

-- A profile row for every new account.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email, ''), '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Photos: bucket entry-photos, paths "<family_id>/<entry_id>/<file>"
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public) values ('entry-photos', 'entry-photos', false)
on conflict (id) do nothing;

create policy entry_photos_select on storage.objects for select to authenticated
  using (bucket_id = 'entry-photos' and public.is_member(((storage.foldername(name))[1])::uuid));
create policy entry_photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'entry-photos' and public.is_member(((storage.foldername(name))[1])::uuid, 'caregiver'));
create policy entry_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'entry-photos' and public.is_member(((storage.foldername(name))[1])::uuid, 'caregiver'));
