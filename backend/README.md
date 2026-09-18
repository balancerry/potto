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

## Layout

| Path | Purpose |
|------|---------|
| `supabase/migrations/` | Ordered schema + RLS + RPC migrations |
