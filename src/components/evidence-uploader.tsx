"use client";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  createEvidenceUpload,
  finalizeEvidenceUpload,
} from "@/app/(app)/tasks/[id]/evidence-actions";

const allowed = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "video/mp4",
]);

export function EvidenceUploader({ taskId }: { taskId: string }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function upload(form: FormData) {
    const file = form.get("file") as File;
    const type = String(form.get("evidence_type") || "supporting");
    const remarks = String(form.get("remarks") || "").trim();
    if (!file?.size) return setMessage("Choose a file");
    if (!allowed.has(file.type))
      return setMessage("This file type is not permitted");
    if (file.size > 50 * 1024 * 1024)
      return setMessage("File exceeds the 50 MB maximum");
    if (remarks.length < 3) return setMessage("Enter evidence remarks");
    setBusy(true);
    setMessage("");
    try {
      const request = {
        taskId,
        fileName: file.name,
        mimeType: file.type,
        fileSize: file.size,
        evidenceType: type as
          "before" | "progress" | "after" | "completion" | "supporting",
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
      const supabase = createClient();
      const upload = await supabase.storage
        .from("task-evidence")
        .uploadToSignedUrl(signed.path, signed.token, file, {
          contentType: file.type,
        });
      if (upload.error) throw upload.error;
      await finalizeEvidenceUpload({ ...request, path: signed.path, checksum });
      setMessage("Evidence and remarks uploaded successfully");
      const formElement = document.querySelector<HTMLFormElement>(
        `form[data-evidence-task="${taskId}"]`,
      );
      formElement?.reset();
      router.refresh();
    } catch (error) {
      setBusy(false);
      return setMessage(
        error instanceof Error ? error.message : "Evidence upload failed",
      );
    }
    setBusy(false);
  }
  return (
    <form
      action={upload}
      className="panel p-4 mb-3"
      data-evidence-task={taskId}
    >
      <h2 className="h5">Upload evidence</h2>
      <div className="row g-2">
        <div className="col-12">
          <input
            name="file"
            type="file"
            className="form-control"
            accept="image/jpeg,image/png,image/webp,application/pdf,.docx,.xlsx,video/mp4"
            capture="environment"
            required
          />
        </div>
        <div className="col-md-4">
          <select name="evidence_type" className="form-select">
            <option value="before">Before work</option>
            <option value="progress">Progress</option>
            <option value="after">After work</option>
            <option value="completion">Completion</option>
            <option value="supporting">Supporting document</option>
          </select>
        </div>
        <div className="col-md-8">
          <input
            name="remarks"
            className="form-control"
            placeholder="Evidence remarks"
            aria-label="Evidence remarks"
            maxLength={500}
            minLength={3}
            required
          />
        </div>
        <div className="col-12">
          <button disabled={busy} className="btn btn-outline-primary">
            {busy ? "Uploading…" : "Upload securely"}
          </button>
          {message && <span className="ms-3 small">{message}</span>}
        </div>
      </div>
    </form>
  );
}
