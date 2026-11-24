# Security

RLS is the primary tenant boundary. Browser code uses only the publishable key. Privileged bootstrap and workers use the service-role key on the server. Confidential tasks are restricted to participants/watchers. Do not log passwords, keys, tokens or SMTP credentials. Review migration policies whenever adding a table.

Organization SMTP passwords are encrypted with AES-256-GCM before database storage. `APP_ENCRYPTION_KEY` is the server-only root key and must be a random value of at least 32 characters. SMTP secrets are entered at `/admin/email`, are never displayed again, and are never sent back to browser code.
