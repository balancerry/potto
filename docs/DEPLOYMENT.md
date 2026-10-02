# Deployment

## Vercel

1. Create a Vercel project from this GitHub repo.
2. Set **Root Directory** to `web`.
3. Framework preset: Next.js.
4. Environment variables:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SITE_URL=https://YOUR_VERCEL_DOMAIN
```

Optional, only to let the installed mobile app open public pot links (see [PUBLIC_SHARING.md](PUBLIC_SHARING.md#deep-links-app-installed--app-otherwise--web)):

```
APPLE_APP_ID=<TeamID>.<bundle id>
ANDROID_PACKAGE=
ANDROID_SHA256_CERT_FINGERPRINTS=AA:BB:…,CC:DD:…
```

`NEXT_PUBLIC_SITE_URL` is also the origin of the public links people copy and share (`<origin>/pot/<token>`); mobile uses `EXPO_PUBLIC_SITE_URL` and falls back to `https://www.trypotto.in`.

5. Deploy.

## Supabase production checklist

- [ ] Schema applied (`0008_complete_schema`, `0009_rpcs`) — already applied to the linked project
- [ ] `0019_public_pot_sharing` applied **before** deploying the web/mobile builds that include public sharing (the Share buttons and `/pot/<token>` call its RPCs)
- [ ] Auth → Email magic link enabled
- [ ] Site URL = production URL
- [ ] Redirect allow-list includes `https://YOUR_DOMAIN/auth/callback`
- [ ] Confirm email templates send the magic link (default is fine)

## Local production smoke test

```bash
cd web
npm run build
npm run start
```

## Security notes

- Only the anon key is used in the browser.
- RLS enabled on all app tables.
- Join/invite resolution uses security-definer RPCs that return safe summary fields only.
- Middleware gates unauthenticated access to app routes. The only signed-out exceptions are the auth pages, the public viewer `/pot/<token>` and `/.well-known/*`.
- Public pot sharing is off for every pot until an owner/admin enables it; the anonymous API surface is the single RPC `get_public_pot` (allow-listed, id-free payload). Details and assumptions: [PUBLIC_SHARING.md](PUBLIC_SHARING.md).
- `/pot/*` is served `Cache-Control: private, no-store`, `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex, nofollow`.
