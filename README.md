# Opsora

Opsora is a multi-company operations platform for assigning, executing, verifying and tracking accountable work.

## Local start

1. Install Node.js 22 LTS, Docker Desktop and the Supabase CLI dependencies.
2. Copy `.env.example` to `.env.local` and fill the Supabase values.
3. Run `npx supabase start`, then `npx supabase db reset`.
4. Run `npm run bootstrap:admin`.
5. Run `npm run dev` and open `http://localhost:3000`.

Use `npm run typecheck`, `npm run lint`, and `npm run build` before production. Deployment is intentionally manual.

## Security model

Authoritative timestamps are `timestamptz`; tenant isolation is enforced with RLS; task references and lifecycle transitions are transactional database operations; evidence and reports use private storage buckets. Service-role credentials are server-only.

Opsora — Assign. Execute. Verify. Track.
