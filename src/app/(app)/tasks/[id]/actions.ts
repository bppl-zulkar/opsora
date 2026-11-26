"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dispatchTaskEvent } from "@/lib/communications";
import { getTaskAccess } from "@/lib/task-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAudit } from "@/lib/audit";
import { redirect } from "next/navigation";
export async function transitionTask(fd: FormData) {
  const id = z.string().uuid().parse(fd.get("id")),
    action = z
      .enum([
        "start_wip",
        "complete",
        "hold",
        "resume",
        "approve",
      ])
      .parse(fd.get("action")),
    remarks = z.string().trim().min(3).max(2000).parse(fd.get("remarks"));
  const s = await createClient();
  const {
    data: { user },
  } = await s.auth.getUser();
  if (!user) throw new Error("Authentication required");
  const { data: task } = await s
    .from("tasks")
    .select("title,status,created_by,primary_owner_id,approver_id")
    .eq("id", id)
    .single();
  if (!task) throw new Error("Task is unavailable");
  const ownerAction = task.primary_owner_id === user.id;
  const approvalAction = task.created_by === user.id;
  const allowed =
    (action === "start_wip" &&
      ["assigned", "acknowledged", "accepted"].includes(task.status) &&
      ownerAction) ||
    (action === "complete" && task.status === "in_progress" && ownerAction) ||
    (action === "hold" && task.status === "in_progress" && ownerAction) ||
    (action === "resume" && task.status === "on_hold" && ownerAction) ||
    (action === "approve" &&
      task.status === "pending_verification" &&
      approvalAction);
  if (!allowed) throw new Error("This work update is no longer available");
  const transitions =
    action === "start_wip"
      ? task.status === "assigned"
        ? ["acknowledged", "accepted", "in_progress"]
        : task.status === "acknowledged"
          ? ["accepted", "in_progress"]
          : ["in_progress"]
        : action === "complete"
          ? ["pending_verification"]
          : action === "hold"
            ? ["on_hold"]
            : action === "resume"
              ? ["in_progress"]
              : ["closed"];
  for (const [index, status] of transitions.entries()) {
    const { error } = await s.rpc("transition_task", {
      p_task_id: id,
      p_new_status: status,
      p_remarks: index === transitions.length - 1 ? remarks : null,
    });
    if (error) throw new Error(error.message);
  }
  const visibleStatus =
    action === "start_wip" || action === "resume"
      ? "Work in Progress"
        : action === "complete"
          ? "completed"
          : action === "hold"
            ? "on hold"
        : "approved and closed";
  await dispatchTaskEvent(
    id,
    user.id,
    action === "complete" ? "Task completed" : "Work update recorded",
    action === "complete"
      ? `"${task.title}" is complete and ready for verification. Remarks: ${remarks}`
      : `Task status changed to ${visibleStatus}. Remarks: ${remarks}`,
  ).catch(console.error);
  revalidatePath(`/tasks/${id}`);
}

export async function deleteTask(fd: FormData) {
  const id = z.string().uuid().parse(fd.get("id"));
  try {
    const { userId, organizationId, isAdmin } = await getTaskAccess();
    if (!organizationId) throw new Error("Organization is unavailable");
    const admin = createAdminClient();
    const { data: task, error } = await admin
      .from("tasks")
      .select("id,reference,title,status,created_by,primary_owner_id")
      .eq("id", id)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .single();
    if (error || !task) throw new Error("Task is unavailable");
    if (!isAdmin && task.created_by !== userId)
      throw new Error("Only the task creator or an administrator can delete it");

    const deletedAt = new Date().toISOString();
    const { error: updateError } = await admin
      .from("tasks")
      .update({
        status: "cancelled",
        cancelled_at: deletedAt,
        deleted_at: deletedAt,
        updated_at: deletedAt,
      })
      .eq("id", id)
      .eq("organization_id", organizationId)
      .is("deleted_at", null);
    if (updateError) throw updateError;

    await writeAudit(admin, {
      organizationId,
      actorId: userId,
      action: "task.deleted",
      entityType: "task",
      entityId: id,
      previous: {
        reference: task.reference,
        title: task.title,
        status: task.status,
      },
      next: { status: "cancelled", deleted_at: deletedAt },
      reason: isAdmin ? "Deleted by an administrator" : "Deleted by creator",
    }).catch(console.error);
    await dispatchTaskEvent(
      id,
      userId,
      "Task deleted",
      `"${task.title}" was deleted and removed from active work views.`,
    ).catch(console.error);
    revalidatePath("/tasks");
    revalidatePath("/dashboard");
    revalidatePath("/reports");
  } catch (error) {
    redirect(
      `/tasks?error=${encodeURIComponent(error instanceof Error ? error.message : "Unable to delete task")}`,
    );
  }
  redirect("/tasks?success=Task%20deleted");
}
