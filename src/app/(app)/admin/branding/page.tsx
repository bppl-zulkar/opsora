import { requireOrganizationAdmin } from "@/lib/admin-context";
import { BrandingForm } from "@/components/branding-form";
export default async function Branding({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const message = await searchParams;
  const { admin, organizationId } = await requireOrganizationAdmin();
  const [{ data: org }, { data: settings }, { data: branding }] =
    await Promise.all([
      admin
        .from("organizations")
        .select("name")
        .eq("id", organizationId)
        .single(),
      admin
        .from("organization_settings")
        .select("website")
        .eq("organization_id", organizationId)
        .maybeSingle(),
      admin
        .from("organization_branding")
        .select("*")
        .eq("organization_id", organizationId)
        .maybeSingle(),
    ]);
  const assets = (branding?.assets ?? {}) as Record<string, string>;
  const urls: Record<string, string> = {};
  for (const [key, path] of Object.entries(assets)) {
    const { data } = await admin.storage
      .from("branding-assets")
      .createSignedUrl(path, 3600);
    if (data?.signedUrl) urls[key] = data.signedUrl;
  }
  return (
    <main className="page">
      <h1 className="h3 fw-bold">Brand identity</h1>
      <p className="text-secondary">
        Update company identity across the application without source-code
        changes.
      </p>
      {message.success && (
        <div className="alert alert-success">{message.success}</div>
      )}
      {message.error && (
        <div className="alert alert-danger">{message.error}</div>
      )}
      <BrandingForm
        initial={{
          companyName: org?.name ?? "Company",
          website: settings?.website ?? "",
          theme: branding?.theme ?? "light",
          assets,
          urls,
        }}
      />
    </main>
  );
}
