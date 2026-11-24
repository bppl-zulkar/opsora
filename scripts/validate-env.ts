import { z } from "zod";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());
const required = z.object({
  NEXT_PUBLIC_APP_NAME: z.string().min(2),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  APP_PRODUCTION_URL: z.string().url(),
  APP_TIMEZONE: z.string().min(3),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(10),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(10),
  INITIAL_SUPER_ADMIN_NAME: z.string().min(2),
  INITIAL_SUPER_ADMIN_EMAIL: z.string().email(),
  INITIAL_SUPER_ADMIN_PASSWORD: z.string().min(12),
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().min(80),
  VAPID_PRIVATE_KEY: z.string().min(40),
  VAPID_SUBJECT: z.union([z.string().url(), z.string().startsWith("mailto:")]),
  CRON_SECRET: z.string().min(32),
  APP_ENCRYPTION_KEY: z.string().min(32),
});
const result = required.safeParse(process.env);
if (!result.success) {
  console.error(
    "Environment configuration is incomplete:",
    result.error.issues.map((i) => i.path.join(".")).join(", "),
  );
  process.exit(1);
}
if (process.env.NODE_ENV === "production") {
  const publicUrl = new URL(result.data.NEXT_PUBLIC_APP_URL);
  if (publicUrl.protocol !== "https:") {
    console.error("NEXT_PUBLIC_APP_URL must use HTTPS in production.");
    process.exit(1);
  }
}
console.log("Required production environment variables are valid.");
