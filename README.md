# PeakAboo

Spot Mt Rainier, Mt Adams, and other landmarks. Log whether you can see the peak today, the conditions, a visibility rating (0–10), and photos. iOS, Android, and Web from one codebase.

## Stack

- **Expo SDK 56** + React Native + React Native Web (TypeScript)
- **react-native-maps** on iOS / Android, **@vis.gl/react-google-maps** on Web — wrapped behind a single `<MapView>` component (`src/components/MapView.tsx` + `MapView.web.tsx`)
- **expo-location**, **expo-image-picker**
- **Supabase** (Postgres + auth + storage) — to be wired in next

## Run it locally

Prerequisites: Node 20+, the Expo Go app on your phone (for device preview), and a Google Maps API key (already provisioned, see `.env.example`).

```sh
npm install
cp .env.example .env   # then paste your keys into .env
npm run web            # web preview
npm run ios            # iOS simulator (Mac)
npm run android        # Android emulator
npm run start          # device via Expo Go (QR code)
```

## Configuring secrets

`.env` is gitignored. Required keys:

```
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=AIza...
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

`app.config.ts` reads `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` and injects it into the native iOS/Android map config at build time. The same variable is read by the web bundle for `@vis.gl/react-google-maps`.

### Restricting the Google Maps key for production

For dev the key has no application restrictions. Before shipping:

- Android: Application restriction → Android apps → bundle `com.batspock.peakaboo` + your release SHA-1
- iOS: Application restriction → iOS apps → bundle `com.batspock.peakaboo`
- Web: Application restriction → HTTP referrers → your deployed origin

Or use three separate keys, one per platform, and set them in `.env` accordingly.

## Project layout

```
App.tsx                       # search bar + subject pills + map
app.config.ts                 # Expo config (reads .env, injects Maps key)
src/
  components/MapView.tsx      # native map
  components/MapView.web.tsx  # web map (auto-resolved by Metro for web)
  data/subjects.ts            # seeded subjects (Mt Rainier, Mt Adams) + viewpoints
```

## Roadmap

- [x] Map with seeded subjects + viewpoints (Rainier, Adams)
- [ ] Supabase schema: `subjects`, `viewpoints`, `sightings`, `viewpoint_ratings`
- [ ] Google Sign-In via Supabase OIDC
- [ ] Viewpoint detail screen — sighting feed, "is it visible today?" pill
- [ ] Add sighting flow — yes/no, conditions, 0–10 rating, multi-image upload
- [ ] Add viewpoint flow — current location / map pin / coordinates
- [ ] Offline queue + sync
- [ ] Vercel deploy for web + EAS for mobile
```
