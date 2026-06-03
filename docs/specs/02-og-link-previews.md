# Spec: OpenGraph link previews for shared viewpoints

**Status:** ready to build
**Priority:** P1 — required before public sharing scales
**Estimated effort:** ~3 hours

## Goal

When a user shares `https://peakaboo-zeta.vercel.app/v/<viewpointId>`
on iMessage, Slack, Twitter, LinkedIn, etc., the link preview should
show the viewpoint's name, the subject (e.g. "Mt Rainier"), and ideally
a representative photo. Today every shared link previews as the
generic "PeakAboo" home page because the SPA doesn't render
OpenGraph meta tags server-side.

This isn't cosmetic. Generic previews undercut the "look at my app"
moment when you share, and they reduce click-through.

## Non-goals

- Custom Open Graph cards per category — same template for every viewpoint
- Twitter Cards beyond what OpenGraph already provides (Twitter accepts OG)
- Dynamic OG images generated server-side from photos (defer; static image works for v1)

## User experience

- Sharing `/v/<id>` in an iMessage thread → preview shows:
  - **Title:** `Picture Lake — Mt Baker viewpoint`
  - **Description:** `Iconic reflection of Mt Shuksan with Baker nearby.`
  - **Image:** a static PeakAboo branded image for v1; the most-recent
    photo from a sighting at that viewpoint for v2
- The same metadata shows in Slack unfurls, Twitter Cards, LinkedIn
  link previews, and Discord embeds
- The actual web app continues to load and render normally for human
  visitors — only crawlers see the SSR'd HTML

## Acceptance criteria

1. Pasting a `/v/<id>` URL into iMessage on iPhone shows the viewpoint
   name + subject in the preview, not "PeakAboo"
2. Same in Slack and on Twitter (paste link, wait for unfurl)
3. Crawlers fetching `/v/<id>` get HTML with `<meta property="og:..." />`
   tags filled in from the database
4. Human visitors still get the React SPA — no double-render, no FOUC
5. Unknown viewpoint IDs fall back to the generic PeakAboo preview
6. Privacy and reset-password pages keep their generic preview

## Architecture

Vercel's catch-all rewrite to `/index.html` makes this slightly tricky —
crawlers hit the SPA shell, not a server-rendered page. Two real
approaches:

### Option A: Vercel Edge Function with rewrite (recommended)

- Add `api/og/[id].ts` as a Vercel Edge Function
- It queries Supabase (anon key, public.viewpoints) for the viewpoint
- Returns full HTML with proper `<meta>` tags + a `<script>` redirect
  to the SPA for human browsers
- Update `vercel.json` to route `/v/<id>` requests through this function
  for crawlers (detect via `User-Agent`), passthrough to SPA otherwise

The User-Agent detection is the hairy part. Reliable approach:
**always** serve the SSR'd HTML at `/v/<id>` — the SPA bootstraps from
that HTML the same way it does from `index.html` because the body just
contains `<div id="root">`.

### Option B: Pre-rendered HTML at build time

- Build a script that generates one HTML per viewpoint at deploy time
- Vercel serves the pre-rendered HTML instead of the SPA shell
- Doesn't scale beyond a few hundred viewpoints; rebuild for every new viewpoint

Skip B. Go with A.

## Implementation tasks

1. **Plan the Vercel function** — confirm `@vercel/node` runtime, Supabase
   anon-key import works in Edge runtime. ~15 min.
2. **`api/v/[id].ts`** — Vercel Edge Function that:
   - Reads `id` from path
   - Queries Supabase: `viewpoints` joined to `subjects`
   - Returns HTML containing the SPA's `index.html` content with OG tags
     filled in, OR a 302 to a static PeakAboo OG page if the id doesn't exist
   - ~60 min.
3. **Build-time copy of `index.html`** — the function needs the SPA's
   bundle paths injected, so it needs access to `dist/index.html` at
   request time. Either inline at build (simpler) or read from `dist/`
   at request time (Vercel's filesystem). ~20 min.
4. **`vercel.json`** — add explicit route for `/v/:id` → function. The
   existing catch-all rewrite to `/index.html` stays for everything else.
   ~10 min.
5. **Static OG image** — design a simple peakaboo-shape image at
   `assets/og-default.png`, 1200×630 (OG spec). Reference from the
   meta tags. ~15 min.
6. **Test with crawlers**:
   - Facebook OG debugger: https://developers.facebook.com/tools/debug/
   - Twitter Card validator: https://cards-dev.twitter.com/validator
   - Slack: paste in any channel, watch unfurl
   - iMessage: send to yourself, see preview
   - Tools that don't fetch synchronously: paste then refresh after a few seconds
   - ~30 min.
7. **Edge case**: ensure 404 IDs return a 200 with the generic PeakAboo
   meta tags rather than crashing. ~10 min.

## Open questions

- **Per-viewpoint dynamic OG images?** Long-term yes, defer for v1. Would
  require an image-generation service (Vercel OG, Resvg, satori). Static
  PeakAboo image is fine to start.
- **Caching?** Vercel Edge Function responses can be cached. Set
  `Cache-Control: public, max-age=300` so crawlers don't hammer Supabase.
- **Subject of the share text?** Currently "Picture Lake — Mt Baker
  viewpoint". Some apps shorten to "Picture Lake on PeakAboo". Pick one
  and ship.
