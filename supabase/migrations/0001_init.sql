-- PeakAboo schema
-- Run in Supabase: SQL Editor → New query → paste this whole file → Run.

create extension if not exists postgis;

-- =========================================================================
-- subjects: the thing being viewed (Mt Rainier, Mt Adams, later: Space Needle...)
-- =========================================================================
create table if not exists public.subjects (
  id          text primary key,
  name        text not null,
  kind        text not null check (kind in ('mountain', 'landmark', 'other')),
  latitude    double precision not null,
  longitude   double precision not null,
  geom        geography(Point, 4326)
              generated always as (st_setsrid(st_makepoint(longitude, latitude), 4326)::geography) stored,
  created_at  timestamptz not null default now()
);

create index if not exists subjects_geom_idx on public.subjects using gist (geom);

-- =========================================================================
-- viewpoints: places from which you can see a subject
-- =========================================================================
create table if not exists public.viewpoints (
  id           uuid primary key default gen_random_uuid(),
  subject_id   text not null references public.subjects(id) on delete cascade,
  name         text not null,
  description  text,
  latitude     double precision not null,
  longitude    double precision not null,
  geom         geography(Point, 4326)
               generated always as (st_setsrid(st_makepoint(longitude, latitude), 4326)::geography) stored,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists viewpoints_subject_idx on public.viewpoints (subject_id);
create index if not exists viewpoints_geom_idx    on public.viewpoints using gist (geom);

-- =========================================================================
-- sightings: a single observation at a viewpoint on a given day
-- one entry per user per viewpoint per day (enforced below)
-- =========================================================================
create type public.sighting_condition as enum ('clear', 'cloudy', 'snowy', 'hazy', 'rainy');

create table if not exists public.sightings (
  id            uuid primary key default gen_random_uuid(),
  viewpoint_id  uuid not null references public.viewpoints(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  observed_at   timestamptz not null default now(),
  observed_on   date generated always as ((observed_at at time zone 'America/Los_Angeles')::date) stored,
  visible       boolean not null,
  visibility    smallint check (visibility between 0 and 10),
  conditions    public.sighting_condition,
  notes         text,
  created_at    timestamptz not null default now()
);

create unique index if not exists sightings_one_per_day
  on public.sightings (user_id, viewpoint_id, observed_on);

create index if not exists sightings_viewpoint_idx on public.sightings (viewpoint_id, observed_on desc);
create index if not exists sightings_user_idx      on public.sightings (user_id, observed_on desc);

-- =========================================================================
-- sighting_images: many images per sighting (no count cap; 5MB enforced by storage policy)
-- =========================================================================
create table if not exists public.sighting_images (
  id           uuid primary key default gen_random_uuid(),
  sighting_id  uuid not null references public.sightings(id) on delete cascade,
  storage_path text not null,
  width        int,
  height       int,
  created_at   timestamptz not null default now()
);

create index if not exists sighting_images_sighting_idx on public.sighting_images (sighting_id);

-- =========================================================================
-- viewpoint_ratings: rate the viewpoint itself (one per user per viewpoint)
-- =========================================================================
create table if not exists public.viewpoint_ratings (
  viewpoint_id uuid not null references public.viewpoints(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  stars        smallint not null check (stars between 1 and 5),
  review       text,
  updated_at   timestamptz not null default now(),
  primary key (viewpoint_id, user_id)
);

-- =========================================================================
-- Row Level Security
-- =========================================================================
alter table public.subjects          enable row level security;
alter table public.viewpoints        enable row level security;
alter table public.sightings         enable row level security;
alter table public.sighting_images   enable row level security;
alter table public.viewpoint_ratings enable row level security;

-- Public reads (everything is public-by-default per product spec).
create policy "subjects: public read"          on public.subjects          for select using (true);
create policy "viewpoints: public read"        on public.viewpoints        for select using (true);
create policy "sightings: public read"         on public.sightings         for select using (true);
create policy "sighting_images: public read"   on public.sighting_images   for select using (true);
create policy "viewpoint_ratings: public read" on public.viewpoint_ratings for select using (true);

-- Authenticated users can add viewpoints; only the creator can edit/delete.
create policy "viewpoints: insert by authed"
  on public.viewpoints for insert
  with check (auth.uid() = created_by);

create policy "viewpoints: update own"
  on public.viewpoints for update
  using (auth.uid() = created_by);

create policy "viewpoints: delete own"
  on public.viewpoints for delete
  using (auth.uid() = created_by);

-- Sightings: only the user can write their own.
create policy "sightings: insert own"
  on public.sightings for insert
  with check (auth.uid() = user_id);

create policy "sightings: update own"
  on public.sightings for update
  using (auth.uid() = user_id);

create policy "sightings: delete own"
  on public.sightings for delete
  using (auth.uid() = user_id);

-- Images attached to sightings: write only if you own the parent sighting.
create policy "sighting_images: insert via own sighting"
  on public.sighting_images for insert
  with check (
    exists (
      select 1 from public.sightings s
      where s.id = sighting_id and s.user_id = auth.uid()
    )
  );

create policy "sighting_images: delete via own sighting"
  on public.sighting_images for delete
  using (
    exists (
      select 1 from public.sightings s
      where s.id = sighting_id and s.user_id = auth.uid()
    )
  );

-- Viewpoint ratings: one per user, write own only.
create policy "viewpoint_ratings: upsert own"
  on public.viewpoint_ratings for insert
  with check (auth.uid() = user_id);

create policy "viewpoint_ratings: update own"
  on public.viewpoint_ratings for update
  using (auth.uid() = user_id);

create policy "viewpoint_ratings: delete own"
  on public.viewpoint_ratings for delete
  using (auth.uid() = user_id);

-- =========================================================================
-- Seed data (idempotent)
-- =========================================================================
insert into public.subjects (id, name, kind, latitude, longitude) values
  ('mt-rainier', 'Mt Rainier', 'mountain', 46.8523, -121.7603),
  ('mt-adams',   'Mt Adams',   'mountain', 46.2024, -121.4909),
  ('mt-baker',   'Mt Baker',   'mountain', 48.7768, -121.8145)
on conflict (id) do nothing;

-- Use deterministic uuids (uuid_generate_v5 namespaced on subject_id+name)
-- so re-running the migration doesn't duplicate seed viewpoints.
create extension if not exists "uuid-ossp";

with seed (subject_id, name, latitude, longitude, description) as (
  values
    ('mt-rainier', 'Kerry Park',                  47.6295, -122.3600, 'Iconic Seattle skyline with Rainier on a clear day.'),
    ('mt-rainier', 'Gas Works Park',              47.6456, -122.3344, 'South-facing view across Lake Union toward Rainier.'),
    ('mt-rainier', 'Dr. Jose Rizal Park',         47.5908, -122.3192, 'Beacon Hill viewpoint with Rainier behind downtown.'),
    ('mt-rainier', 'Marymoor Park',               47.6628, -122.1180, 'Redmond — clear south-east view of Rainier.'),
    ('mt-rainier', 'Bellevue Downtown Park',      47.6122, -122.2017, null),
    ('mt-rainier', 'Point Defiance Park',         47.3076, -122.5158, 'Tacoma — sweeping waterfront view.'),
    ('mt-rainier', 'Gene Coulon Memorial Park',   47.5074, -122.2000, 'Renton — Lake Washington with Rainier to the south.'),
    ('mt-adams',   'Trout Lake Meadows',          46.0107, -121.5306, 'Classic foreground meadow view of Mt Adams.'),
    ('mt-adams',   'Bird Creek Meadows',          46.1497, -121.4647, 'South-side wildflower meadow on Adams.'),
    ('mt-baker',   'Artist Point',                48.8463, -121.6928, 'End of Mt Baker Highway — point-blank Baker + Shuksan.'),
    ('mt-baker',   'Picture Lake',                48.8650, -121.6783, 'Iconic reflection shot of Mt Shuksan with Baker nearby.'),
    ('mt-baker',   'Boulevard Park',              48.7341, -122.5072, 'Bellingham waterfront — Baker rises east over the bay.')
)
insert into public.viewpoints (id, subject_id, name, latitude, longitude, description)
select
  uuid_generate_v5('00000000-0000-0000-0000-000000000000'::uuid, subject_id || '|' || name),
  subject_id, name, latitude, longitude, description
from seed
on conflict (id) do nothing;

-- =========================================================================
-- Storage bucket for sighting photos
-- =========================================================================
insert into storage.buckets (id, name, public)
values ('sightings', 'sightings', true)
on conflict (id) do nothing;

-- Public read on the bucket; authenticated users upload to their own folder.
create policy "sightings storage: public read"
  on storage.objects for select
  using (bucket_id = 'sightings');

create policy "sightings storage: insert own folder"
  on storage.objects for insert
  with check (
    bucket_id = 'sightings'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "sightings storage: delete own"
  on storage.objects for delete
  using (
    bucket_id = 'sightings'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
