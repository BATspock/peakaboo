-- Polymorphic reports + viewpoint dedup helper.
--
-- 1. Generalize public.reports so users can report subjects and viewpoints
--    too, not just sightings. We add target_type + target_id columns,
--    backfill from existing rows, and migrate the unique constraint.
--    The old sighting_id column stays for one release cycle as a
--    deprecated alias to keep moderation queries working — drop it in a
--    follow-up migration once we've verified nothing reads it.
--
-- 2. Add public.find_nearby_viewpoint(...) — a PL/pgSQL function the
--    AddViewpointSheet calls before insert to surface possible
--    duplicates. Doesn't block submission; just informs the UI so it
--    can show a "Looks like this might already exist" panel.

-- ── 1. Polymorphic reports ───────────────────────────────────────────

create type public.report_target_type as enum (
  'sighting',
  'viewpoint',
  'subject'
);

alter table public.reports
  add column if not exists target_type public.report_target_type,
  add column if not exists target_id text;

-- Backfill from existing sighting_id rows.
update public.reports
set target_type = 'sighting',
    target_id   = sighting_id::text
where target_type is null and sighting_id is not null;

alter table public.reports
  alter column target_type set not null,
  alter column target_id set not null;

create index if not exists reports_target_idx
  on public.reports (target_type, target_id);

-- New uniqueness: one report per (reporter, target) regardless of target
-- kind. A reporter who already flagged sighting X doesn't get to flag
-- it again under a different reason.
create unique index if not exists reports_reporter_target_uniq
  on public.reports (reporter_user_id, target_type, target_id);

-- The old (sighting_id, reporter_user_id) constraint is now redundant;
-- drop it. Postgres autonames the constraint as <table>_<col>_<col>_key.
alter table public.reports
  drop constraint if exists reports_sighting_id_reporter_user_id_key;

-- Keep the old sighting_id FK + column for now so docs/moderation.md's
-- existing queries against r.sighting_id still work. We'll drop it in a
-- later migration once moderation runbook is updated. Marked TODO in
-- moderation.md so we don't forget.

notify pgrst, 'reload schema';

-- ── 2. find_nearby_viewpoint(...) ────────────────────────────────────
-- Used by the AddViewpointSheet flow. Returns up to 5 viewpoints in
-- the same subject within p_meters of the candidate coords, ordered by
-- distance. Cheap thanks to the geom GIST index on viewpoints from
-- 0001_init.sql.

create or replace function public.find_nearby_viewpoint(
  p_subject_id text,
  p_lat        double precision,
  p_lng        double precision,
  p_meters     double precision default 100
) returns table (
  id          uuid,
  subject_id  text,
  name        text,
  description text,
  latitude    double precision,
  longitude   double precision,
  distance_m  double precision
)
language sql
stable
as $$
  select
    v.id,
    v.subject_id,
    v.name,
    v.description,
    v.latitude,
    v.longitude,
    st_distance(
      v.geom,
      st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography
    ) as distance_m
  from public.viewpoints v
  where v.subject_id = p_subject_id
    and st_dwithin(
      v.geom,
      st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
      p_meters
    )
  order by distance_m asc
  limit 5;
$$;

-- Anonymous and authenticated users can call this — it only returns
-- public viewpoint data they could already query.
grant execute on function public.find_nearby_viewpoint(
  text, double precision, double precision, double precision
) to anon, authenticated;
