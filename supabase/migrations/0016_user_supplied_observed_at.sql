-- Let users set their own observed_at when logging a sighting (e.g. uploading
-- a photo taken yesterday), instead of it always being "now".
--
-- No column changes are needed: observed_at is already timestamptz set by the
-- client, and observed_on is a generated column derived from it, so backdated
-- rows land on the correct day and the existing
-- `order by observed_at desc` feed queries sort them correctly.
--
-- This migration adds the two things that DO change once the timestamp is
-- user-controlled:
--   1. A guard against future / absurd timestamps (RLS alone allows any value).
--   2. Indexes on observed_at, which is now the real sort key.

-- =========================================================================
-- 1. Reject future and absurd observed_at values
-- =========================================================================
-- Implemented as a trigger rather than a CHECK constraint: the bound depends
-- on now(), and Postgres discourages non-immutable functions in CHECK
-- expressions because they are not re-validated on dump/restore.
--
-- 5 minutes of slack absorbs client/server clock skew.

create or replace function public.sightings_validate_observed_at()
returns trigger
language plpgsql
as $$
begin
  if new.observed_at > now() + interval '5 minutes' then
    raise exception
      'observed_at cannot be in the future (got %, now is %)',
      new.observed_at, now()
      using errcode = 'check_violation';
  end if;

  if new.observed_at < timestamptz '1900-01-01' then
    raise exception
      'observed_at is implausibly old (got %)', new.observed_at
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists sightings_validate_observed_at on public.sightings;

create trigger sightings_validate_observed_at
  before insert or update of observed_at on public.sightings
  for each row
  execute function public.sightings_validate_observed_at();

-- =========================================================================
-- 2. Index the actual sort key
-- =========================================================================
-- SightingsFeed and HistorySheet both filter by viewpoint_id / user_id and
-- order by observed_at desc. The 0001 indexes cover observed_on desc, which
-- only approximated insertion order and no longer tracks observed_at once
-- users backdate entries.

create index if not exists sightings_viewpoint_observed_at_idx
  on public.sightings (viewpoint_id, observed_at desc);

create index if not exists sightings_user_observed_at_idx
  on public.sightings (user_id, observed_at desc);
