import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
export async function POST(request: Request) {
  const s = await createClient();
  const {
    data: { user },
  } = await s.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const subscription = await request.json();
  if (!subscription?.endpoint)
    return NextResponse.json(
      { error: "Invalid subscription" },
      { status: 400 },
    );
  const admin = createAdminClient();
  const { data: p } = await admin
    .from("profiles")
    .select("organization_id,notification_preferences")
    .eq("id", user.id)
    .single();
  if (!p?.organization_id)
    return NextResponse.json({ error: "Profile unavailable" }, { status: 400 });
  const preferences = (p.notification_preferences ?? {}) as Record<
    string,
    unknown
  >;
  const devices = Array.isArray(preferences.push_subscriptions)
    ? (preferences.push_subscriptions as Array<Record<string, unknown>>)
    : [];
  const device = {
    endpoint: subscription.endpoint,
    subscription,
    user_agent: request.headers.get("user-agent"),
    updated_at: new Date().toISOString(),
  };
  const nextDevices = [
    ...devices.filter((item) => item.endpoint !== subscription.endpoint),
    device,
  ].slice(-8);
  const { error } = await admin
    .from("profiles")
    .update({
      notification_preferences: {
        ...preferences,
        push: true,
        push_subscriptions: nextDevices,
      },
    })
    .eq("id", user.id);
  return error
    ? NextResponse.json({ error: error.message }, { status: 500 })
    : NextResponse.json({ saved: true });
}
