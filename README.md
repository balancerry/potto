# Potto

Shared money for trips, events, and group funds.

```
potto/
├── mobile/     # Expo React Native app
├── web/        # Next.js web app
├── backend/    # Supabase (migrations, schema, RPCs)
└── docs/       # Shared documentation
```

## Quick start — Web

```bash
cd web
cp .env.example .env.local   # add Supabase URL + anon key
npm install
npm run dev
```

See [`web/README.md`](web/README.md) and [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Quick start — Mobile

```bash
cd mobile
npm install
npx expo start
```

The mobile app currently uses an in-memory store with seed data. The same Supabase backend is designed for both clients.

## Backend (Supabase)

Migrations live in [`backend/supabase/migrations/`](backend/supabase/migrations/).

```bash
cd backend
# with Supabase CLI linked to your project:
supabase db push
```

## Documentation

- [Mobile audit](docs/AUDIT.md)
- [Feature inventory](docs/FEATURE_INVENTORY.md)
- [Data model](docs/DATA_MODEL.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Feature parity](docs/PARITY.md)
- [Deployment](docs/DEPLOYMENT.md)
