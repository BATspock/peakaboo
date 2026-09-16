# 06 — Page the viewpoint sightings feed

**Status:** in progress — implemented, PR open
**Effort:** ~45m
**Depends on:** nothing (client-only; no migration)

## Goal

Make every sighting at a viewpoint reachable. Today the feed fetches the newest
25 and stops, so the list appears to "cut off at a date" — the date being
wherever the 25th-newest sighting happens to land. Older sightings, and every
photo attached to them, are unreachable from the UI.

## Non-goals

- Infinite scroll. An explicit **View more** is cheaper to reason about, does
  not fight the parent `BottomSheet`'s scroll container, and never fetches
  because the user drifted.
- Paging `HistorySheet` ("my sightings", capped at 30). Same bug class, other
  screen — see Follow-ups.
- Thumbnail limits. Three thumbs per sighting plus a `+N` tile is deliberate,
  and `+N` already opens `ImageLightbox` at the fourth photo, so no photo is
  unreachable *within* a sighting.
- Server-side changes. `sightings` already has the ordering columns.

## Decisions

1. **Keyset, not offset.** `.range()` drifts: if anybody logs a sighting while
   the reader is paging, every later row shifts by one, so page 2 repeats one
   row and silently skips another. A cursor naming the last row already shown
   is immune to inserts.
2. **`(observed_at, id)` is the cursor, and the sort.** `observed_at` alone is
   not a total order — two people can log the same minute at the same viewpoint
   — so ties order nondeterministically and rows fall through the page boundary.
   `id` (uuid, `<` comparable) is the tiebreak in both `order` and the cursor.
   This also makes the *first* page deterministic, which it previously was not.
3. **Timestamps are quoted in the `or` filter.** `observed_at` carries `:`, `.`
   and `+`, all of which PostgREST reads as filter syntax inside an `or` group.
   Verified emitted URL:
   `or=(observed_at.lt."<ts>",and(observed_at.eq."<ts>",id.lt.<uuid>))`,
   with `+` → `%2B` and `:` → `%3A` on the wire.
4. **A full page is the "more?" probe.** `page.length === PAGE_SIZE` sets
   `hasMore`. Costs no extra round trip; the price is one empty final fetch when
   the total is an exact multiple of 25.
5. **Append dedupes on `id`.** A sighting backdated into a window already read
   could otherwise arrive twice and collide on its React key.
6. **`PAGE_SIZE` stays 25.** First paint is unchanged; only reachability changes.

## User experience

- Open a viewpoint → newest 25 sightings, exactly as before.
- If a 26th exists, a bordered **View more sightings** button sits below the
  list; pressing it appends the next 25 and keeps the button while more remain.
- While fetching, the button shows a spinner and is disabled (`accessibilityState`
  reports `disabled` + `busy`); 44pt minimum touch target.
- Logging, editing a time, or deleting still resets to page 1 — the existing
  `refreshKey` / `localRefresh` behaviour is untouched.

## Acceptance criteria

- [ ] A viewpoint with >25 sightings shows **View more sightings**; a viewpoint
      with ≤25 does not.
- [ ] Pressing it appends older sightings with no duplicate and no gap at the
      seam, including when two sightings share one `observed_at` minute.
- [ ] The button disappears after the last page.
- [ ] Photos on appended sightings open in the lightbox as on page 1.
- [ ] Logging a new sighting mid-session resets the feed to page 1.
- [ ] `npx tsc --noEmit` clean.

## Implementation tasks

1. ~~Extract `sightingsPage(viewpointId, cursor)` with `PAGE_SIZE`,
   `SELECT_COLUMNS`, the `(observed_at, id)` sort and the keyset `or` filter.~~
2. ~~Add `hasMore` / `loadingMore` state; first-page effect sets both.~~
3. ~~`loadMore()` appends with id-dedupe and re-probes `hasMore`.~~
4. ~~Render the **View more sightings** control + styles.~~

All in `src/sightings/SightingsFeed.tsx`.

## Follow-ups

- `src/sightings/HistorySheet.tsx` has the same `.limit(30)` shape. Once this
  lands, lift the paging into a shared `usePagedSightings` hook rather than
  copy-pasting it.
- No test framework exists in this repo, so nothing here is covered by an
  automated test. Standing up `jest-expo` + `@testing-library/react-native` is
  its own spec; the seam worth testing first is the cursor filter string.

## Open questions

None blocking.
