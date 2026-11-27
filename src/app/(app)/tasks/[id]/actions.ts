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
  if (action === "complete") {
    const { count, error: checklistError } = await createAdminClient()
      .from("task_checklist_items")
      .select("id", { count: "exact", head: true })
      .eq("task_id", id)
      .eq("completed", false);
    if (checklistError) throw new Error("Unable to verify the task checklist");
    if (count) throw new Error(`Complete all ${count} remaining checklist item${count === 1 ? "" : "s"} before submitting the task`);
  }
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
  const automaticProgress = action === "approve" ? 100 : action === "complete" ? 90 : action === "start_wip" || action === "resume" ? 30 : null;
  if (automaticProgress !== null) {
    const { error: progressError } = await createAdminClient()
      .from("tasks")
      .update({ progress_percentage: automaticProgress, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (progressError) throw new Error("Task status changed, but progress could not be updated");
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
  revalidatePath("/dashboard");
  revalidatePath("/board");
  revalidatePath("/tasks");
}

const checklistUpdate = z.object({
  taskId: z.string().uuid(),
  itemId: z.string().uuid(),
  completed: z.boolean(),
});

export async function toggleChecklistItem(value: z.infer<typeof checklistUpdate>) {
  const input = checklistUpdate.parse(value);
  const s = await createClient();
  const { data: { user } } = await s.auth.getUser();
  if (!user) throw new Error("Authentication required");
  const admin = createAdminClient();
  const { data: task } = await admin.from("tasks").select("id,primary_owner_id,status").eq("id", input.taskId).is("deleted_at", null).maybeSingle();
  if (!task || task.primary_owner_id !== user.id) throw new Error("Only the assigned owner can update this checklist");
  if (["closed", "cancelled"].includes(task.status)) throw new Error("This task can no longer be changed");
  const { error } = await admin.from("task_checklist_items").update({
    completed: input.completed,
    completed_by: input.completed ? user.id : null,
    completed_at: input.completed ? new Date().toISOString() : null,
  }).eq("id", input.itemId).eq("task_id", input.taskId);
  if (error) throw new Error(error.message);
  const { data: checklist } = await admin
    .from("task_checklist_items")
    .select("completed")
    .eq("task_id", input.taskId);
  if (checklist?.length && ["in_progress", "on_hold", "rework_required", "reopened"].includes(task.status)) {
    const completedItems = checklist.filter((item) => item.completed).length;
    const progress = Math.min(85, 30 + Math.round((completedItems / checklist.length) * 55));
    await admin.from("tasks").update({ progress_percentage: progress, updated_at: new Date().toISOString() }).eq("id", input.taskId);
  }
  revalidatePath(`/tasks/${input.taskId}`);
  revalidatePath("/dashboard");
  revalidatePath("/board");
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
