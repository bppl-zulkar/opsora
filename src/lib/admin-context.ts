import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

export async function requireOrganizationAdmin() {
  const session = await createClient();
  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await session
    .from("profiles")
    .select("organization_id,is_platform_admin")
    .eq("id", user.id)
    .single();
  if (!profile?.organization_id)
    throw new Error("Administrator is not assigned to an organization");
  let allowed = profile.is_platform_admin;
  if (!allowed) {
    const { data: roles } = await createAdminClient()
      .from("user_roles")
      .select("roles!inner(system_key)")
      .eq("user_id", user.id)
      .eq("organization_id", profile.organization_id);
    allowed = Boolean(
      roles?.some((entry) => {
        const role = entry.roles as unknown as { system_key?: string };
        return (
          role.system_key === "company_admin" ||
          role.system_key === "platform_super_admin"
        );
      }),
    );
  }
  if (!allowed) redirect("/unauthorized");
  return {
    session,
    admin: createAdminClient(),
    actorId: user.id,
    organizationId: profile.organization_id,
  };
}
