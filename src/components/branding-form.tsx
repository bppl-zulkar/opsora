"use client";
import { createClient } from "@/lib/supabase/client";
import {
  createBrandingUpload,
  saveBranding,
} from "@/app/(app)/admin/branding/actions";
import { useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import { announcePending } from "./interaction-lock";
const assetTypes = ["main_logo"] as const;
export function BrandingForm({
  initial,
}: {
  initial: {
    companyName: string;
    website: string;
    primaryColor: string;
    secondaryColor: string;
    sidebarColor: string;
    theme: string;
    assets: Record<string, string>;
    urls: Record<string, string>;
  };
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [previews, setPreviews] = useState(initial.urls);
  const submitting = useRef(false);
  const pendingId = useId();

  useEffect(() => {
    announcePending(pendingId, busy);
    return () => announcePending(pendingId, false);
  }, [busy, pendingId]);

  async function submit(formData: FormData) {
    if (submitting.current) return;
    const file = formData.get("main_logo") as File;
    if (file?.size > 5 * 1024 * 1024) {
      return setMessage("main_logo exceeds 5 MB");
    }
    if (
      file?.size &&
      ![
        "image/png",
        "image/jpeg",
        "image/webp",
        "image/svg+xml",
        "image/x-icon",
      ].includes(file.type)
    ) {
      return setMessage("main_logo has an unsupported format");
    }

    submitting.current = true;
    setBusy(true);
    setMessage("");
    const supabase = createClient();
    const assets = { ...initial.assets };
    try {
      for (const type of assetTypes) {
        const selected = formData.get(type) as File;
        if (!selected?.size) continue;
        const signed = await createBrandingUpload(
          `${type}-${selected.name}`,
        );
        const upload = await supabase.storage
          .from("branding-assets")
          .uploadToSignedUrl(signed.path, signed.token, selected, {
            contentType: selected.type,
          });
        if (upload.error) throw upload.error;
        assets[type] = signed.path;
        setPreviews((x) => ({
          ...x,
          [type]: URL.createObjectURL(selected),
        }));
      }
    } catch (error) {
      submitting.current = false;
      setBusy(false);
      setMessage(
        error instanceof Error ? error.message : "Branding upload failed",
      );
      return;
    }

    formData.set("assets", JSON.stringify(assets));
    try {
      await saveBranding(formData);
    } catch (error) {
      submitting.current = false;
      setBusy(false);
      setMessage(
        error instanceof Error ? error.message : "Could not save branding",
      );
    }
  }
  return (
    <form action={submit} className="panel p-4" aria-busy={busy}>
      <fieldset disabled={busy} className="form-fieldset">
        <div className="row g-3">
          <div className="col-md-6">
            <label className="form-label">Company name</label>
            <input
              name="company_name"
              className="form-control"
              defaultValue={initial.companyName}
              required
            />
          </div>
          <div className="col-md-6">
            <label className="form-label">Company website</label>
            <input
              name="website"
              type="url"
              className="form-control"
              defaultValue={initial.website}
            />
          </div>
          <div className="col-sm-4">
            <label className="form-label">Primary colour</label>
            <input
              name="primary_color"
              type="color"
              className="form-control form-control-color w-100"
              defaultValue={initial.primaryColor}
            />
          </div>
          <div className="col-sm-4">
            <label className="form-label">Secondary colour</label>
            <input
              name="secondary_color"
              type="color"
              className="form-control form-control-color w-100"
              defaultValue={initial.secondaryColor}
            />
          </div>
          <div className="col-sm-4">
            <label className="form-label">Sidebar colour</label>
            <input
              name="sidebar_color"
              type="color"
              className="form-control form-control-color w-100"
              defaultValue={initial.sidebarColor}
            />
          </div>
          <div className="col-md-4">
            <label className="form-label">Default theme</label>
            <select
              name="theme"
              className="form-select"
              defaultValue={initial.theme}
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="system">Device preference</option>
            </select>
          </div>
          <div className="col-12">
            <hr />
            <h2 className="h5">Company logo</h2>
            <p className="text-secondary">
              Upload one company logo. It appears beside the permanent Opsora
              product logo. PNG, JPG, WebP or SVG; maximum 5 MB.
            </p>
          </div>
          {assetTypes.map((type) => (
            <div className="col-md-6" key={type}>
              <label className="form-label">Company logo</label>
              <div className="brand-upload-preview">
                <Image
                  src={previews[type] || "/opsora-logo.png"}
                  alt="Company logo preview"
                  width={160}
                  height={88}
                  unoptimized
                />
              </div>
              <input
                name={type}
                type="file"
                className="form-control"
                accept=".png,.jpg,.jpeg,.webp,.svg,.ico"
              />
            </div>
          ))}
          <input type="hidden" name="assets" value="{}" />
          <div className="col-12">
            <button
              disabled={busy}
              className="btn btn-primary"
              aria-busy={busy}
            >
              {busy && <span className="submit-spinner" aria-hidden="true" />}
              <span aria-live="polite">
                {busy ? "Uploading and saving…" : "Save branding"}
              </span>
            </button>
            {message && (
              <span role="alert" className="text-danger ms-3">
                {message}
              </span>
            )}
          </div>
        </div>
      </fieldset>
    </form>
  );
}
