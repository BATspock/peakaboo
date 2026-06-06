-- Seed the "Downtown Seattle" subject row.
--
-- Bug fix: migration 0013 swapped the default pin set to include
-- 'downtown-seattle' (and handle_new_user inserts that pin for new
-- signups), but NO migration ever inserted the downtown-seattle SUBJECT
-- itself. The client (useSubjectPins) resolves pins against loaded
-- subjects and silently drops any pin whose subject is missing — so the
-- Downtown Seattle pill never rendered. This adds the missing row.
--
-- kind must satisfy subjects_kind_check (see 0010); 'city_skyline' fits.
-- Idempotent: on conflict (id) do nothing.

insert into public.subjects (id, name, kind, latitude, longitude, description)
values (
  'downtown-seattle',
  'Downtown Seattle',
  'city_skyline',
  47.6050,
  -122.3344,
  'The Seattle skyline — Space Needle, downtown towers, and the Elliott Bay waterfront.'
)
on conflict (id) do nothing;

notify pgrst, 'reload schema';
