import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") || "/dashboard";
  if (code) {
    const s = await createClient();
    const { error } = await s.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }
  return NextResponse.redirect(
    new URL(
      "/login?error=Authentication%20link%20is%20invalid%20or%20expired",
      url.origin,
    ),
  );
}
