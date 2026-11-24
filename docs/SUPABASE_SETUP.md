# Supabase setup

Create a Supabase project, apply every file in `supabase/migrations` in order, and copy the project URL, publishable key and service-role key to Vercel. Disable public registration. Keep `task-evidence` and `generated-reports` private. Configure the approved production site URL and add `/auth/callback` to allowed redirects.

Apply migrations `202611240001`, `202611240002`, and `202611240003` in filename order. The first migration's named task foreign keys use PostgreSQL's required `CONSTRAINT name REFERENCES table` ordering.
