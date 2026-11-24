import { redirect } from "next/navigation";
export default async function LegacyRoute({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const first = slug[0];
  if (first === "admin") redirect("/admin");
  if (first === "reports") redirect("/reports");
  if (first === "settings") redirect("/admin");
  if (first === "profile") redirect("/dashboard");
  if (first === "platform") redirect("/platform/organizations");
  redirect("/dashboard");
}
