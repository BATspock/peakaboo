# Spec: Search dropdown click + visibility icons + reframed search

**Status:** ready to build
**Priority:** P0 — search clicks don't work, blocks core flow
**Estimated effort:** ~1.5 hours

## Goal

Three connected changes to the search + sighting flow:

1. **Bug fix**: typing in the home search bar shows results (Google Places
   autocomplete + existing-subject matches), but **clicking a result does
   nothing**. The dropdown dismisses and the user is stranded.
2. **Reframe search behavior**: when a user searches a subject, the result
   should clearly show whether PeakAboo already has that subject (with
   its viewpoints) OR offer to add it. Pills below the search are reserved
   for the user's favorites + curated defaults — they're not a search
   target.
3. **Add icons to visibility levels**: the new 5-point scale (Crystal
   clear / Mostly out / Halfway out / Barely out / Hidden) has color dots
   only. Add Ionicons to each level so the choice reads at a glance.

## Context for the next session

We're deep into PeakAboo (a crowdsourced peak/landmark visibility app).
The relevant prior work shipped in commit `c3e75e3` and earlier:

- `src/components/SubjectSearch.tsx` — search bar + dropdown component.
  Uses `forwardRef` + `useImperativeHandle` to expose `.focus()`. Built
  on `useSubjectSearch` (debounced, calls Supabase + Google Places).
- `src/data/useSubjectSearch.ts` — debounced (600ms, min 3 chars) hook.
  Returns `{ existing: Subject[], suggestions: PlaceSuggestion[] }`.
- `src/components/SubjectPinRow.tsx` — favorites pill row with × to unpin
  and `[+] Add` button. Sits below the search bar.
- `src/data/useSubjectPins.tsx` — context provider. Up to 5 pins per
  user, defaults are Mt Rainier · Snoqualmie Falls · Downtown Seattle.
- `src/sightings/SightingForm.tsx` — has the new 5-point scale already.
  See `VISIBILITY_LEVELS` array near the top.
- `src/viewpoints/AddViewpointSheet.tsx` — pre-selects active subject
  via `defaultSubjectId` prop, has prominent banner + dedup panel.
- `src/components/SubjectPicker.tsx` — picker used inside
  AddViewpointSheet. Already shows Pinned + Recent shortcuts +
  filter input. Recent comes from `src/data/recentSubjects.ts`
  (AsyncStorage-backed, last 3, recorded by SubjectSearch on pick
  and by App.tsx on subject create/open-existing).
- `App.tsx` — wires it all together. `searchRef.current?.focus()`
  is called by `SubjectPinRow`'s [+] button.

User's symptom for the click bug:
> "search is working but when I click on something from dropdown,
> nothing happens why?"

We added debug `console.log`s in `pickExisting` / `pickPlace` /
`PlaceRow` press handler in a previous turn but the user moved on
without telling us what the logs showed. Then I removed those logs
in commit `c3e75e3`. **Re-add them as the first investigation step
in this spec.**

## Decisions locked in

| Decision | Choice |
|---|---|
| Pills below search bar | User's favorites (subject_pins) + 3 defaults for signed-out users. NOT a search target. |
| Search shows | Existing subjects in PeakAboo + Google Places suggestions to add new |
| Search "no result" empty state | Helpful message: "We don't have <query> yet. Add it from Google Places below or search differently." |
| Subject picker in AddViewpointSheet | Shows last 3 recent searches as priority chips when there are no pins, otherwise pinned + recent (already implemented; confirm still works) |
| Visibility level icons | Ionicons matching the existing color tints |

## Recommended icons for the visibility levels

Map to the existing 5-point scale in `src/sightings/SightingForm.tsx`
(see `VISIBILITY_LEVELS` array):

| Level | Label | Tint | Suggested icon |
|---|---|---|---|
| 5 | Crystal clear | forestSoft (green) | `sunny` (Ionicons) |
| 4 | Mostly out | leaf (light green) | `partly-sunny` |
| 3 | Halfway out | peak (orange) | `cloud-outline` |
| 2 | Barely out | ember (dark orange) | `cloudy` |
| 1 | Hidden | clay (red) | `eye-off-outline` |

Adjust if the user feedback in next session prefers different icons.

## User experience

### Search flow (revised)

1. User taps search bar → dropdown opens
2. **Empty state**: shows the user's pinned subjects + "Recently
   viewed" subjects (from `recentSubjects` storage)
3. **Typing < 3 chars**: dropdown shows a "Keep typing..." hint, no
   API calls (existing min-length behavior)
4. **Typing 3+ chars**: two sections appear:
   - **In PeakAboo** — existing subjects matching the query (fuzzy
     name search via Supabase `ilike`). Each row is tappable: tap
     to view the subject + its viewpoints on the map.
   - **Add new** — Google Places suggestions. Each row tappable:
     tap to open AddSubjectSheet, which creates the subject in
     PeakAboo, then activates it.
5. **Empty results state**: explicit copy:
   > "We don't have **<query>** yet. Try a Google Places suggestion
   > below, or search differently."
6. **After picking**: dropdown closes, map flies to the chosen
   subject, the search bar clears, and `recordRecentSubject(id)`
   is called.

### Why clicks don't work today (hypothesis to verify in next session)

Most likely either:
- `react-native-web` translates `Pressable` to a `<div>` whose click
  fires after `<TextInput>` blur, but blur causes a re-render that
  swaps DOM nodes mid-event. Possible fix: use `onPressIn` instead
  of `onPress`, or add `onMouseDown` directly on web.
- The `setQuery("")` inside `pickExisting` / `pickPlace` triggers
  the `useSubjectSearch` debounce to fire again with the empty
  string, causing the dropdown to clear before the parent handler
  runs. Possible fix: call `onSelectSubject` first, then `setQuery`.

**Action for next session**: re-add `console.log`s, ask user to
click and paste output. Don't guess.

### Visibility level icons

In `SightingForm.tsx`, the level row currently renders a colored dot
(`<View style={[styles.levelDot, ...]} />`). Replace with an
`<Ionicons>` of the correct name + colored tint. Active state still
uses the colored background; icon goes white when active.

## Acceptance criteria

1. Typing "Snoq" → tap "Snoqualmie Falls" in "In PeakAboo" → map
   flies to Snoqualmie, dropdown closes, search bar clears
2. Typing "Mount Hood" (a place not in PeakAboo) → tap a Google
   Places result → AddSubjectSheet opens with name pre-filled
3. Typing "qwerty" → "We don't have qwerty yet" empty state
4. Empty search bar focused → shows pinned + recent subjects (no
   network call)
5. 5-point visibility scale rows now have proper icons replacing
   the colored dots
6. Recent subjects persist across reloads (already works, just
   verify)

## Implementation tasks

1. **Re-add debug logs** to `pickExisting`, `pickPlace`, and the row's
   onPress handler in `SubjectSearch.tsx`. Ask user to test and paste
   console output. (5 min)
2. **Diagnose + fix the click bug** based on what the logs reveal.
   Most likely fix: reorder operations in `pickExisting` /
   `pickPlace` (call `onSelectSubject(s.id)` before `setQuery("")`),
   or switch to `onPressIn`. (15 min)
3. **Empty-results state** — when `existing.length === 0` AND
   `suggestions.length === 0` AND `!loading`, render the friendly
   "We don't have <query>" copy. Currently shows generic "No
   matches" text. (10 min)
4. **Empty-search state** — when `query === ""`, dropdown shows
   pinned subjects + a "Recently viewed" section pulled from
   `getRecentSubjects()`. (15 min — needs an async load on focus.)
5. **Visibility level icons** — update `VISIBILITY_LEVELS` array to
   include an `icon` field, render `<Ionicons name={lvl.icon}>`
   instead of the colored dot. Active state: icon goes
   `colors.textOn`. (20 min)
6. **Type-check + commit + push.** (10 min)

## Files involved

- `src/components/SubjectSearch.tsx` — primary file for tasks 1-4
- `src/sightings/SightingForm.tsx` — task 5 (`VISIBILITY_LEVELS`
  array and the level row render)
- `src/data/useSubjectSearch.ts` — read-only reference; don't change
- `src/data/recentSubjects.ts` — read-only reference; don't change
- `src/data/useSubjectPins.tsx` — read-only reference; don't change

## Open questions

- None blocking. The icon picks are my best guesses; user might
  request different ones after seeing them rendered.

## Push state at session end

Many commits queued locally awaiting `git push`. Run before testing
on Vercel:

```sh
cd /Users/adkishor/pp/peakaboo && git push
```

## What was just completed (commit c3e75e3 and earlier this session)

- Subject pins feature (5 max, default trio Rainier/Snoqualmie/Downtown
  Seattle, × button to unpin, `[+] Add` button focuses search)
- Camera button alongside library picker in SightingForm
- Default subject pre-selection in AddViewpointSheet (no more "Mt
  Rainier" auto-selected when adding to a different subject)
- Prominent green banner showing "This viewpoint shows: <subject>"
- 5-point visibility scale replacing the binary yes/no + 0-10 scale
  (preserves backward compat with existing data)
- Migration 0013_swap_default_pins.sql swapped Mt Baker → Downtown
  Seattle as the third default pin
