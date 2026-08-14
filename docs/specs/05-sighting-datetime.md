# 05 — User-supplied date & time for a sighting

**Status:** in progress — implemented, PR open
**Effort:** ~3.5h
**Depends on:** migrations `0016_user_supplied_observed_at.sql` and
`0017_sighting_time_edit_log.sql` (both applied)

## Goal

Let the user say *when* an observation happened instead of always stamping it
"now", so a photo taken yesterday afternoon can be logged tonight and lands in
the feed under yesterday.

## Non-goals

- Editing any field other than the time after saving. Level, conditions, notes
  and photos remain immutable once saved; that refactor needs its own spec.
- Per-photo timestamps — one timestamp per sighting, matching the schema
- Minute-level manual precision (see Decisions)
- Timezones outside `America/Los_Angeles` (deferred with the rest of
  `src/lib/time.ts`)

## Decisions

1. **Zero new dependencies.** No date-picker library. The UI is chips plus a
   day list, which behaves identically on web and native and avoids a
   native-only module that React Native Web cannot render.
2. **EXIF auto-fill is the primary path.** Attaching a photo prefills its
   capture time, so the common "upload an old photo" case costs zero taps.
   Native only — on web `exif` is unsupported and we fall back to "Now".
3. **Manual precision is hourly.** Chips for the hour, not a minute spinner.
   Visibility of a mountain does not change meaningfully within an hour, and
   EXIF supplies exact minutes when it matters. Alternative if this feels too
   coarse: add 15-minute sub-chips.
4. **Picked wall-clock is viewpoint time**, not device time, because
   `observed_on` is generated in `America/Los_Angeles` and all formatting in
   `src/lib/time.ts` assumes it.
5. **Manual backdating reaches 30 days.** Older-than-30-days is reachable via
   EXIF only. Keeps the day list scannable; revisit if users ask.
6. **Backdated rows are disclosed** with a subtle "logged later" note when
   `created_at - observed_at > 12h`, so the feed stays trustworthy.
7. **Post-save time edits are allowed, and logged publicly.** The trail is
   written by a trigger (`0017`) rather than the client, and the table has no
   insert policy, so the owner can neither skip nor forge an entry. Original
   upload time needs no new column — `sightings.created_at` already holds it.
8. **Row actions consolidate into one 3-dot menu.** The feed previously showed
   a bare trash icon on your rows and a flag icon on everyone else's; three or
   four affordances per row needed a menu rather than more icons.

## User experience

A single row above Photos in the sighting form:

```
When?   [ Now ]  [ Earlier today ]  [ Yesterday ]  [ Pick a day ]
```

- `Now` is preselected. Someone logging a live sighting touches nothing.
- `Earlier today` / `Yesterday` reveal a horizontal hour strip
  (`5 AM … 9 PM`, current hour always included), defaulting to the current
  hour for today and noon otherwise.
- `Pick a day` reveals a scrollable list of the last 30 days
  ("Wed, Aug 12"), then the same hour strip.
- Attaching a photo with EXIF capture time replaces the selection with that
  exact timestamp and shows `Tue, Aug 12 · 3:42 PM · from photo`. A manual
  selection wins over EXIF and is never silently overwritten.
- Future times are unreachable in the UI; the `0016` trigger is the backstop.

## Data model

No schema change. `sightings.observed_at` is already client-set `timestamptz`;
`observed_on` is generated from it; both feeds already
`order by observed_at desc`. Migration `0016` adds the future-timestamp guard
and the `observed_at` indexes.

## Implementation tasks

### 1. `src/lib/observedAt.ts` (new) — ~30 min

Pure, testable helpers:

- `isoFromViewpointWallClock(dayOffset: number, hour: number): string` —
  builds a UTC instant from LA wall-clock parts. Derive the zone offset for
  that specific date via `Intl.DateTimeFormat` with
  `timeZone: DEFAULT_VIEWPOINT_TZ` so DST is handled; do not hardcode -8/-7.
- `isoFromExif(exif: Record<string, any> | null): string | null` — reads
  `DateTimeOriginal`, falling back to `DateTime`. Format is
  `"YYYY:MM:DD HH:MM:SS"` with no zone; interpret as viewpoint time per
  Decision 4. Returns `null` on absent/unparseable/future values.
- `recentDays(count: number): { offset: number; label: string }[]` — labels
  via the existing `formatViewpointDay`, so "Today"/"Yesterday" come free.
- `HOUR_CHOICES` and a `clampToNow` guard.

### 2. `src/components/DateTimeField.tsx` (new) — ~45 min

Controlled component: `{ value: string; source: "now" | "manual" | "exif";
onChange(iso, source) }`. Chip row, conditional day list, hour strip. Reuses
`Chip`-style pressables and `colors`/`radii` from `src/theme.ts`.

### 3. `src/sightings/uploadImages.ts` — ~20 min

- Pass `exif: true` to both `launchImageLibraryAsync` and
  `launchCameraAsync`.
- Extend `PendingImage` with `takenAt: string | null`, populated in
  `pickImages` via `isoFromExif(a.exif)` — must happen here, before
  `manipulateAsync` discards EXIF.
- No change to the upload path.

### 4. `src/sightings/SightingForm.tsx` — ~30 min

- Add `observedAt: string` and `observedAtSource` to `FormState`; `EMPTY`
  seeds `observedAt` with now and source `"now"`.
- Render `<DateTimeField>` in a `When?` section above `Photos`.
- In `handleAddPhotos`, if source is still `"now"` and the first new photo has
  `takenAt`, adopt it with source `"exif"`.
- Replace the hardcoded `observed_at: new Date().toISOString()` (line 223)
  with `form.observedAt`.
- Re-seed `observedAt` to a fresh now on save and on viewpoint change, so the
  existing reset behaviour still holds.

### 5. `src/sightings/SightingsFeed.tsx` — ~15 min

- Add `created_at` to the select at line 110.
- Render a muted "logged later" line when the gap exceeds 12h.
- Leave the existing `observed_on === today` highlight alone — a backdated row
  correctly loses it.

### 6. Verify — ~20 min

- `npx tsc --noEmit` clean.
- `npm run web`: log with `Now`; log with `Yesterday` + an hour and confirm it
  sorts under yesterday with the "logged later" note; confirm the feed order
  is by observed time, not insert time.
- Native EXIF prefill needs a device via Expo Go; web will report
  `exif: null` by design.
- Attempt a future timestamp via the Supabase SQL editor and confirm the
  `0016` trigger rejects it.

### 7. `src/sightings/SightingsFeed.tsx` — 3-dot menu — ~25 min

Replace the split trash/flag icons with a single `ellipsis-horizontal` button
opening a `BottomSheet` action list: `View sighting history` for everyone,
plus `Update observation time` and `Delete sighting` for the owner, or
`Report this sighting` for others. A `localRefresh` nonce added to the load
effect refetches after an in-feed edit.

### 8. `src/sightings/EditTimeSheet.tsx` (new) — ~25 min

`BottomSheet` + `DateTimeField` + `.update({ observed_at })`. No-ops when the
value is unchanged. Needs no guards of its own: `0016` rejects future times and
`0017` records the change.

### 9. `src/sightings/SightingHistorySheet.tsx` (new) — ~30 min

Public provenance view: original upload time from `created_at`, current
observed time, then each `sighting_time_edits` row as "Moved from X to Y".
Reachable from the menu on any sighting, and from the "logged later" note.

## Acceptance criteria

Implemented but not yet exercised in a browser or on a device:

- [ ] Logging a live sighting requires no interaction with the new control
- [ ] `Yesterday` + an hour saves an `observed_at` on yesterday's date in
      viewpoint time, and `observed_on` matches
- [ ] A backdated sighting sorts by observed time in both the viewpoint feed
      and the history sheet
- [ ] Attaching a photo with EXIF on native prefills its capture time and
      labels the source
- [ ] A manual selection is never overwritten by a later photo's EXIF
- [ ] Backdated rows show "logged later"; same-day rows do not
- [ ] Owner can change the observed time after saving
- [ ] Every time change appears in the public history sheet

Verified:

- [x] `tsc --noEmit` passes clean

## Verification status

Static typecheck only. `npm run web` and a device pass over the EXIF path are
still outstanding — see the PR description.

## Open questions

- Hourly manual precision, or add 15-minute sub-chips? (Decision 3)
- 30-day manual reach, or further? (Decision 5)
- Does this ship before spec 04 (P0 search-click bug)?
