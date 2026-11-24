import "server-only";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";

export async function getTaskAccess() {
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) redirect("/login");
  const admin = createAdminClient();
  const [{ data: profile }, { data: roles }] = await Promise.all([
    client
      .from("profiles")
      .select("organization_id,is_platform_admin")
      .eq("id", user.id)
      .single(),
    admin
      .from("user_roles")
      .select("roles!inner(system_key)")
      .eq("user_id", user.id),
  ]);
  const isAdmin = Boolean(
    profile?.is_platform_admin ||
    roles?.some((entry) => {
      const role = entry.roles as unknown as { system_key?: string };
      return (
        role.system_key === "company_admin" ||
        role.system_key === "platform_super_admin"
      );
    }),
  );
  return {
    client,
    userId: user.id,
    organizationId: profile?.organization_id,
    isAdmin,
  };
}

export const ownTaskFilter = (userId: string) =>
  `created_by.eq.${userId},primary_owner_id.eq.${userId}`;
