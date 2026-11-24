import { notFound, redirect } from "next/navigation";
import { formatIST, formatWorkStatus } from "@/lib/format";
import { transitionTask, addComment } from "./actions";
import { EvidenceUploader } from "@/components/evidence-uploader";
import { getTaskAccess, ownTaskFilter } from "@/lib/task-access";
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
    .eq("id", id);
  if (!isAdmin) taskQuery = taskQuery.or(ownTaskFilter(userId));
  const { data: t } = await taskQuery.single();
  if (!t) notFound();
  const { data: historyData } = await s
    .from("task_status_history")
    .select("*,actor:profiles(full_name)")
    .eq("task_id", id)
    .order("created_at", { ascending: false });
  const { data: commentsData } = await s
    .from("task_comments")
    .select("*,author:profiles(full_name)")
    .eq("task_id", id)
    .order("created_at");
  const history = historyData ?? [];
  const comments = commentsData ?? [];
  const { data: attachmentData } = await s
    .from("task_attachments")
    .select(
      "id,file_name,mime_type,file_size,evidence_type,remarks,storage_path,created_at",
    )
    .eq("task_id", id)
    .order("created_at", { ascending: false });
  const attachments = await Promise.all(
    (attachmentData ?? []).map(async (item) => {
      const { data } = await s.storage
        .from("task-evidence")
        .createSignedUrl(item.storage_path, 900);
      return { ...item, signedUrl: data?.signedUrl };
    }),
  );
  const displayStatus = formatWorkStatus(t.status);
  const wasOnHold = history.some((event) => event.new_status === "on_hold");
  const isOwner = t.primary_owner_id === userId;
  const canApprove = t.created_by === userId || t.approver_id === userId;
  const nextActions: Array<[string, string]> = [];
  if (t.status === "assigned" && isOwner)
    nextActions.push(["acknowledge", "Acknowledge"]);
  if (["acknowledged", "accepted"].includes(t.status) && isOwner)
    nextActions.push(["start_wip", "Start WIP"]);
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
          <a
            className="btn btn-outline-primary"
            href={`/api/reports/tasks/${id}?format=pdf`}
          >
            <i className="ri-file-pdf-2-line me-1" />
            Task PDF
          </a>
          <a
            className="btn btn-outline-secondary"
            href={`/api/reports/tasks/${id}?format=xlsx`}
          >
            <i className="ri-file-excel-2-line me-1" />
            Excel
          </a>
        </div>
      </div>
      <div className="row g-3">
        <div className="col-lg-8">
          {nextActions.length > 0 && (
            <form
              action={transitionTask}
              className="panel p-4 mb-3 work-update-form"
            >
              <h2 className="h5">Record work update</h2>
              <p className="text-secondary small">
                Choose the next status and enter a compulsory discussion note.
                This update becomes part of the permanent task timeline.
              </p>
              <input type="hidden" name="id" value={id} />
              <div className="row g-2">
                <div className="col-md-4">
                  <label className="form-label">Next status</label>
                  <select name="action" className="form-select" required>
                    {nextActions.map(([action, label]) => (
                      <option value={action} key={action}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-md-8">
                  <label className="form-label">
                    Discussion / work update{" "}
                    <span className="text-danger">*</span>
                  </label>
                  <textarea
                    name="discussion"
                    className="form-control"
                    rows={3}
                    minLength={3}
                    maxLength={2000}
                    placeholder="Describe the work completed, progress, reason for hold, or approval decision"
                    required
                  />
                </div>
                <div className="col-12">
                  <button className="btn btn-primary">Save work update</button>
                </div>
              </div>
            </form>
          )}
          <EvidenceUploader taskId={id} />
          <section className="panel p-4 mb-3">
            <h2 className="h5">Evidence</h2>
            {attachments.map((a) => (
              <div
                className="d-flex justify-content-between border-bottom py-2"
                key={a.id}
              >
                <div>
                  <strong>{a.file_name}</strong>
                  <small className="d-block text-secondary">
                    {a.evidence_type} · {(a.file_size / 1024 / 1024).toFixed(2)}{" "}
                    MB {a.remarks && `· ${a.remarks}`}
                  </small>
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
              <p className="text-secondary mb-0">No evidence uploaded yet.</p>
            )}
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
          <section className="panel p-4">
            <h2 className="h5">Discussion</h2>
            {comments.map((c) => (
              <div className="border-bottom py-3" key={c.id}>
                <strong>{c.author?.full_name}</strong>
                <small className="text-secondary ms-2">
                  {formatIST(c.created_at)}
                </small>
                <div>{c.body}</div>
              </div>
            ))}
            <form action={addComment} className="mt-3">
              <input type="hidden" name="id" value={id} />
              <label className="form-label">
                Discussion note <span className="text-danger">*</span>
              </label>
              <textarea
                className="form-control"
                name="body"
                rows={3}
                placeholder="Add a progress update or remark"
                minLength={3}
                maxLength={5000}
                required
              />
              <button className="btn btn-outline-primary mt-2">
                Add comment
              </button>
            </form>
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
              <dt>Evidence</dt>
              <dd>{t.evidence_required ? "Required" : "Optional"}</dd>
              <dt>Progress</dt>
              <dd>{t.progress_percentage}%</dd>
            </dl>
          </section>
          <section className="panel p-4">
            <h2 className="h5">Activity timeline</h2>
            {history.map((h) => (
              <div className="border-start ps-3 pb-3" key={h.id}>
                <strong className="text-capitalize">
                  {formatWorkStatus(h.new_status)}
                </strong>
                <small className="d-block text-secondary">
                  {h.actor?.full_name} · {formatIST(h.created_at)}
                </small>
                {h.remarks && <div>{h.remarks}</div>}
              </div>
            ))}
          </section>
        </div>
      </div>
    </main>
  );
}
