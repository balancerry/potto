# Potto backend

Supabase project: Postgres schema, RLS policies, and RPCs.

```
backend/
└── supabase/
    └── migrations/
```

## Apply migrations

From this directory (with [Supabase CLI](https://supabase.com/docs/guides/cli) installed and linked):

```bash
supabase db push
```

Or apply SQL files in order from the Supabase dashboard SQL editor.

## Tests

SQL tests live in `supabase/tests/`. Run them against a **scratch** database that has the migrations applied (never a real project) and Supabase-style `anon` / `authenticated` roles, `auth.users` and `auth.uid()`:

```bash
psql "$SCRATCH_DB_URL" -v ON_ERROR_STOP=1 -f backend/supabase/tests/pot_categories.test.sql
psql "$SCRATCH_DB_URL" -v ON_ERROR_STOP=1 -f backend/supabase/tests/pot_public_share.test.sql
```

Each runs in one transaction that is rolled back; the final `NOTICE ... all assertions passed` means success.

## Layout

| Path | Purpose |
|------|---------|
| `supabase/migrations/` | Ordered schema + RLS + RPC migrations |
