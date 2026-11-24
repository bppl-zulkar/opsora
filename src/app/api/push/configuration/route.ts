import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
export async function GET() {
  const s = await createClient();
  const {
    data: { user },
  } = await s.auth.getUser();
  if (!user) return NextResponse.json({ enabled: false }, { status: 401 });
  const { data: p } = await s
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();
  const { data: c } = await createAdminClient()
    .from("organization_communication_settings")
    .select("web_push_enabled,vapid_public_key")
    .eq("organization_id", p?.organization_id)
    .maybeSingle();
  return NextResponse.json({
    enabled: c?.web_push_enabled === true,
    publicKey: c?.vapid_public_key ?? null,
  });
}
