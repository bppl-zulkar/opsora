# Development progress

Updated: 24 Nov 2026

## Implemented foundation

- Next.js App Router, strict TypeScript, Bootstrap/Sass Velzon-inspired responsive shell.
- Supabase SSR authentication middleware and invitation-only login.
- Multi-tenant core schema, private storage, RLS, concurrency-safe references, task lifecycle RPC.
- Live dashboard, task list, creation, detail, status timeline, comments and in-app notifications.
- Idempotent super-admin bootstrap, VAPID generator, environment validator, PWA manifest/service worker.
- Security headers, health endpoint, Git exclusions and local/production configuration template.
- Fixed the PostgreSQL task foreign-key syntax that blocked the initial migration.
- Password recovery, Auth callback, forced password change and session-safe password updates.
- Platform organization provisioning with service-role operations gated by platform-admin verification.
- Admin-managed SMTP configuration with AES-256-GCM credential encryption and real test delivery.
- Private evidence upload with MIME/size validation, SHA-256 checksum, metadata records and signed 15-minute viewing links.
- Unified `/admin/configuration` for Resend, SMTP and Web Push; Resend API keys, SMTP passwords and VAPID private keys are encrypted at rest.
- Super Admin credentials synchronized and independently verified through Supabase Auth; initial Opsora organization and Company Admin membership provisioned.
- Super Admin bootstrap now always synchronizes the password from `.env.local` and disables forced password change by default; email/SMTP provider options were removed from environment files in favor of Admin Configuration.
- Working administration CRUD for Supabase Auth users/profiles/memberships/roles and departments, including edit, deactivate, dependency-aware deletion and duplicate prevention.
- Consolidated duplicate email settings into one Email & Push Configuration module; legacy `/admin/email` redirects to `/admin/configuration`.

## Remaining production modules

Employee invitations and bulk import; full permission editor; background email/push queue workers; extension/approval UI; recurring tasks; manual logs; all 50 specialized report layouts; remaining administration CRUD; browser/device verification. A complete production master prompt implementation remains substantially larger than this verified slice.

## Verification

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run build`: passed after the latest changes using `.env.local`.
- `npm run validate:env`: passed after standalone scripts were updated to load `.env.local` through Next.js.
- Admin CRUD live verification: department create/edit/delete passed; Auth user/profile/membership create/edit/login/delete passed; communication configuration create/edit passed; temporary records were removed.
- Organization branding is operational for company name, website, colors, theme and seven private logo/icon variants; private upload/download/delete verification passed.
- Authenticated shell and login consume live branding; dynamic favicon/PWA asset delivery and responsive mobile sidebar/bottom navigation were added.
- Governance modules implemented: custom/system roles with grouped permission matrix and safe deletion, SLA policies with response/resolution targets and task linkage, and filtered append-only audit review.
- Live governance verification passed for role permission assignment, SLA-to-task linkage and audit record persistence; temporary role/SLA/task records were removed.
- Seeded the supplied organization chart: 10 named departments, 16 designations, 16 employee Auth/profile accounts, reporting managers and department heads; no “Head Office” data was stored.
- Completed five authenticated task workflows across departments from assignment through acknowledgement, acceptance, work start, verification submission and closure, producing 30 status-history events.
- Replaced the calendar placeholder with a live Supabase month calendar, deadline cards, status/employee filters, month navigation, task links, overdue styling and a responsive mobile agenda.
- Fixed employee listing by selecting explicit department/designation foreign keys; verified 17 visible profiles, including all 16 seeded employees with their departments and designations.
- Removed all “Module foundation ready” content. Added database-backed filtered task views, Kanban board and task activity timeline; legacy incomplete URLs redirect to completed modules.
- Updated organization-facing terminology from Employee to Company User and Company Admin while preserving stable database field/system keys; live standard and administrator roles were renamed and verified.
- Redesigned the shared UI with an original Hrivo-inspired visual system: Inter typography, coral/lavender palette, premium dark sidebar, compact mode, theme toggle, responsive navigation, loading states, reduced-motion accessibility and optimized component transitions.
- Standardized product branding as Opsora and separated the fixed product identity from each organization’s companion company logo.
- Registered the service worker and added safe static-asset caching plus a dedicated offline page without caching confidential server data.
- Rebuilt task reporting with live RLS-scoped Supabase data and filters for date field/range, creator, assignee, department, status and priority. Added downloadable PDF, Excel and CSV report formats with IST timestamps.
- Added individual task PDF and Excel reports from both Reports and Task Detail pages. Individual reports include full task metadata, lifecycle history, evidence metadata, comments and all workflow timestamps; Excel separates these into organized, filterable sheets.
- Report download APIs require an authenticated user, inherit task RLS visibility, return private/no-store responses and protect CSV/Excel cells against formula injection.
- Replaced the former product identity with the supplied Opsora artwork, including PWA metadata, offline/loading states, notifications, reports and email copy. The fixed Opsora logo now remains visible beside the independently uploaded company logo, with a contrast-safe treatment for light and dark themes.
- Added first-open PWA device-access onboarding for notifications, precise location and camera, including live permission status, retry guidance and safe camera-stream cleanup. Photo/gallery and file access remains browser-managed and is requested when a user selects evidence, as required by browser security.
- Updated the connected active organization display name and email sender name to Opsora without changing its stable database identifiers or administrator login credentials.
- Added a responsive account dropdown in the top bar with profile viewing, profile editing, notifications and authenticated logout. Added the `/profile` module with organization, designation, reporting manager and account details.
- Login now accepts either email address or a unique active employee ID. Reset and authenticated all 16 seeded demonstration employee accounts with controlled test credentials; the Super Admin credential was not changed.
- Added an organization-aware email/Web Push dispatcher for task assignment, comments and every lifecycle transition. Delivery respects individual notification preferences and supports Resend or SMTP plus expired-subscription cleanup.
- Added authenticated Web Push configuration/subscription endpoints, a private per-user subscription migration and a PWA notification vibration pattern. Migration `202611240009_push_subscriptions.sql` still requires application to the connected Supabase database before push subscriptions can persist.
- Modernized task report PDFs with a dark branded header, visual summary cards, clearer hierarchy and overdue/completion indicators while preserving the existing live report data and filters.
- Restricted Company User task visibility to records they created or that are assigned to them, including their completed/closed records. Applied the same scope to dashboard cards, task list/detail, board, calendar, activity timeline, report previews and PDF/Excel/CSV download APIs.
- Administration navigation is now role-aware and hidden from Company Users; `/admin` itself now enforces Company Admin or Platform Admin authorization instead of relying on menu visibility.
- Added migration `202611240010_task_visibility.sql` to enforce the same task-participant boundary through Supabase RLS and related task tables. Application-level scope is active immediately; the migration awaits execution on the connected database.
- Authenticated verification as EMP001 returned one owned/assigned closed task and zero unauthorized task rows.
- Replaced the unrestricted task-status dropdown with forward-only, current-state actions: Acknowledge, Start WIP, Mark Completed, Put On Hold/Resume and Approve & Close. Completed stages disappear permanently, server actions reject stale or manually altered transitions, and On Hold can be used only once per task.
- Standardized user-facing status labels across task detail, lists, dashboard, calendar, activity log and reports; internal `accepted`/`in_progress` states display as WIP and verification/closed states display as Completed. The board now uses organized Assigned, Acknowledged, WIP, On Hold and Completed columns.
- Refined bulk and individual task PDFs into clean tabular layouts with branded page headers, summary metrics, repeated column headings, alternating rows, bordered detail records, continuation-page headers and consistent Helvetica typography while preserving existing report data.
- Added final cross-device layout and contrast safeguards for mobile/tablet/desktop top bars, sidebars, account menus, panels, forms, tables, Kanban scrolling, safe-area bottom navigation, dark-theme surfaces and accessible focus states.
- Enabled Web Push in the connected Admin Configuration with newly generated VAPID credentials encrypted at rest. Fixed public-key retrieval for authenticated Company Users and added migration-independent per-device subscription persistence in profile notification preferences (up to eight devices per user).
- Updated the service worker notification channel request with explicit non-silent delivery, vibration pattern, badge, replacement tag and click-through behavior. Actual audible sound remains controlled by browser/OS notification settings and cannot be forced by web standards.
- Replaced direct-client evidence metadata insertion with an authenticated, participant-authorized signed upload workflow. Evidence remarks are compulsory, file/type/size/path/checksum inputs are validated server-side, metadata is written with trusted actor/organization IDs, and orphaned objects are removed on failure.
- Made discussion notes compulsory for every lifecycle work update and standalone task discussion entry. The note is stored in status history, included in external notifications, and protected by server-side length/current-state validation.
- Live evidence verification passed against the connected private bucket: signed upload, attachment metadata insertion, exact remarks read-back and cleanup all succeeded; the temporary test row and object were removed.
- Restricted first-open permission onboarding to Android phones/tablets and iPhone/iPad (including iPadOS desktop-identification mode). Conventional Windows, macOS and Linux computers no longer receive device-permission prompts.
- Added authenticated post-login push-subscription synchronization so permissions granted before authentication are reliably registered afterward, plus safe handling for browsers/iOS versions without Web Push support.
- Completed the production environment values for application URLs, VAPID, cron and encryption, synchronized the encrypted VAPID configuration, and expanded `validate:env` to reject incomplete Vercel production settings.
- Reworked individual task reports using the supplied inspection report as a visual reference: branded status header, three-column outcome summary, structured field/value tables, lifecycle and discussion sections, converted/embedded evidence photographs, final sign-off and consistent page footers. Verified a real 249 KB report with one private evidence photo embedded.
- Reworked task lifecycle email HTML using the supplied workflow email as a visual reference: responsive status header, task detail table, latest discussion, workflow timeline, CID evidence thumbnails, PDF attachment notice and primary task action. Resend and SMTP both receive inline-photo and PDF attachments.
- Added loader-controlled report download buttons for PDF, Excel and CSV. Downloads now hold the global interaction lock until the file is actually ready, while the full-screen wait state includes an animated top progress bar to prevent duplicate clicks and user confusion.
- Added organized evidence thumbnails and mobile-safe file rows to task detail. Existing server-action forms and uploads use the shared interaction lock, disabled fieldsets, button spinners and lightweight transitions.
- Fixed administrator company-user deletion with a confirmed, audited soft-delete workflow: authentication is revoked, organization membership/roles/permission overrides are removed, active reporting relationships are cleared, deleted accounts disappear from administration, and historical task authorship remains intact. Live disposable-account verification passed and its test data was removed.
- `npm audit --omit=dev`: two moderate findings from ExcelJS's transitive `uuid` dependency. The automated remedy is a breaking ExcelJS downgrade and was not forced.
- Supabase migration execution: blocked locally because Docker/Podman is not installed. The reported SQL syntax error is corrected, but clean database application is not claimed.
- SMTP delivery: not tested because the migrations and persisted organization configuration are not yet available locally.
- Secret hygiene: user-supplied values were moved from commit-eligible `.env.example` to ignored `.env.local`; rotate the exposed service-role key and initial administrator password before production.
