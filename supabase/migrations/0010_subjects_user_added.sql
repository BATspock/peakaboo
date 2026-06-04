-- User-added subjects + 7-category taxonomy.
--
-- Today, subjects is a small admin-curated list (Mt Rainier, Mt Adams,
-- Mt Baker) with kind = 'mountain'. We're opening it up so any signed-in
-- user can add a subject (a waterfall, a lake, a stargazing spot,
-- whatever). Categories let us tune zoom levels and, later, per-category
-- UI variants.
--
-- Strategic context: this is the differentiator from "Is The Mountain
-- Out" — they're Rainier-only; we're "any view, any subject."

-- Replace narrow kind enum with check constraint over 7 categories.
-- Using check + text instead of a Postgres enum so adding categories
-- later is a one-line migration instead of an ALTER TYPE.

alter table public.subjects
  drop constraint if exists subjects_kind_check;

-- Migrate existing data first, before applying the new check constraint.
update public.subjects set kind = 'mountain_peak' where kind = 'mountain';
update public.subjects set kind = 'other'
  where kind not in (
    'mountain_peak', 'waterfall', 'lake_view',
    'ocean_view', 'stargazing', 'city_skyline', 'other'
  );

alter table public.subjects
  add constraint subjects_kind_check check (kind in (
    'mountain_peak',
    'waterfall',
    'lake_view',
    'ocean_view',
    'stargazing',
    'city_skyline',
    'other'
  ));

-- New columns to support user creation, dedup, and metadata.
alter table public.subjects
  add column if not exists description text,
  add column if not exists created_by uuid references public.profiles(id),
  add column if not exists place_id text,
  add column if not exists created_at timestamptz default now();

-- Unique partial index on place_id — null place_ids are unrestricted
-- (the seeded peaks don't have one), but any user-added subject backed
-- by a Google Place must be unique by canonical place_id.
create unique index if not exists subjects_place_id_uniq
  on public.subjects (place_id) where place_id is not null;

-- Allow signed-in users to insert subjects, only as themselves.
drop policy if exists "subjects: insert by authed" on public.subjects;
create policy "subjects: insert by authed"
  on public.subjects for insert
  with check (auth.uid() = created_by);

-- Creators can update their own subjects (rename, fix description, etc.).
drop policy if exists "subjects: update own" on public.subjects;
create policy "subjects: update own"
  on public.subjects for update
  using (auth.uid() = created_by);

-- public read policy already exists from 0001_init.sql; do not duplicate.

notify pgrst, 'reload schema';
