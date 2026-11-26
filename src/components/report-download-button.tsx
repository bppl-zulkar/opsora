"use client";
import { useId, useState, type ReactNode } from "react";
import { announcePending } from "./interaction-lock";

export function ReportDownloadButton({
  href,
  children,
  className = "btn btn-primary",
  icon,
}: {
  href: string;
  children: ReactNode;
  className?: string;
  icon?: string;
}) {
  const [busy, setBusy] = useState(false);
  const pendingId = useId();
  async function download() {
    setBusy(true);
    announcePending(pendingId, true);
    try {
      const response = await fetch(href, { credentials: "same-origin" });
      if (!response.ok) throw new Error(await response.text());
      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") ?? "";
      const filename =
        disposition.match(/filename="?([^";]+)"?/i)?.[1] ?? "opsora-report";
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "Report download failed",
      );
    } finally {
      setBusy(false);
      announcePending(pendingId, false);
    }
  }
  return (
    <button
      type="button"
      className={className}
      onClick={download}
      disabled={busy}
      aria-busy={busy}
    >
      {busy ? (
        <span className="submit-spinner" aria-hidden="true" />
      ) : icon ? (
        <i className={`${icon} me-1`} aria-hidden="true" />
      ) : null}
      <span>{busy ? "Preparing…" : children}</span>
    </button>
  );
}
