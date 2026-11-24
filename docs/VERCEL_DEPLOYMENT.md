# Vercel deployment

Connect the GitHub `main` branch, set the root to this repository, choose Node.js 22, and add every variable from `.env.local` to the Vercel Production environment. Use `https://opsora.cubixtop.com` for both application URL variables. Keep service-role, administrator, VAPID private, cron and encryption values server-only; never prefix them with `NEXT_PUBLIC_`. Apply every pending Supabase migration before deployment, then run `npm run validate:env` and the production build. Deployment remains manual.
