# Local setup

```powershell
Copy-Item .env.example .env.local
npm install
npx supabase start
npx supabase db reset
npm run bootstrap:admin
npm run dev
```

Never commit `.env.local`. The Super Admin password must contain at least 12 characters. Each bootstrap run intentionally synchronizes that account password from `.env.local`; organization administrator passwords are never shared or reset by this command.
