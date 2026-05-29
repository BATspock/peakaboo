# PeakAboo — feature backlog

Living document. Re-rank as user feedback comes in. Build by *signal*,
not by tier order.

---

## Tier 1 — Build before broad public launch (next 2-4 weeks)

Gaps that hurt user perception or block growth.

| Feature | Why now | Effort |
|---|---|---|
| **App icon + favicon** (real one, not Expo blueprint) | First-impression polish; assets already created | 15 min once dropped in |
| **OpenGraph link previews** | Shared `/v/<id>` links currently preview as default favicon. Big for sharing on iMessage/Slack/Twitter — needs server-rendered meta tags | 3-4 hours, small Vercel serverless function |
| **Better empty states** | First-timers with no sightings see "no sightings yet, be the first." Could surface what others are reporting nearby, or the most-active viewpoint of the day | 1 hour |
| **Pan map to viewpoint when opened from history/favorites** | Sheet opens but map stays where it was. Subtle; matters for orientation | 30 min |
| **Sighting visibility on the map itself** | Show today's most-recent sighting result as a small badge on each viewpoint pin (green check / red X / no data). One-tap loop | 2 hours |
| **Email notifications when reports come in** | Currently requires manually polling the Supabase dashboard. Use Database Webhooks → email | 1 hour |

## Tier 2 — Build once you have ~50 users with real feedback

Wait for signal. These are guesses about what users will want.

| Feature | Trigger to build |
|---|---|
| **Generic "any landmark" subjects** (Snoqualmie Falls, Space Needle, etc.) | When >5 users ask "can I add my own peak/landmark?" |
| **Real search bar** with subject autocomplete | When subject count > 5; pills are fine until then |
| **Search by location** ("viewpoints near me") | When a user with no Seattle context tries the app and gives up |
| **Map auto-pan on subject pill change** | Polish, can wait |
| **Profile pages** (your sightings, photos, contributed viewpoints) | When users start asking "where are my old posts?" |
| **Block/mute another user** | When the first harassment report comes in |
| **Report viewpoints** (not just sightings) — vandalism, fake spots | When someone adds a junk viewpoint |
| **Better photo viewer** (pinch zoom, swipe between sightings) | When someone complains lightbox feels limited |
| **Comments on sightings** | Probably never — keeps the data clean. Reconsider only if engagement is dead |
| **Likes / "saw it too" reactions** | Same as above; risk: becoming Instagram |

## Tier 3 — Native mobile (iOS + Android)

Big project. ~2 weeks of focused work + ongoing maintenance.

| Feature | Notes |
|---|---|
| **EAS build pipeline** | Apple Developer ($99/yr), Google Play Console ($25 one-time). Set up once |
| **TestFlight beta + Play Internal Testing** | Distribute without app-store review |
| **Native camera UX** (snap-and-log) | Tap FAB, take photo, log sighting in one flow |
| **Background location for proximity alerts** | The "vibrate within 0.5mi of saved viewpoint" feature originally requested. Real value on native; iOS requires "Always" permission + App Store justification |
| **Push notifications** | "Mt Rainier just became visible from Kerry Park!" when a sighting comes in for a saved spot |
| **Offline queue + sync** | Sightings made without network queue locally and sync when reconnected. Real value once mobile users tap Save at trailheads |
| **Native Google Sign-In SDK** | Replace expo-auth-session flow with @react-native-google-signin/google-signin for cleaner native sheet |
| **Apple Sign-In** | Required by App Store guidelines if Google Sign-In ships on iOS |

## Tier 4 — Stickiness / engagement features

Build only if engagement metrics tell you you need them.

| Feature | Notes |
|---|---|
| **Daily digest email** | "Here's what people saw today from your saved spots" — drives retention, spammy if overdone |
| **Streaks / gamification** | Effective for behavior loops, cheap-feeling; only if you see dropoff |
| **Public user profiles + follow** | Turns it into a small social network. Big commitment |
| **Photo of the day / leaderboard** | Curated quality content. Great for marketing |
| **Weather integration** (visibility forecast) | Pull NOAA data, "likely visible this afternoon" predictions. Crosses into real utility |
| **Astronomical events** | "Lunar eclipse tonight — best viewpoints for Mt Rainier" |
| **Trip planning** | Save a sequence of viewpoints for a road trip; check live conditions for each |

## Tier 5 — Infrastructure & operations

Quiet but important. Build when friction shows up.

| Feature | Trigger |
|---|---|
| **Custom domain** (e.g. `peakaboo.app`) | Unblocks real OAuth consent screen, professional sender for Resend. ~$15/yr |
| **Supabase Pro** ($25/mo) | When exceeding free tier (500 MB DB, 1 GB storage, 5 GB egress), or for custom SMTP/auth domain |
| **Resend** for transactional email | Once you have a domain. Replaces Supabase's spam-prone email pool |
| **Real privacy policy** | Current one is a friendly stopgap. Termly, iubenda, or a startup lawyer before publishing OAuth app or scaling |
| **Terms of Service** | Required for App Store + production OAuth verification |
| **Google OAuth verification** | Removes "unverified app" warning. Free, 1-6 weeks, needs real privacy policy + domain |
| **Rate limiting per user** | When the first abusive actor floods the DB. Postgres trigger limiting writes/min |
| **Automated backups** | Supabase Pro has daily backups; free tier doesn't. Worth upgrading before data is irreplaceable |
| **Logging / error tracking** | Sentry free tier (5K events/month). ~30 min to wire |
| **Analytics** | Plausible or Vercel Analytics so you actually know what users do |

## Tier 6 — Speculative

Don't think about these unless PeakAboo has product-market fit.

- Multi-region expansion (Cascades → PCT → Sierras → Alps → Patagonia)
- API access for weather services, hiking apps, news sites
- Premium tier (custom subjects, photo limits, priority support, early peaks)
- AR overlay ("hold up your phone, see which peak you're looking at")
- Time-lapse view of any viewpoint (stitch a year of sightings into a "how often is the mountain out from here?" animation)
- Print/PDF export of a year's sightings as a personal travelogue
- Weather company partnership for legitimate forecasting

---

## How to use this list

**Don't build top-to-bottom.** Build by signal. Even Tier 1 should
re-rank after real users give feedback. Ship → listen → re-rank → build.

The single highest-value thing post-LinkedIn-launch: **set up Sentry**
(Tier 5, error tracking). Free, 30 min, you'll find out about every
JS crash real users hit before they tell you. Best ratio of
"early feedback caught" to "effort spent" in this list.
