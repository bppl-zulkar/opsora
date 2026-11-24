"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import {
  createEvidenceUpload,
  finalizeEvidenceUpload,
} from "@/app/(app)/tasks/[id]/evidence-actions";
import { transitionTask } from "@/app/(app)/tasks/[id]/actions";
import { announcePending } from "./interaction-lock";

const allowed = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "video/mp4",
]);

export function TaskUpdateForm({
  taskId,
  nextActions,
}: {
  taskId: string;
  nextActions: Array<[string, string]>;
}) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const pendingId = useId();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    announcePending(pendingId, busy);
    return () => announcePending(pendingId, false);
  }, [busy, pendingId]);

  async function submit(form: FormData) {
    const file = form.get("file") as File;
    const remarks = String(form.get("remarks") || "").trim();
    const action = String(form.get("action") || "");
    if (remarks.length < 3)
      return setMessage("Enter remarks (at least 3 characters)");
    if (!nextActions.some(([value]) => value === action))
      return setMessage("Choose a valid next status");
    if (file?.size && !allowed.has(file.type))
      return setMessage("This file type is not permitted");
    if (file?.size && file.size > 50 * 1024 * 1024)
      return setMessage("File exceeds the 50 MB maximum");

    setBusy(true);
    setMessage("");
    try {
      if (file?.size) {
        const request = {
          taskId,
          fileName: file.name,
          mimeType: file.type,
          fileSize: file.size,
          remarks,
        };
        const signed = await createEvidenceUpload(request);
        const digest = await crypto.subtle.digest(
          "SHA-256",
          await file.arrayBuffer(),
        );
        const checksum = Array.from(new Uint8Array(digest))
          .map((x) => x.toString(16).padStart(2, "0"))
          .join("");
        const upload = await createClient()
          .storage.from("task-evidence")
          .uploadToSignedUrl(signed.path, signed.token, file, {
            contentType: file.type,
          });
        if (upload.error) throw upload.error;
        await finalizeEvidenceUpload({
          ...request,
          path: signed.path,
          checksum,
        });
      }

      const update = new FormData();
      update.set("id", taskId);
      update.set("action", action);
      update.set("remarks", remarks);
      await transitionTask(update);
      formRef.current?.reset();
      setBusy(false);
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Task update failed",
      );
      setBusy(false);
    }
  }

  return (
    <form
      ref={formRef}
      action={submit}
      className="panel p-4 mb-3 work-update-form"
    >
      <h2 className="h5">Update task</h2>
      <p className="text-secondary small">
        Optionally upload a file or photo, add remarks, then submit the status
        update. The user will be notified.
      </p>
      <input type="hidden" name="id" value={taskId} />
      <fieldset disabled={busy} className="form-fieldset">
        <div className="row g-2">
          <div className="col-md-4">
            <label className="form-label" htmlFor={`task-action-${taskId}`}>
              Next status
            </label>
            <select
              id={`task-action-${taskId}`}
              name="action"
              className="form-select"
              required
            >
              {nextActions.map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-8">
            <label className="form-label" htmlFor={`task-file-${taskId}`}>
              Upload files or photos (optional)
            </label>
            <input
              id={`task-file-${taskId}`}
              name="file"
              type="file"
              className="form-control"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf,.docx,.xlsx,video/mp4"
              capture="environment"
            />
          </div>
          <div className="col-12">
            <label className="form-label" htmlFor={`task-remarks-${taskId}`}>
              Remarks <span className="text-danger">*</span>
            </label>
            <textarea
              id={`task-remarks-${taskId}`}
              name="remarks"
              className="form-control"
              rows={3}
              minLength={3}
              maxLength={2000}
              placeholder="Add remarks for this status update"
              required
            />
          </div>
          <div className="col-12">
            <button disabled={busy} className="btn btn-primary">
              {busy ? "Submitting update…" : "Submit status update"}
            </button>
            {message && (
              <span role="alert" className="ms-3 small text-danger">
                {message}
              </span>
            )}
          </div>
        </div>
      </fieldset>
    </form>
  );
}
