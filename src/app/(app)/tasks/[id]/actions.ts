"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dispatchTaskEvent } from "@/lib/communications";
export async function transitionTask(fd: FormData) {
  const id = z.string().uuid().parse(fd.get("id")),
    action = z
      .enum([
        "acknowledge",
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
  const approvalAction =
    task.created_by === user.id || task.approver_id === user.id;
  const allowed =
    (action === "acknowledge" && task.status === "assigned" && ownerAction) ||
    (action === "start_wip" &&
      ["acknowledged", "accepted"].includes(task.status) &&
      ownerAction) ||
    (action === "complete" && task.status === "in_progress" && ownerAction) ||
    (action === "hold" && task.status === "in_progress" && ownerAction) ||
    (action === "resume" && task.status === "on_hold" && ownerAction) ||
    (action === "approve" &&
      task.status === "pending_verification" &&
      approvalAction);
  if (!allowed) throw new Error("This work update is no longer available");
  const transitions =
    action === "acknowledge"
      ? ["acknowledged"]
      : action === "start_wip"
        ? task.status === "acknowledged"
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
    action === "acknowledge"
      ? "acknowledged"
      : action === "start_wip" || action === "resume"
        ? "WIP"
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
