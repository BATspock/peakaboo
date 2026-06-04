-- Subject pins: per-user shortcut to up to 5 favorite subjects, shown
-- as quick-access pills under the search bar. Different from
-- viewpoint_favorites (those are individual viewpoints).
--
-- Defaults: Mt Rainier, Mt Baker, Snoqualmie Falls. Pre-filled by the
-- handle_new_user trigger on first signup. Once a user has any pin
-- record (even after unpinning all defaults), we never re-add — they
-- own the list.

-- ── 1. Seed Snoqualmie Falls so the third default exists ────────────
-- Verified place_id and coordinates from Google Places API
-- (ChIJwZGNG9F7kFQROK0NWmKwCu0, 47.5417209, -121.8377019).
insert into public.subjects (id, name, kind, latitude, longitude, place_id, description)
values (
  'snoqualmie-falls',
  'Snoqualmie Falls',
  'waterfall',
  47.5417209,
  -121.8377019,
  'ChIJwZGNG9F7kFQROK0NWmKwCu0',
  '270-foot waterfall east of Seattle — one of WA''s most-visited natural attractions.'
)
on conflict (id) do update
  set place_id = excluded.place_id,
      kind = excluded.kind,
      description = excluded.description;

-- ── 2. subject_pins table ───────────────────────────────────────────
create table if not exists public.subject_pins (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  subject_id text not null references public.subjects(id) on delete cascade,
  position   smallint not null default 0,
  created_at timestamptz not null default now(),
  primary key (user_id, subject_id)
);

create index if not exists subject_pins_user_idx
  on public.subject_pins (user_id, position);

alter table public.subject_pins enable row level security;

-- Reads: a user sees their own pins only. (Public-read isn't useful and
-- exposes "what subjects this user cares about" unnecessarily.)
create policy "subject_pins: read own"
  on public.subject_pins for select
  using (auth.uid() = user_id);

-- Inserts: a user can pin only as themselves AND only if they have
-- fewer than 5 existing pins. Enforced in policy so the cap can't be
-- bypassed by hammering the client.
create policy "subject_pins: insert own under cap"
  on public.subject_pins for insert
  with check (
    auth.uid() = user_id
    and (
      select count(*) from public.subject_pins
      where user_id = auth.uid()
    ) < 5
  );

create policy "subject_pins: update own"
  on public.subject_pins for update
  using (auth.uid() = user_id);

create policy "subject_pins: delete own"
  on public.subject_pins for delete
  using (auth.uid() = user_id);

-- ── 3. Pre-fill on first signup via the existing user trigger ──────
-- The trigger from 0002 inserts a profile row on auth.users insert.
-- Replace it to also insert the 3 default pins.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(new.email, '@', 1)
    ),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update set
    display_name = excluded.display_name,
    avatar_url = excluded.avatar_url;

  -- Pre-fill default subject pins. on conflict do nothing handles the
  -- case of a user re-trigger (shouldn't happen but defensive).
  insert into public.subject_pins (user_id, subject_id, position)
  values
    (new.id, 'mt-rainier', 0),
    (new.id, 'mt-baker', 1),
    (new.id, 'snoqualmie-falls', 2)
  on conflict (user_id, subject_id) do nothing;

  return new;
end;
$$;

-- Trigger itself was created in 0002; no re-create needed since we just
-- replaced the function body.

-- ── 4. Backfill existing users who don't have any pins yet ─────────
-- For users who signed up before this migration: give them the same 3
-- defaults so the feature shows up for everyone, not just new signups.
-- Skipped if they already have at least one pin (means they've used
-- the feature already, somehow — defensive).
insert into public.subject_pins (user_id, subject_id, position)
select u.id, 'mt-rainier', 0 from auth.users u
where not exists (select 1 from public.subject_pins p where p.user_id = u.id);

insert into public.subject_pins (user_id, subject_id, position)
select u.id, 'mt-baker', 1 from auth.users u
where exists (select 1 from public.subject_pins p where p.user_id = u.id and p.subject_id = 'mt-rainier')
  and not exists (select 1 from public.subject_pins p where p.user_id = u.id and p.subject_id = 'mt-baker');

insert into public.subject_pins (user_id, subject_id, position)
select u.id, 'snoqualmie-falls', 2 from auth.users u
where exists (select 1 from public.subject_pins p where p.user_id = u.id and p.subject_id = 'mt-rainier')
  and not exists (select 1 from public.subject_pins p where p.user_id = u.id and p.subject_id = 'snoqualmie-falls');

notify pgrst, 'reload schema';
