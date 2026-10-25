# Harvest Rentals

Farmers search for harvesting machines by village + crop and call owners directly. Owners list machines with a simple form. No login, no payments, no notifications. React + Vite + TypeScript + Supabase.

## Setup

1. Create a Supabase project.
2. Run `supabase/migrations/001_init.sql` in the SQL editor (or `supabase db push`). This creates the tables, Row Level Security, and the `machine-photos` storage bucket (JPEG/PNG/WebP, 3 MB, public read).
3. Deploy the Edge Function (it needs no secrets you set yourself; Supabase injects the service-role key):
   ```
   supabase link --project-ref YOUR-REF
   supabase functions deploy submit-machine --no-verify-jwt
   supabase secrets set RATE_SALT=any-random-string   # optional, salts the IP hash
   ```
   `--no-verify-jwt` is deliberate: visitors have no login. The function validates, rate-limits and does the writes.
4. `cp .env.example .env` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (the public anon key only).
5. `npm install`, then `npm run dev`, `npm test`, `npm run build`.

## How security works

- The browser can only **read active machines**, **insert a report**, and call the `submit-machine` function. RLS blocks all public inserts, updates and deletes on `machines`.
- The service-role key lives only inside the Edge Function.
- The function re-validates every field, checks image magic bytes (not just the declared type), caps size at 3 MB, names files with random UUIDs (no overwriting), limits 5 submissions/hour per hashed IP and 300/hour overall, and deletes the photo if the database insert fails.
- Search matches on `village_keys`, a column a database trigger fills with the normalized owner village + service villages.

## Limitations (an unauthenticated marketplace)

- **Owners are not verified.** Anyone can list any phone number. The UI says so; nothing is labelled "verified".
- Owners cannot edit or delete their own listings (no accounts). To remove a listing, set `is_active = false` in the Supabase table editor.
- "Report wrong listing" writes to the `reports` table; review it in the Supabase dashboard. Reports are not rate-limited, so they are a signal, not proof.
- IP rate limiting can be bypassed by determined attackers and can block people sharing one network. Photo URLs are public to anyone who has the link, even for inactive listings.
- Estimates are shown only for per-acre pricing, and are labelled as estimates.
- Village matching is exact after normalization (case and spaces). Spelling variants such as "Hosur" vs "Hosuru" will not match; owners can list variants under "other villages".

## Not included (by design)

Accounts, OTP, dashboards, payments, notifications, GPS, maps, reviews. There is no ESLint config; `npm run typecheck` is the static check.

## Version 2 upgrade (run these once)

1. SQL editor: run `supabase/migrations/002_upgrade.sql`.
2. Re-deploy the Edge Function: replace the code of `submit-machine` with `supabase/functions/submit-machine/index.ts`. It now also handles owner remove/busy (phone + 4-digit PIN).
3. Optional demo data: `supabase/seed_demo.sql`. **The phone numbers in it are placeholders and "Call Owner" will dial them. Replace them before demoing.**

New in v2: voice input for farmers (browser speech recognition; English/Kannada/Hindi, may not work on every phone), "needed by" date, owners' "busy until" date, district fallback, close-spelling village matching, "Manage my listing" (PIN), photo-preview memory fix.

Limits: a 4-digit PIN is weak by design; it is protected only by rate limits (10 tries/hour per IP and per phone). Anyone who knows an owner's phone and PIN controls that listing. Spoken Kannada number words ("ಮೂರು") are not parsed; only digits are.
