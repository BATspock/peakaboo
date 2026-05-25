# Google Sign-In setup

PeakAboo uses Supabase Auth with the Google OAuth provider. The mobile/web app
calls `supabase.auth.signInWithOAuth({ provider: "google" })` — Supabase handles
the OIDC dance, we only need to register an OAuth client with Google and tell
Supabase about it.

## One-time setup (~10 min)

### 1. Google Cloud — OAuth consent screen

1. https://console.cloud.google.com/ → make sure project **peakaboo** is selected
2. **APIs & Services → OAuth consent screen**
3. **User Type: External** → Create
4. App name: `PeakAboo`, support email: yours, developer contact email: yours → Save
5. Scopes: skip (defaults are fine — Supabase asks for `openid email profile`)
6. Test users: **Add Users** → add your own Google email and any teammates
   (until the app is "Published" only test users can sign in)

### 2. Google Cloud — OAuth client ID

1. **APIs & Services → Credentials → + Create Credentials → OAuth client ID**
2. Application type: **Web application**
3. Name: `PeakAboo Web (Supabase)`
4. **Authorized redirect URIs** → Add URI:
   ```
   https://zwjhrkzqkrdhwmlutijt.supabase.co/auth/v1/callback
   ```
   (This is your Supabase project's callback URL — same value goes in Supabase below.)
5. Create → copy the **Client ID** and **Client secret** that appear.

### 3. Supabase — turn on Google provider

1. https://supabase.com/dashboard/project/zwjhrkzqkrdhwmlutijt
2. **Authentication → Providers → Google** → toggle Enabled
3. Paste the **Client ID** and **Client secret** from Google
4. Leave "Skip nonce check" off
5. Save

That's it. Try the **Sign in** button in the app at http://localhost:8081 —
it should redirect to Google, you authorize, and you land back signed in.

## Mobile (Expo Go) notes

The native flow uses `expo-auth-session` with the `peakaboo://` deep-link scheme
already configured in `app.config.ts`. No extra Google Cloud setup is needed
for **dev** in Expo Go — the same Web OAuth client works because we redirect
through Supabase's hosted callback, which then deep-links the tokens back to
the app.

When we ship standalone builds via EAS we'll add platform-specific OAuth
clients (one for iOS bundle `com.batspock.peakaboo`, one for the Android
package + SHA-1) and switch to `@react-native-google-signin/google-signin` for
the polished native sheet. That work is deferred until launch.

## Troubleshooting

- **"redirect_uri_mismatch"** — the URI in step 2.4 doesn't match exactly.
  Recheck for trailing slashes and `https://`.
- **"This app isn't verified"** — expected while in Testing mode. Click
  Advanced → "Go to PeakAboo (unsafe)". Verification is only needed before
  external launch.
- **"requested path is invalid"** in Supabase callback — the Client ID/Secret
  in Supabase doesn't match what's in Google Cloud. Re-paste.
