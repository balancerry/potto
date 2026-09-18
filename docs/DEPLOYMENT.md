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

5. Deploy.

## Supabase production checklist

- [ ] Schema applied (`0008_complete_schema`, `0009_rpcs`) — already applied to the linked project
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
- Middleware gates unauthenticated access to app routes.
