-- Swap the default pin set from {Rainier, Baker, Snoqualmie} to
-- {Rainier, Snoqualmie, Downtown Seattle}.
--
-- Two parts: update the handle_new_user() trigger so future signups
-- get the new defaults, then rewrite existing users' pin lists by
-- replacing mt-baker with downtown-seattle wherever it appears.

-- ── 1. Update trigger so new signups get the new defaults ────────────

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

  insert into public.subject_pins (user_id, subject_id, position)
  values
    (new.id, 'mt-rainier',       0),
    (new.id, 'snoqualmie-falls', 1),
    (new.id, 'downtown-seattle', 2)
  on conflict (user_id, subject_id) do nothing;

  return new;
end;
$$;

-- ── 2. Migrate existing pin lists ───────────────────────────────────
-- For users who currently have mt-baker pinned: replace it with
-- downtown-seattle, preserving the position. If they also already have
-- downtown-seattle (unusual but possible), just remove the baker pin.
--
-- We do this in one pass with a couple of small steps so it's atomic.

begin;

-- 2a. If a user has BOTH mt-baker and downtown-seattle, just drop baker.
delete from public.subject_pins
where subject_id = 'mt-baker'
  and user_id in (
    select user_id from public.subject_pins
    where subject_id = 'downtown-seattle'
  );

-- 2b. For everyone else with mt-baker, swap the subject_id to
-- downtown-seattle, keeping the same position.
update public.subject_pins
set subject_id = 'downtown-seattle'
where subject_id = 'mt-baker';

-- 2c. Defensive: anyone who somehow has snoqualmie-falls but not
-- mt-rainier or downtown-seattle should still end up with the trio
-- if there's space. This keeps the swap idempotent — running twice
-- is a no-op. We DON'T touch users who already explicitly removed
-- Snoqualmie or any other default; "doesn't have it" can mean
-- "removed it on purpose." Skip this fixup unless they have zero pins.

insert into public.subject_pins (user_id, subject_id, position)
select u.id, 'mt-rainier', 0
from auth.users u
where not exists (select 1 from public.subject_pins p where p.user_id = u.id);

insert into public.subject_pins (user_id, subject_id, position)
select u.id, 'snoqualmie-falls', 1
from auth.users u
where exists (select 1 from public.subject_pins p
              where p.user_id = u.id and p.subject_id = 'mt-rainier'
              and (select count(*) from public.subject_pins where user_id = u.id) = 1)
  and not exists (select 1 from public.subject_pins p
                  where p.user_id = u.id and p.subject_id = 'snoqualmie-falls');

insert into public.subject_pins (user_id, subject_id, position)
select u.id, 'downtown-seattle', 2
from auth.users u
where exists (select 1 from public.subject_pins p
              where p.user_id = u.id and p.subject_id = 'snoqualmie-falls'
              and (select count(*) from public.subject_pins where user_id = u.id) = 2)
  and not exists (select 1 from public.subject_pins p
                  where p.user_id = u.id and p.subject_id = 'downtown-seattle');

commit;

notify pgrst, 'reload schema';
