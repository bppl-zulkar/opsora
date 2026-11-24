import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

loadEnvConfig(process.cwd());

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  const { data: organization, error: organizationError } = await admin
    .from("organizations")
    .select("id")
    .eq("active", true)
    .order("created_at")
    .limit(1)
    .single();
  if (organizationError) throw organizationError;
  const users = await admin.auth.admin.listUsers({ perPage: 1000 });
  const administrator = users.data.users.find(
    (user) => user.email === process.env.INITIAL_SUPER_ADMIN_EMAIL,
  );
  if (!administrator) throw new Error("Super administrator not found");
  const stamp = Date.now();
  const email = `crud-check-${stamp}@example.invalid`;
  const password = `Opsora!${randomBytes(12).toString("hex")}`;
  let departmentId: string | undefined;
  let userId: string | undefined;
  try {
    const department = await admin
      .from("departments")
      .insert({
        organization_id: organization.id,
        name: "CRUD Verification",
        code: `CV${String(stamp).slice(-8)}`,
        active: true,
      })
      .select("id")
      .single();
    if (department.error) throw department.error;
    departmentId = department.data.id;
    const departmentUpdate = await admin
      .from("departments")
      .update({
        name: "CRUD Verification Updated",
        office_location: "Verification Office",
      })
      .eq("id", departmentId)
      .select("name")
      .single();
    if (
      departmentUpdate.error ||
      departmentUpdate.data.name !== "CRUD Verification Updated"
    )
      throw departmentUpdate.error ?? new Error("Department update failed");

    const auth = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: "CRUD Test Employee" },
    });
    if (auth.error) throw auth.error;
    userId = auth.data.user.id;
    const profile = await admin
      .from("profiles")
      .insert({
        id: userId,
        organization_id: organization.id,
        employee_id: `TEST-${String(stamp).slice(-7)}`,
        full_name: "CRUD Test Employee",
        email,
        department_id: departmentId,
        account_status: "active",
        force_password_change: false,
      })
      .select("id")
      .single();
    if (profile.error) throw profile.error;
    const membership = await admin
      .from("organization_memberships")
      .insert({
        organization_id: organization.id,
        user_id: userId,
        active: true,
      });
    if (membership.error) throw membership.error;
    const profileUpdate = await admin
      .from("profiles")
      .update({
        full_name: "CRUD Test Employee Updated",
        mobile: "+910000000000",
      })
      .eq("id", userId)
      .select("full_name")
      .single();
    if (
      profileUpdate.error ||
      profileUpdate.data.full_name !== "CRUD Test Employee Updated"
    )
      throw profileUpdate.error ?? new Error("Profile update failed");
    const browser = createClient(
      url,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false } },
    );
    const login = await browser.auth.signInWithPassword({ email, password });
    if (login.error) throw login.error;
    await browser.auth.signOut();

    const communication = await admin
      .from("organization_communication_settings")
      .upsert(
        {
          organization_id: organization.id,
          email_provider: "resend",
          email_from_name: "Opsora CRUD Check",
          email_enabled: false,
          web_push_enabled: false,
          vapid_subject: "mailto:admin@example.com",
          updated_by: administrator.id,
        },
        { onConflict: "organization_id" },
      )
      .select("id")
      .single();
    if (communication.error) throw communication.error;
    const communicationUpdate = await admin
      .from("organization_communication_settings")
      .update({ email_from_name: "Opsora" })
      .eq("id", communication.data.id)
      .select("email_from_name")
      .single();
    if (
      communicationUpdate.error ||
      communicationUpdate.data.email_from_name !== "Opsora"
    )
      throw (
        communicationUpdate.error ?? new Error("Communication update failed")
      );

    console.log("PASS department create/edit");
    console.log("PASS user Auth/profile/membership create/edit/login");
    console.log("PASS communication configuration create/edit");
  } finally {
    if (userId) {
      const removed = await admin.auth.admin.deleteUser(userId);
      if (removed.error) throw removed.error;
    }
    if (departmentId) {
      const removed = await admin
        .from("departments")
        .delete()
        .eq("id", departmentId);
      if (removed.error) throw removed.error;
    }
  }
  console.log("PASS user and department deletion cleanup");
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "CRUD verification failed",
  );
  process.exit(1);
});
