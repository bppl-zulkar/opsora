import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
const allowed = new Set(["main_logo", "login_logo", "favicon", "pwa_icon"]);
export async function GET(request: Request) {
  const type = new URL(request.url).searchParams.get("type") ?? "main_logo";
  if (!allowed.has(type))
    return new NextResponse("Invalid asset", { status: 400 });
  const admin = createAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("id")
    .eq("active", true)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (!org)
    return NextResponse.redirect(new URL("/opsora-logo.png", request.url));
  const { data: branding } = await admin
    .from("organization_branding")
    .select("assets")
    .eq("organization_id", org.id)
    .maybeSingle();
  const assets = (branding?.assets ?? {}) as Record<string, string>;
  const path = assets.main_logo;
  if (!path)
    return NextResponse.redirect(new URL("/opsora-logo.png", request.url));
  const { data, error } = await admin.storage
    .from("branding-assets")
    .download(path);
  if (error || !data)
    return NextResponse.redirect(new URL("/opsora-logo.png", request.url));
  return new NextResponse(data, {
    headers: {
      "Content-Type": data.type || "application/octet-stream",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
