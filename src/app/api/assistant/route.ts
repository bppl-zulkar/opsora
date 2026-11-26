import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatWorkStatus } from "@/lib/format";

const requestSchema = z.object({
  message: z.string().trim().min(1).max(500),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(500) }))
    .max(8)
    .optional(),
});

const finishedStatuses = ["completed", "closed"];
const openStatuses = ["assigned", "acknowledged", "accepted", "in_progress", "on_hold", "pending_verification", "rework_required", "reopened"];

export async function POST(request: Request) {
  const session = await createClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Please ask a shorter task question." }, { status: 400 });

  const admin = createAdminClient();
  const [{ data: profile }, { data: roles }] = await Promise.all([
    admin.from("profiles").select("organization_id,full_name,is_platform_admin").eq("id", user.id).maybeSingle(),
    admin.from("user_roles").select("roles!inner(system_key)").eq("user_id", user.id),
  ]);
  if (!profile?.organization_id) return NextResponse.json({ error: "Your company profile is not configured." }, { status: 403 });

  const isAdmin = Boolean(profile.is_platform_admin || roles?.some((entry) => {
    const role = entry.roles as unknown as { system_key?: string };
    return role.system_key === "company_admin" || role.system_key === "platform_super_admin";
  }));

  let taskQuery = admin
    .from("tasks")
    .select("id,reference,title,description,status,priority,progress_percentage,current_deadline,created_at,created_by,primary_owner_id,creator:profiles!tasks_created_by_fkey(full_name),owner:profiles!tasks_primary_owner_id_fkey(full_name)")
    .eq("organization_id", profile.organization_id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(200);
  if (!isAdmin) taskQuery = taskQuery.or(`created_by.eq.${user.id},primary_owner_id.eq.${user.id}`);

  const [{ data: tasks, error }, { data: people }] = await Promise.all([
    taskQuery,
    admin.from("profiles").select("id,full_name").eq("organization_id", profile.organization_id),
  ]);
  if (error) return NextResponse.json({ error: "I could not read your tasks right now." }, { status: 500 });

  const message = parsed.data.message.toLowerCase();
  const conversation = `${parsed.data.history?.filter((item) => item.role === "user").map((item) => item.text).join(" ") ?? ""} ${message}`.toLowerCase();
  const person = (people ?? [])
    .map((entry) => {
      const fullName = entry.full_name?.toLowerCase() ?? "";
      const nameParts = fullName.split(/\s+/).filter((part: string) => part.length > 2);
      const score = conversation.includes(fullName)
        ? 1000 + fullName.length
        : Math.max(0, ...nameParts.map((part: string) => conversation.match(new RegExp(`\\b${part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`)) ? part.length : 0));
      return { ...entry, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)[0];

  const assistantGuidance = "I can help with your Opsora task records. Ask about open, overdue, completed, in-progress, or assigned tasks.";
  if (/^(?:hi|hello|hey|good morning|good afternoon|good evening)(?: opsora)?[.!?]*$/.test(message)) {
    return NextResponse.json({ answer: `Hello ${profile.full_name}. ${assistantGuidance}`, results: [] });
  }
  if (/^(?:help|what can you do|what can i ask|what can you help me with)\??$/.test(message)) {
    return NextResponse.json({ answer: assistantGuidance, results: [] });
  }
  if (!person && !/\b(?:task|tasks|work|assigned|deadline|due|overdue|late|completed|finished|finish|done|closed|on hold|progress|working|open|pending|active|created|how many|count|number of)\b/.test(message)) {
    return NextResponse.json({ answer: assistantGuidance, results: [] });
  }

  let filtered = tasks ?? [];
  let subject = "you";
  if (person) {
    subject = person.id === user.id ? "you" : person.full_name;
    if (/created|assigned by/.test(message)) filtered = filtered.filter((task) => task.created_by === person.id);
    else if (/done|completed|finished|closed|assigned to|work assigned|tasks? assigned|ongoing/.test(message)) filtered = filtered.filter((task) => task.primary_owner_id === person.id);
    else filtered = filtered.filter((task) => task.created_by === person.id || task.primary_owner_id === person.id);
  } else if (/created by me|i created|assigned by me/.test(message)) {
    filtered = filtered.filter((task) => task.created_by === user.id);
  } else if (/my task|assigned to me|do i have/.test(message)) {
    filtered = filtered.filter((task) => task.primary_owner_id === user.id);
  }

  const now = new Date();
  if (/overdue|late/.test(message)) filtered = filtered.filter((task) => new Date(task.current_deadline) < now && !finishedStatuses.includes(task.status));
  else if (/completed|finished|done/.test(message)) filtered = filtered.filter((task) => finishedStatuses.includes(task.status));
  else if (/closed/.test(message)) filtered = filtered.filter((task) => task.status === "closed");
  else if (/on hold|held/.test(message)) filtered = filtered.filter((task) => task.status === "on_hold");
  else if (/progress|working|wip/.test(message)) filtered = filtered.filter((task) => ["acknowledged", "accepted", "in_progress", "rework_required", "reopened"].includes(task.status));
  else if (/open|pending|active/.test(message)) filtered = filtered.filter((task) => openStatuses.includes(task.status));

  const count = filtered.length;
  const asksCount = /how many|count|number of/.test(message);
  if (!count) return NextResponse.json({ answer: `I found no matching tasks for ${subject}. Try asking about open, overdue, completed, or created tasks.`, results: [] });

  const intro = asksCount
    ? `There ${count === 1 ? "is" : "are"} ${count} matching task${count === 1 ? "" : "s"} for ${subject}.`
    : `I found ${count} matching task${count === 1 ? "" : "s"} for ${subject}.`;
  const visibleTasks = filtered.slice(0, 10);
  const { data: updateRows } = await admin
    .from("task_status_history")
    .select("task_id,new_status,remarks,created_at,actor:profiles(full_name)")
    .in("task_id", visibleTasks.map((task) => task.id))
    .order("created_at", { ascending: false });
  const results = visibleTasks.map((task) => {
    const latestUpdate = updateRows?.find((update) => update.task_id === task.id);
    return {
    id: task.id,
    reference: task.reference,
    title: task.title,
    description: task.description,
    status: formatWorkStatus(task.status),
    priority: task.priority,
    progress: task.progress_percentage,
    deadline: task.current_deadline,
    createdAt: task.created_at,
    creator: (task.creator as unknown as { full_name?: string } | null)?.full_name ?? "Unknown",
    owner: (task.owner as unknown as { full_name?: string } | null)?.full_name ?? "Unassigned",
    latestUpdate: latestUpdate ? {
      status: formatWorkStatus(latestUpdate.new_status),
      remarks: latestUpdate.remarks,
      createdAt: latestUpdate.created_at,
      actor: (latestUpdate.actor as unknown as { full_name?: string } | null)?.full_name ?? "System",
    } : null,
  };
  });
  const detailPrompt = count === 1 ? `The task is ${results[0].reference}, ${results[0].title}. Its status is ${results[0].status}.` : "I have organized the details in the chat.";
  const remainder = count > results.length ? ` ${count - results.length} additional tasks are available on the Tasks page.` : "";
  return NextResponse.json({ answer: `${intro} ${detailPrompt}${remainder}`, count, results });
}
