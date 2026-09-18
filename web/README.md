# Potto Web

Production web client for Potto (Trip Wallet) — same product as the Expo React Native app, backed by Supabase.

## Stack

- **Next.js 16** (App Router) + TypeScript
- **Tailwind CSS 4** + Potto design tokens
- **Supabase** Auth (magic link), Postgres, RLS
- Shared business logic from `src/lib/core/` (ported from mobile `src/logic/`)

## Setup

```bash
cd web
cp .env.example .env.local
# Fill NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment variables

| Variable | Where | Description |
|----------|-------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + server | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + server | Anon/public key only |
| `NEXT_PUBLIC_SITE_URL` | Server | Canonical origin for magic-link + invite URLs |

Never put the **service role** key in this app.

### Supabase Auth (magic link)

In the Supabase dashboard → Authentication → URL configuration:

1. **Site URL:** `http://localhost:3000` (dev) or your Vercel URL (prod)
2. **Redirect URLs:**  
   - `http://localhost:3000/auth/callback`  
   - `https://YOUR_DOMAIN/auth/callback`

Enable **Email** provider with magic link / OTP (no password required).

### Database

Migrations live in `backend/supabase/migrations/`:

- `backend/supabase/migrations/0008_complete_schema.sql` — tables, RLS, helpers
- `backend/supabase/migrations/0009_rpcs.sql` — `create_pot`, join approval, commitments

Earlier `0001`–`0007` are reference specs from the mobile MVP; **0008/0009** are the applied production schema.

## Scripts

```bash
npm run dev      # local
npm run build    # production build
npm run start    # serve build
npm run lint     # eslint
```

## Architecture

```
web/src/
  app/                 # routes (login, (app)/*)
  components/          # ui + pot forms
  lib/
    core/              # shared types, money, accounting, permissions…
    actions/           # server actions (mutations)
    queries/           # server reads
    supabase/          # browser + server clients
  middleware.ts        # session + auth gate
```

Roles (`admin` / `member` + `access_level`) match mobile. Sensitive writes are enforced by **RLS and security-definer RPCs**, not UI alone.

## Deploy (Vercel)

1. Import the repo; set **Root Directory** to `web`
2. Add the three env vars above (use production Site URL)
3. Add the production callback URL in Supabase Auth
4. Deploy

## Docs

See also:

- [`../docs/AUDIT.md`](../docs/AUDIT.md) — mobile audit
- [`../docs/FEATURE_INVENTORY.md`](../docs/FEATURE_INVENTORY.md)
- [`../docs/DATA_MODEL.md`](../docs/DATA_MODEL.md)
- [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md)
- [`../docs/PARITY.md`](../docs/PARITY.md)
- [`../docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md)
