# Production readiness

Required before launch: apply migrations to the selected Supabase project; set real secrets; bootstrap the administrator; configure Resend/SMTP and VAPID; verify private uploads on real devices; exercise tenant isolation and lifecycle permissions; run `npm run typecheck`, `npm run lint`, and `npm run build`; confirm backups and custom-domain TLS. No staging, SIT or UAT environment is used.
