# Spec: Places search + subject categories

**Status:** ready to build (after specs 01 + 02 ship)
**Priority:** P2 — strategic differentiation
**Estimated effort:** ~5 hours total

## Goal

Today PeakAboo is "an app for Mt Rainier, Adams, and Baker." It
overlaps too closely with Is The Mountain Out's positioning. The
strategic move: turn PeakAboo into "a crowdsourced field guide for
visibility of any landmark, peak, waterfall, sunset spot, or
stargazing location."

Two features unlock this together:
1. Users search for and add subjects via Google Places API
2. Subjects are categorized so the data shape supports more than just mountains

The schema should support stargazing, waterfalls, lake views, and
ocean views even if the v1 UI doesn't fully differentiate them.

## Non-goals

- Per-category sighting form variants (different fields for stargazing
  vs. mountain) — defer until categories are exercised
- Per-category map icons — defer; current peak pin is fine universally
- Filter UI for browsing by category — defer
- Moderation workflow for user-added subjects — defer; rely on report flow + admin SQL

## User experience

### Discovering subjects

- Pills row replaced by a search bar at the top of the home screen
- Empty state shows the 3 seeded peaks + "Search any place" hint
- Typing "Snoqualmie Falls" debounces and shows two sections:
  - **In PeakAboo** — fuzzy-name and proximity matches against existing subjects
  - **Add new** — Google Places autocomplete results
- Tapping an existing subject sets it as active, map flies to it
- Tapping a Google result opens an "Add subject" sheet with category dropdown + confirm

### Adding subjects

- Required fields: name (pre-filled from Places result), category, lat/lng (pre-filled)
- Optional: description
- Submit creates the subject row, sets it as active, refreshes the map
- Dedup: before inserting, query for any existing subject with the same
  Google `place_id` or within 200m + name fuzzy match. Show "View
  existing" instead of letting them create a duplicate.

### Categories (initial set)

```
mountain_peak
waterfall
lake_view
ocean_view
stargazing
city_skyline
other
```

7 entries. Cover the common cases. Add more as users request.

## Acceptance criteria

1. Empty search bar + no query → 3 seeded peaks shown as pills/cards in the empty state
2. Type "Snoq" → sees Snoqualmie Falls (existing subjects + Google Places suggestions)
3. Tap a Google Place → "Add subject" sheet appears with name pre-filled, category dropdown required, lat/lng pre-filled
4. Submit → subject created with `created_by = auth.uid()`, becomes active subject, map flies there
5. Try to add "Snoqualmie Falls" twice → second attempt shows "Already exists. View it instead?" with a button
6. The 3 seeded peaks have `kind = 'mountain_peak'` after the migration
7. Existing viewpoint creation flow continues to work for both old and new subjects
8. Camera default zoom adjusts: tighter for non-mountain (delta=0.05) vs wider for mountain (delta=1.4)

## Data model

```sql
-- Migrate kind field to richer set
alter table public.subjects
  drop constraint if exists subjects_kind_check;

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

update public.subjects set kind = 'mountain_peak' where kind = 'mountain';

-- Track creator + Google Place ID for dedup + extensibility
alter table public.subjects
  add column if not exists description text,
  add column if not exists created_by uuid references public.profiles(id),
  add column if not exists place_id text,
  add column if not exists created_at timestamptz default now();

create unique index if not exists subjects_place_id_uniq
  on public.subjects (place_id) where place_id is not null;

-- Allow signed-in users to insert their own subjects
create policy "subjects: insert by authed"
  on public.subjects for insert
  with check (auth.uid() = created_by);

create policy "subjects: update own"
  on public.subjects for update
  using (auth.uid() = created_by);
```

## Google Places setup

- **Enable Places API (New)** in Google Cloud Console for the peakaboo
  project. The existing Maps key already covers Maps SDKs but not Places.
- **Add Places API to the existing API key's allowed APIs.**
- **Cost note**: Autocomplete is ~$2.83/1000 requests, Place Details
  (which we'll need for full coordinates) is ~$17/1000. At ~100 users
  this is negligible. The $200/mo Google credit covers ~11K Place
  Details calls.

## Implementation tasks

### Phase 1: Schema + RLS (~30 min)

1. Migration `0011_subjects_user_added.sql` with all of the above.

### Phase 2: Search hook (~60 min)

2. `useSubjectSearch` hook — debounced query (300ms) that:
   - Queries `subjects` for fuzzy name + proximity matches
   - In parallel calls Google Places Autocomplete with results filtered
     to physical_features + establishments
   - Returns `{ existing: Subject[], suggestions: PlaceSuggestion[] }`

### Phase 3: Search UI (~90 min)

3. Replace pill row with `<SubjectSearch>` component
4. Dropdown panel below input with the two-section results
5. Empty state showing the 3 seeded peaks

### Phase 4: Add subject flow (~60 min)

6. `<AddSubjectSheet>` component — name + category + description form
7. Submit handler that calls Place Details for coordinates, then inserts
   the subject row with the place_id
8. Dedup check before insert (unique constraint will fail-fast; show a
   nice "view existing" UI)

### Phase 5: Camera + integration (~30 min)

9. Update `cameraTarget` logic in App.tsx: derive delta from category
   (mountain_peak = 1.4, others = 0.05)
10. Refresh `usePlaces` after subject creation
11. Wire search-selected subject as the new active subject

### Phase 6: Test (~30 min)

12. Existing peak flows still work (Mt Rainier viewpoints render)
13. Add Snoqualmie Falls → success
14. Add it again → "view existing" path
15. Native + web parity

## Open questions

- **Should we restrict who can add subjects?** Currently anyone signed in
  can. Could add a "trusted user" flag later. Defer.
- **What about subject moderation?** Reported subjects (vandalism, fakes)
  flow through the same `reports` table once we add `report_type:
  subject`. Defer to a later spec.
- **Google Places vs. self-pinning?** The current "drop pin / coordinates"
  flow for viewpoints could also work for subjects without Places. My take:
  Places is much better UX for subjects (we want canonical place IDs).
  Keep self-pinning for viewpoints since those are sub-locations of subjects.
