# Specs

Forward-looking specs for upcoming work. Each spec is sized to be
executable from cold without re-reading the conversation that produced
it. Cross-reference `docs/backlog.md` for the broader feature pipeline.

## Convention

- Numbered prefix = recommended build order (`01-`, `02-`, …)
- Each spec has: Goal, Non-goals, User experience, Acceptance criteria,
  Data model (if applicable), Implementation tasks, Open questions
- Tasks within a spec are sized in 10-90 min increments; entire spec
  should be a 1-5 hour focused session
- Status field at top: `ready to build`, `in progress`, `done`,
  `blocked`, `deferred`

## Active

| # | Title | Effort | Why now |
|---|---|---|---|
| 04 | [Search dropdown click + visibility icons + reframed search](04-search-fix-and-polish.md) | ~1.5h | P0 — clicks don't work, blocks core search flow |
| 05 | [User-supplied date & time for a sighting](05-sighting-datetime.md) | ~3.5h | Unblocks logging photos taken earlier, plus post-save time edits; DB side applied in `0016` + `0017` |

## Deferred

| # | Title | Why deferred |
|---|---|---|
| 03 | [Places search + subject categories](03-places-search-and-categories.md) | Done — shipped in commit e5f0709 |
| 01 | [Map markers show visibility status](01-map-visibility-status.md) | Bumped behind 04 (P0 click bug); revisit after 04 |
| 02 | [OG link previews for shared viewpoints](02-og-link-previews.md) | Bumped behind 04; revisit before broader public sharing |

## Workflow when picking up a spec

1. Read the spec end-to-end, including Open Questions
2. Resolve Open Questions before starting (decisions, not coding)
3. Create one branch per spec (`spec-01-map-visibility`)
4. Tick acceptance criteria as PR-ready, not as you code them
5. Update spec status as you go (`in progress` → `done`)
6. After merge, move spec to `docs/specs/done/` so the active list stays focused
