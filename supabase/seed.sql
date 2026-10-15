-- Local development seed: two parents sharing one baby and a morning of entries.
-- Sign in locally as demo@backseatmom.app or partner@backseatmom.app (password: backseat-demo).

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
   'demo@backseatmom.app', extensions.crypt('backseat-demo', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"display_name":"Frin"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
   'partner@backseatmom.app', extensions.crypt('backseat-demo', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"display_name":"Sam"}', now(), now());

insert into public.families (id, name, created_by)
values ('f0000000-0000-4000-8000-000000000001', 'Demo family', 'a0000000-0000-4000-8000-000000000001');

insert into public.family_members (family_id, user_id, role) values
  ('f0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'owner'),
  ('f0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', 'caregiver');

insert into public.babies (id, family_id, name, birth_date, sex)
values ('b0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'Mila',
        current_date - interval '4 months 2 weeks', 'female');

insert into public.medications (id, family_id, baby_id, name, default_dose, unit, route, min_interval_hours, max_doses_per_day)
values ('d0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001',
        'b0000000-0000-4000-8000-000000000001', 'Tylenol', 2.5, 'ml', 'oral', 4, 5);

insert into public.entries (family_id, baby_id, category, kind, started_at, ended_at, details, note, medication_id, created_by, updated_by)
select 'f0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', e.category, e.kind,
       now() - e.started_ago, now() - e.ended_ago, e.details::jsonb, e.note, e.medication_id, e.who, e.who
from (values
  ('medication', 'dose', interval '3 hours', interval '3 hours', '{"kind":"dose","dose":2.5,"unit":"ml","route":"oral","reason":"Teething"}', null,
   'd0000000-0000-4000-8000-000000000001'::uuid, 'a0000000-0000-4000-8000-000000000002'::uuid),
  ('diaper', 'wet', interval '2 hours 50 minutes', interval '2 hours 50 minutes', '{"kind":"wet"}', null, null, 'a0000000-0000-4000-8000-000000000001'),
  ('feed', 'breast', interval '2 hours 33 minutes', interval '2 hours 15 minutes',
   '{"kind":"breast","segments":[],"lastSide":"left"}', null, null, 'a0000000-0000-4000-8000-000000000001'),
  ('pump', 'double', interval '4 hours', interval '3 hours 40 minutes', '{"kind":"double","left":70,"right":70,"total":140,"unit":"ml","use":"stored","storage":"fridge"}',
   null, null, 'a0000000-0000-4000-8000-000000000001'),
  ('diaper', 'wet', interval '35 minutes', interval '35 minutes', '{"kind":"wet"}', null, null, 'a0000000-0000-4000-8000-000000000002'),
  ('sleep', 'nap', interval '42 minutes', null, '{"kind":"nap","place":"crib"}', 'In the crib', null, 'a0000000-0000-4000-8000-000000000002'),
  ('milestone', 'first', interval '3 days', interval '3 days', '{"kind":"first","title":"First smile"}', null, null, 'a0000000-0000-4000-8000-000000000001')
) as e(category, kind, started_ago, ended_ago, details, note, medication_id, who);
