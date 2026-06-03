# Spec: Places search + subject categories + dedup + reportable subjects/viewpoints

**Status:** ready to build
**Priority:** P1 — strategic differentiation
**Estimated effort:** ~7.5 hours total

## Goal

Today PeakAboo is "an app for Mt Rainier, Adams, and Baker." It
overlaps too closely with Is The Mountain Out's positioning. The
strategic move: turn PeakAboo into "a crowdsourced field guide for
visibility of any landmark, peak, waterfall, sunset spot, or
stargazing location."

Three features land together because they share UI surface and schema:

1. **Places search + add** — users search for and add subjects via Google Places API
2. **Categories** — subjects have a category (mountain_peak, waterfall, etc.)
3. **Dedup + reports** — friction prevents duplicate subjects and viewpoints; users can report objectionable ones

## Decisions locked in

| Decision | Choice |
|---|---|
| Who can add subjects? | Anyone signed in (no admin moderation queue) |
| Who can add viewpoints? | Already anyone signed in (unchanged) |
| Categories shipped in v1 | 7 — see list below |
| Per-category UI variations | None for v1 — same sighting form everywhere |
| Per-category map icons | None for v1 — single peak pin glyph for all subjects |
| Per-category zoom deltas | Yes, derived from category |
| Subject dedup | Block via Google `place_id` unique constraint, surface "view existing" |
| Viewpoint dedup | Soft warning ("looks like this might already exist") within ~100m + similar name; user can override |
| Reports model | Polymorphic — single `reports` table with `target_type` + `target_id` |
| Subject + viewpoint report UI | Yes — flag icon in search rows + viewpoint sheet header |
| Moderation | Still manual via Supabase dashboard (per docs/moderation.md) |
| Places API costs | Acceptable — $200/mo Google credit covers ~10K lookups |

## Categories (initial set — 7)

```
mountain_peak
waterfall
lake_view
ocean_view
stargazing
city_skyline
other
```

Easier to grow than prune. Add new categories when users ask.

## Camera zoom deltas per category

```ts
const SUBJECT_DELTA: Record<SubjectCategory, number> = {
  mountain_peak: 1.4,   // wide — see all viewpoints in a 30km radius
  waterfall:     0.05,  // neighborhood scale
  lake_view:     0.08,
  ocean_view:    0.15,
  stargazing:    0.5,   // wider — stargazers travel further
  city_skyline:  0.05,
  other:         0.1,
};
```

First-pass values; tune after seeing real subjects on the map.

## User experience

### Discovering subjects

- Pills row replaced by a search bar at top of home
- Empty state shows the 3 seeded peaks + "Search any place" hint
- Typing "Snoqualmie Falls" debounces and shows two sections in dropdown:
  - **In PeakAboo** — fuzzy-name and proximity matches against existing subjects, with a small flag (report) icon per row for non-creator viewers
  - **Add new** — Google Places autocomplete results
- Tapping an existing subject sets it as active; map flies to it at the category-derived zoom
- Tapping a Google result opens the AddSubjectSheet

### Adding subjects

- Required: name (pre-filled from Places result), category dropdown (chip-row matching existing patterns)
- Optional: description
- Submit calls Place Details API for canonical lat/lng + place_id, inserts subject row
- If unique `place_id` constraint hits → AddSubjectSheet shows "Looks like Snoqualmie Falls is already on PeakAboo" with a "View it" CTA that closes this sheet and activates the existing subject

### Adding viewpoints (dedup warning)

- Existing AddViewpointSheet flow unchanged (current location / pin drop / coordinates)
- Before insert, calls `find_nearby_viewpoint` RPC
- If matches found within ~100m: panel renders "Looks like this might already exist" with up to 5 nearby viewpoints (name + distance) and CTAs: "Open <name>" / "Add anyway"
- Doesn't block submission — soft signal only

### Reporting subjects + viewpoints

- Generalized ReportSheet supports `targetType` of sighting | viewpoint | subject
- Subject reports: small flag icon on each "In PeakAboo" search result, hidden if user is the creator
- Viewpoint reports: small flag icon in ViewpointSheet's action row, hidden if user is the creator
- Sighting reports: existing flow unchanged

## Acceptance criteria

1. Empty search bar + no query → 3 seeded peaks shown in empty-state
2. Type "Snoq" → see Snoqualmie Falls (existing + Google Places suggestions)
3. Tap a Google Place → AddSubjectSheet opens with name pre-filled and category required
4. Submit with category=waterfall → subject created with `created_by = auth.uid()`, becomes active subject, map flies there at delta=0.05
5. Try to add "Snoqualmie Falls" twice → second attempt shows "View existing" CTA
6. Existing peak flows still work — Mt Rainier viewpoints render after the kind migration
7. AddViewpoint near an existing viewpoint shows the dedup panel; user can pick "Add anyway"
8. Flag icon next to a subject in search → opens ReportSheet with targetType=subject
9. Flag icon in ViewpointSheet header → opens ReportSheet with targetType=viewpoint
10. Existing sighting reports still work end-to-end (no regression on the polymorphic table)
11. moderation.md SQL queries work for the new target types
12. Native + web parity (visual only since native build isn't shipped yet)

## Data model

### Migration 0011 — subjects user-added + categories

```sql
-- Replace narrow kind enum with check constraint over 7 categories.
-- Using check constraint instead of Postgres enum so adding categories
-- later is a one-line migration instead of an ALTER TYPE.

alter table public.subjects
  drop constraint if exists subjects_kind_check;

alter table public.subjects
  add constraint subjects_kind_check check (kind in (
    'mountain_peak', 'waterfall', 'lake_view',
    'ocean_view', 'stargazing', 'city_skyline', 'other'
  ));

update public.subjects set kind = 'mountain_peak' where kind = 'mountain';
update public.subjects set kind = 'other'
  where kind not in ('mountain_peak','waterfall','lake_view',
                     'ocean_view','stargazing','city_skyline','other');

alter table public.subjects
  add column if not exists description text,
  add column if not exists created_by uuid references public.profiles(id),
  add column if not exists place_id text,
  add column if not exists created_at timestamptz default now();

create unique index if not exists subjects_place_id_uniq
  on public.subjects (place_id) where place_id is not null;

create policy "subjects: insert by authed"
  on public.subjects for insert
  with check (auth.uid() = created_by);

create policy "subjects: update own"
  on public.subjects for update
  using (auth.uid() = created_by);

notify pgrst, 'reload schema';
```

### Migration 0012 — polymorphic reports + viewpoint dedup helper

```sql
-- Generalize reports to handle viewpoints and subjects, not just sightings.
create type public.report_target_type as enum (
  'sighting', 'viewpoint', 'subject'
);

alter table public.reports
  add column if not exists target_type public.report_target_type,
  add column if not exists target_id text;

-- Backfill from existing sighting_id rows.
update public.reports
set target_type = 'sighting',
    target_id = sighting_id::text
where target_type is null;

alter table public.reports
  alter column target_type set not null,
  alter column target_id set not null;

-- Drop old sighting-specific FK + unique constraint.
alter table public.reports drop constraint if exists reports_sighting_id_fkey;
alter table public.reports
  drop constraint if exists reports_sighting_id_reporter_user_id_key;

-- New unique: one report per (reporter, target) regardless of target type.
create unique index if not exists reports_reporter_target_uniq
  on public.reports (reporter_user_id, target_type, target_id);

-- Don't drop the sighting_id column yet — keep it as a deprecated alias
-- for one release cycle so admin queries that still reference it work.
-- Marked TODO in moderation.md to drop in a later migration.

-- Spatial dedup helper for viewpoints. Returns up to 5 nearby viewpoints
-- in the same subject within p_meters of the candidate coords.
create or replace function public.find_nearby_viewpoint(
  p_subject_id text,
  p_lat double precision,
  p_lng double precision,
  p_meters double precision default 100
) returns table (
  id uuid,
  subject_id text,
  name text,
  description text,
  latitude double precision,
  longitude double precision,
  distance_m double precision
)
language sql stable
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

notify pgrst, 'reload schema';
```

## Google Places setup (user-action)

- Enable **Places API (New)** for the peakaboo project in Google Cloud Console
- Add Places API to the existing Maps key's allowed APIs (currently restricted to Maps SDK + JS API)
- Verify HTTP referrer restriction still applies (`peakaboo-zeta.vercel.app/*` and `localhost:8081/*`)
- Confirm $5/month budget alert is still active

## Implementation tasks

### Phase 1 — Schema (40 min)

1. Migration 0011 (subjects user-added + categories)
2. Migration 0012 (polymorphic reports + find_nearby_viewpoint)
3. User runs both migrations in Supabase SQL editor

### Phase 2 — Types (15 min)

4. Add `SubjectCategory` union type matching the schema check constraint
5. Update `Subject` type — `kind: SubjectCategory`, add `description`, `createdBy`, `placeId`, `createdAt`
6. Update `SEED_SUBJECTS` to use `mountain_peak`
7. Update `usePlaces` to map new columns from snake_case

### Phase 3 — Search (~2.5 hours)

8. `useSubjectSearch` hook — debounced (300ms), returns `{ existing, suggestions, loading, error }`. Existing: Supabase fuzzy name search. Suggestions: Google Places Autocomplete with PNW location bias. Cache by query.
9. `SubjectSearch` component — search bar replacing pill row, dropdown with two sections, flag icon per existing subject for non-creators
10. Wire into App.tsx; remove pill row + filteredSubjects logic; ensure dropdown floats above map without overlapping FAB

### Phase 4 — Add subject (~1.5 hours)

11. `AddSubjectSheet` component — name + category chip row + description; submit calls Places Details for canonical coords; insert with `place_id` + `created_by`
12. Dedup UX: catch unique-constraint failure → show "View existing" CTA that closes sheet + activates the existing subject

### Phase 5 — Camera + integration (30 min)

13. `subjectCameraDelta(category)` helper in src/lib
14. App.tsx `cameraTarget` derives delta from active subject's category
15. Refresh `usePlaces` after AddSubjectSheet success; bump cameraNonce so animation fires

### Phase 6 — Viewpoint dedup (45 min)

16. AddViewpointSheet calls `find_nearby_viewpoint` RPC before insert when location + name are set
17. "Looks like this might already exist" panel renders matches with name + distance
18. CTAs: "Open <name>" (closes this sheet + opens that viewpoint), "Add anyway" (proceeds with original insert)

### Phase 7 — Generalized reports (45 min)

19. Move `ReportSheet` from `src/sightings/` to `src/components/`. Props: `targetType` + `targetId`. Inserts with `target_type` + `target_id`.
20. Update existing call site in SightingsFeed (`targetType="sighting"`)
21. Add flag icon to ViewpointSheet header action row → opens ReportSheet with `targetType="viewpoint"`
22. Add flag icon to SubjectSearch existing-result rows → opens ReportSheet with `targetType="subject"`
23. Update `docs/moderation.md` — SQL queries for the new target types; new section on viewpoint + subject deletes (with the cascade caveats); note the deprecated `sighting_id` column

### Phase 8 — Test (30 min)

24. Existing peak flows (Mt Rainier viewpoints render)
25. Search "Snoq" → autocomplete result → AddSubjectSheet
26. Submit Snoqualmie Falls (waterfall) → subject created, map flies, delta=0.05
27. Add second Snoqualmie attempt → "View existing" CTA
28. Add viewpoint near existing → dedup panel shows
29. Report a subject + report a viewpoint → both rows land in `reports` with correct target_type
30. Existing sighting report flow still works
31. Native + web parity (visual)

### Phase 9 — Commit + push (15 min)

32. Single bundled commit
33. Push, ask user to run both SQL migrations + verify Places API enabled before testing on Vercel

## Open questions (none blocking)

- **Future: per-category sighting fields?** stargazing wants moon phase; ocean view wants tide; mountain wants visibility-distance. Defer until categories are exercised.
- **Future: per-category map icons?** Different glyph for waterfall vs. peak. Defer.
- **Future: search autocomplete ranking by sighting count?** "In PeakAboo" results currently ranked by name similarity. Could weight by activity. Defer.
- **`sighting_id` column drop**: keep it for one release cycle as a deprecated alias, then drop in a follow-up migration. Tracked as TODO in moderation.md.
