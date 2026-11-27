import { notFound, redirect } from "next/navigation";
import { formatIST, formatWorkStatus } from "@/lib/format";
import { TaskUpdateForm } from "@/components/task-update-form";
import { getTaskAccess, ownTaskFilter } from "@/lib/task-access";
import { ReportDownloadButton } from "@/components/report-download-button";
import Image from "next/image";
import { deleteTask } from "./actions";
import { FormSubmitButton } from "@/components/form-submit-button";
import { TaskChecklist } from "@/components/task-checklist";
export default async function Task({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id,
    )
  )
    redirect(`/tasks?view=${encodeURIComponent(id)}`);
  const { client: s, userId, isAdmin } = await getTaskAccess();
  let taskQuery = s
    .from("tasks")
    .select(
      "*,creator:profiles!tasks_created_by_fkey(full_name,employee_id),owner:profiles!tasks_primary_owner_id_fkey(full_name,employee_id)",
    )
    .eq("id", id)
    .is("deleted_at", null);
  if (!isAdmin) taskQuery = taskQuery.or(ownTaskFilter(userId));
  const { data: t } = await taskQuery.single();
  if (!t) notFound();
  const [{ data: historyData }, { data: checklistData }, { data: attachmentData }, { data: commentData }] = await Promise.all([
    s.from("task_status_history").select("*,actor:profiles(full_name)").eq("task_id", id).order("created_at", { ascending: false }),
    s.from("task_checklist_items").select("id,label,completed,completed_at").eq("task_id", id).order("position"),
    s.from("task_attachments").select("id,file_name,mime_type,file_size,remarks,storage_path,created_at,uploader:profiles!task_attachments_uploaded_by_fkey(full_name)").eq("task_id", id).order("created_at", { ascending: false }),
    s.from("task_comments").select("id,body,internal,created_at,author:profiles!task_comments_author_id_fkey(full_name)").eq("task_id", id).order("created_at", { ascending: false }),
  ]);
  const history = historyData ?? [];
  const attachments = await Promise.all(
    (attachmentData ?? []).map(async (item) => {
      const { data } = await s.storage
        .from("task-evidence")
        .createSignedUrl(item.storage_path, 900);
      return { ...item, signedUrl: data?.signedUrl };
    }),
  );
  const displayStatus = formatWorkStatus(t.status);
  const reachedStatuses = new Set(history.map((event) => event.new_status));
  const lifecycle = [
    { label: "Assigned", detail: "Work assigned", reached: true, active: ["assigned"].includes(t.status) },
    { label: "Acknowledged", detail: "Owner confirmed", reached: reachedStatuses.has("acknowledged") || !["assigned"].includes(t.status), active: ["acknowledged", "accepted"].includes(t.status) },
    { label: "Work in progress", detail: "Execution underway", reached: ["in_progress", "on_hold", "pending_verification", "closed", "completed"].some((status) => reachedStatuses.has(status) || t.status === status), active: ["in_progress", "on_hold", "rework_required", "reopened"].includes(t.status) },
    { label: "Submitted", detail: "Awaiting verification", reached: ["pending_verification", "closed", "completed"].some((status) => reachedStatuses.has(status) || t.status === status), active: t.status === "pending_verification" },
    { label: "Verified", detail: "Creator approved", reached: ["closed", "completed"].includes(t.status), active: ["closed", "completed"].includes(t.status) },
  ];
  const timeline = [
    ...history.map((event) => ({
      id: `status-${event.id}`, kind: "status" as const, title: formatWorkStatus(event.new_status),
      actor: event.actor?.full_name ?? "System", createdAt: event.created_at, remarks: event.remarks as string | null,
    })),
    ...attachments.map((item) => ({
      id: `file-${item.id}`, kind: "file" as const, title: "Document or evidence uploaded",
      actor: (item.uploader as unknown as { full_name?: string } | null)?.full_name ?? "Company User", createdAt: item.created_at,
      remarks: item.remarks, file: item,
    })),
    ...(commentData ?? []).map((item) => ({
      id: `comment-${item.id}`, kind: "comment" as const, title: item.internal ? "Internal discussion note" : "Discussion note",
      actor: (item.author as unknown as { full_name?: string } | null)?.full_name ?? "Company User", createdAt: item.created_at,
      remarks: item.body as string,
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const wasOnHold = history.some((event) => event.new_status === "on_hold");
  const isOwner = t.primary_owner_id === userId;
  const canApprove = t.created_by === userId;
  const canDelete = t.created_by === userId || isAdmin;
  const nextActions: Array<[string, string]> = [];
  if (["assigned", "acknowledged", "accepted"].includes(t.status) && isOwner)
    nextActions.push(["start_wip", "Start Work in Progress"]);
  if (t.status === "in_progress" && isOwner) {
    nextActions.push(["complete", "Mark completed"]);
    if (!wasOnHold) nextActions.push(["hold", "Put on hold"]);
  }
  if (t.status === "on_hold" && isOwner)
    nextActions.push(["resume", "Resume WIP"]);
  if (t.status === "pending_verification" && canApprove)
    nextActions.push(["approve", "Approve & close"]);
  return (
    <main className="page">
      <div className="d-flex justify-content-between align-items-start mb-4">
        <div>
          <div className="text-primary fw-semibold">{t.reference}</div>
          <h1 className="h3 fw-bold">{t.title}</h1>
          <span className="status">{displayStatus}</span>
        </div>
        <div className="d-flex flex-wrap gap-2 justify-content-end">
          <ReportDownloadButton
            href={`/api/reports/tasks/${id}?format=pdf`}
            className="btn btn-outline-primary"
            icon="ri-file-pdf-2-line"
          >
            Task PDF
          </ReportDownloadButton>
          <ReportDownloadButton
            href={`/api/reports/tasks/${id}?format=xlsx`}
            className="btn btn-outline-secondary"
            icon="ri-file-excel-2-line"
          >
            Excel
          </ReportDownloadButton>
          {canDelete && (
            <form action={deleteTask}>
              <input type="hidden" name="id" value={id} />
              <FormSubmitButton
                className="btn btn-outline-danger"
                pendingLabel="Deleting task…"
                confirmMessage={`Delete ${t.reference}? The task will be removed from active views while its audit history is preserved.`}
              >
                <i className="ri-delete-bin-line me-1" /> Delete task
              </FormSubmitButton>
            </form>
          )}
        </div>
      </div>
      <section className="panel p-4 mb-3 task-lifecycle-card">
        <div className="task-section-heading">
          <div><span>Lifecycle</span><h2>Task journey</h2></div>
          <strong>{t.progress_percentage}% complete</strong>
        </div>
        <div className="task-lifecycle-steps">
          {lifecycle.map((stage, index) => (
            <div className={`${stage.reached ? "is-reached" : ""}${stage.active ? " is-active" : ""}`} key={stage.label}>
              <span>{stage.reached ? <i className="ri-check-line" /> : index + 1}</span>
              <div><strong>{stage.label}</strong><small>{stage.detail}</small></div>
            </div>
          ))}
        </div>
      </section>
      <div className="row g-3">
        <div className="col-lg-8">
          <TaskChecklist taskId={id} initialItems={checklistData ?? []} canUpdate={isOwner} />
          {nextActions.length > 0 && (
            <TaskUpdateForm taskId={id} nextActions={nextActions} />
          )}
          <section className="panel p-4 mb-3">
            <h2 className="h5">Uploaded files and photos</h2>
            {attachments.map((a) => (
              <div
                className="evidence-file-row d-flex justify-content-between align-items-center gap-3 border-bottom py-3"
                key={a.id}
              >
                <div className="d-flex align-items-center gap-3 min-w-0">
                  {a.signedUrl && a.mime_type?.startsWith("image/") ? (
                    <Image
                      src={a.signedUrl}
                      alt={a.file_name}
                      width={96}
                      height={72}
                      className="evidence-thumbnail"
                      unoptimized
                    />
                  ) : (
                    <span className="evidence-file-icon">
                      <i className="ri-file-line" aria-hidden="true" />
                    </span>
                  )}
                  <div className="min-w-0">
                    <strong>{a.file_name}</strong>
                    <small className="d-block text-secondary">
                      {(a.file_size / 1024 / 1024).toFixed(2)} MB
                      {a.remarks && ` · ${a.remarks}`}
                    </small>
                  </div>
                </div>
                {a.signedUrl && (
                  <a
                    className="btn btn-sm btn-outline-primary"
                    href={a.signedUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View
                  </a>
                )}
              </div>
            ))}
            {!attachments.length && (
              <p className="text-secondary mb-0">
                No files or photos uploaded yet.
              </p>
            )}
          </section>
          <section className="panel p-4 task-complete-timeline">
            <div className="task-section-heading">
              <div><span>Complete history</span><h2>Updates, remarks and documents</h2></div>
              <strong>{timeline.length} updates</strong>
            </div>
            <div className="task-timeline-list">
              {timeline.map((event) => (
                <article className={`task-timeline-event event-${event.kind}`} key={event.id}>
                  <span className="task-timeline-icon"><i className={event.kind === "file" ? "ri-attachment-2" : event.kind === "comment" ? "ri-chat-3-line" : "ri-refresh-line"} /></span>
                  <div className="task-timeline-content">
                    <div className="task-timeline-title"><strong>{event.title}</strong><time>{formatIST(event.createdAt)}</time></div>
                    <small>{event.actor}</small>
                    {event.remarks && <p>{event.remarks}</p>}
                    {event.kind === "file" && event.file && (
                      <div className="task-timeline-file">
                        {event.file.signedUrl && event.file.mime_type?.startsWith("image/") ? (
                          <Image src={event.file.signedUrl} alt={event.file.file_name} width={90} height={68} className="evidence-thumbnail" unoptimized />
                        ) : <span className="evidence-file-icon"><i className="ri-file-line" /></span>}
                        <div><strong>{event.file.file_name}</strong><small>{(event.file.file_size / 1024 / 1024).toFixed(2)} MB</small></div>
                        {event.file.signedUrl && <a className="btn btn-sm btn-outline-primary" href={event.file.signedUrl} target="_blank" rel="noreferrer">View document</a>}
                      </div>
                    )}
                  </div>
                </article>
              ))}
              {!timeline.length && <p className="text-secondary mb-0">No updates have been recorded yet.</p>}
            </div>
          </section>
          <section className="panel p-4 mb-3">
            <h2 className="h5">Instructions</h2>
            <p className="text-secondary" style={{ whiteSpace: "pre-wrap" }}>
              {t.description}
            </p>
            <div className="row mt-4">
              <div className="col-sm-6">
                <small className="text-secondary">Assigned by</small>
                <div>
                  {t.creator?.full_name} · {t.creator?.employee_id}
                </div>
              </div>
              <div className="col-sm-6">
                <small className="text-secondary">Accountable owner</small>
                <div>
                  {t.owner?.full_name} · {t.owner?.employee_id}
                </div>
              </div>
            </div>
          </section>
        </div>
        <div className="col-lg-4">
          <section className="panel p-4 mb-3">
            <h2 className="h5">Task details</h2>
            <dl>
              <dt>Priority</dt>
              <dd>{t.priority}</dd>
              <dt>Deadline</dt>
              <dd>{formatIST(t.current_deadline)}</dd>
              <dt>Upload requirement</dt>
              <dd>{t.evidence_required ? "Required" : "Optional"}</dd>
              <dt>Progress</dt>
              <dd>{t.progress_percentage}%</dd>
            </dl>
          </section>
        </div>
      </div>
    </main>
  );
}
