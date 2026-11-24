"use client";
import { createClient } from "@/lib/supabase/client";
import {
  createBrandingUpload,
  saveBranding,
} from "@/app/(app)/admin/branding/actions";
import { useState } from "react";
import Image from "next/image";
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
  async function submit(formData: FormData) {
    setBusy(true);
    setMessage("");
    const supabase = createClient();
    const assets = { ...initial.assets };
    for (const type of assetTypes) {
      const file = formData.get(type) as File;
      if (!file?.size) continue;
      if (file.size > 5 * 1024 * 1024) {
        setBusy(false);
        return setMessage(`${type} exceeds 5 MB`);
      }
      if (
        ![
          "image/png",
          "image/jpeg",
          "image/webp",
          "image/svg+xml",
          "image/x-icon",
        ].includes(file.type)
      ) {
        setBusy(false);
        return setMessage(`${type} has an unsupported format`);
      }
      const signed = await createBrandingUpload(`${type}-${file.name}`);
      const upload = await supabase.storage
        .from("branding-assets")
        .uploadToSignedUrl(signed.path, signed.token, file, {
          contentType: file.type,
        });
      if (upload.error) {
        setBusy(false);
        return setMessage(upload.error.message);
      }
      assets[type] = signed.path;
      setPreviews((x) => ({ ...x, [type]: URL.createObjectURL(file) }));
    }
    formData.set("assets", JSON.stringify(assets));
    await saveBranding(formData);
  }
  return (
    <form action={submit} className="panel p-4">
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
          <button disabled={busy} className="btn btn-primary">
            {busy ? "Uploading and saving…" : "Save branding"}
          </button>
          {message && <span className="text-danger ms-3">{message}</span>}
        </div>
      </div>
    </form>
  );
}
