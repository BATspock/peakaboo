-- Make Supabase's PostgREST able to embed profile data in sighting queries.
-- The sightings.user_id already references auth.users; we add a parallel FK
-- to profiles so PostgREST can infer the relationship for select() embeds.
--
-- profiles.id has the same uuid as auth.users.id (one-to-one), so this is
-- a redundant constraint at the data level but exactly what PostgREST needs
-- in its schema cache.

alter table public.sightings
  drop constraint if exists sightings_user_id_profile_fkey;

alter table public.sightings
  add constraint sightings_user_id_profile_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

-- Same treatment for viewpoint_ratings and viewpoints.created_by so future
-- feeds can embed the rater / creator profile without an extra round trip.
alter table public.viewpoint_ratings
  drop constraint if exists viewpoint_ratings_user_id_profile_fkey;

alter table public.viewpoint_ratings
  add constraint viewpoint_ratings_user_id_profile_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.viewpoints
  drop constraint if exists viewpoints_created_by_profile_fkey;

alter table public.viewpoints
  add constraint viewpoints_created_by_profile_fkey
  foreign key (created_by) references public.profiles(id) on delete set null;

-- Tell PostgREST to refresh its schema cache.
notify pgrst, 'reload schema';
