# Spec: Map markers show visibility status

**Status:** ready to build
**Priority:** P1 — biggest UX win per hour of code
**Estimated effort:** ~2 hours

## Goal

When a user opens the app, they should be able to glance at the map and
immediately know which viewpoints have a recent "yes, the mountain is
out" sighting versus which have a "no" or no data. Currently every
viewpoint pin is the same generic blue regardless of conditions, so
users have to tap each one to find out.

## Non-goals

- Aggregating sightings across users (averaging visibility scores, etc.) — show the most-recent only
- Per-condition styling (clear vs. cloudy vs. snowy) — binary visible/not-visible/unknown for v1
- Time-decay weighting (a sighting from 6 hours ago counts the same as one from 6 minutes ago, as long as it's same-day)

## User experience

- Viewpoint pins on the map render in one of four states:
  - **Green ring** — most-recent sighting today is visible (`visible = true`)
  - **Red ring** — most-recent sighting today is not visible (`visible = false`)
  - **Gold ring (favorite, retained)** — current favorite styling, but with the green/red ring overlaid if there's a same-day sighting
  - **Default blue** — no same-day sightings exist
- The visibility ring updates live when the user logs a new sighting (their own write should be reflected immediately)
- "Today" = `viewpointDateKey()` already used elsewhere

## Acceptance criteria

1. Opening the app on a day where there are sightings shows colored rings on the relevant viewpoint pins
2. Logging a new sighting from any viewpoint immediately changes that viewpoint's pin to the appropriate ring color
3. Deleting a sighting from the feed reverts the pin to the next-most-recent same-day sighting, or to default if none
4. No additional Supabase query per pin — single batched query when the map mounts/refreshes
5. Native + web parity

## Data model

A new view (or a select query in `usePlaces`) that joins each viewpoint
with its most-recent sighting from today:

```sql
create or replace view public.viewpoint_today_status as
select
  v.id as viewpoint_id,
  s.visible,
  s.observed_at
from public.viewpoints v
left join lateral (
  select s.visible, s.observed_at
  from public.sightings s
  where s.viewpoint_id = v.id
    and (s.observed_at at time zone 'America/Los_Angeles')::date
        = (now() at time zone 'America/Los_Angeles')::date
  order by s.observed_at desc
  limit 1
) s on true;
```

Public read (anon select) on the view since underlying tables are public.

## Implementation tasks

1. **Schema** — write `0010_viewpoint_today_status.sql` with the view above. ~10 min.
2. **Hook** — extend `usePlaces` (or a new `useTodayStatus` hook) to fetch the view alongside viewpoints. Batched, single query. ~20 min.
3. **MapMarker type** — add `status?: "visible" | "not_visible" | null` field. ~5 min.
4. **PeakPin / pin rendering** — already custom on native + web. Add a colored ring overlay when status is set. ~30 min.
   - Native: outer `View` with `borderColor` based on status
   - Web: same `<View>` works under react-native-web
5. **Live update on sighting save** — after `SightingForm` save, refresh the status (just bump a tick on usePlaces). ~10 min.
6. **Live update on sighting delete** — same but from `SightingsFeed.handleDelete`. ~10 min.
7. **Test** — log a Yes sighting → ring should turn green. Delete it → ring reverts. Log a No sighting → ring red. ~15 min.

## Open questions

- **Do we want to show how many sightings inform the ring?** ("3 people say visible, 1 says not"). My take: defer; this is a v2 conversation when there are enough sightings to disagree.
- **Stale-data threshold?** Visibility changes by the hour. A "visible" report from 8am is irrelevant by 5pm. My take: for v1, use the most-recent same-day report regardless of hour. Add hour-decay later if it's noticeably wrong.
