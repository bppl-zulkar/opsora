import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { loadEnvConfig } from "@next/env";

async function main() {
  loadEnvConfig(process.cwd());
  const env = z
    .object({
      NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
      SUPABASE_SERVICE_ROLE_KEY: z.string().min(10),
      INITIAL_SUPER_ADMIN_NAME: z.string().min(2),
      INITIAL_SUPER_ADMIN_EMAIL: z.string().email(),
      INITIAL_SUPER_ADMIN_PASSWORD: z.string().min(12),
      INITIAL_SUPER_ADMIN_FORCE_PASSWORD_CHANGE: z.string().default("false"),
    })
    .parse(process.env);
  const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const listed = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (listed.error) throw listed.error;
  let user = listed.data.users.find(
    (u) =>
      u.email?.toLowerCase() === env.INITIAL_SUPER_ADMIN_EMAIL.toLowerCase(),
  );
  if (!user) {
    const created = await supabase.auth.admin.createUser({
      email: env.INITIAL_SUPER_ADMIN_EMAIL,
      password: env.INITIAL_SUPER_ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: env.INITIAL_SUPER_ADMIN_NAME },
    });
    if (created.error) throw created.error;
    user = created.data.user;
    console.log("Created Supabase Auth administrator.");
  } else {
    const updated = await supabase.auth.admin.updateUserById(user.id, {
      password: env.INITIAL_SUPER_ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: env.INITIAL_SUPER_ADMIN_NAME },
    });
    if (updated.error) throw updated.error;
    user = updated.data.user;
    console.log("Administrator password synchronized from .env.local.");
  }
  const { error } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      full_name: env.INITIAL_SUPER_ADMIN_NAME,
      email: env.INITIAL_SUPER_ADMIN_EMAIL,
      employee_id: "PLATFORM-ADMIN",
      account_status: "active",
      is_platform_admin: true,
      force_password_change:
        env.INITIAL_SUPER_ADMIN_FORCE_PASSWORD_CHANGE === "true",
    },
    { onConflict: "id" },
  );
  if (error) throw error;
  console.log("Platform administrator profile is ready.");
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Administrator bootstrap failed",
  );
  process.exit(1);
});
