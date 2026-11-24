import { createClient } from "@/lib/supabase/server";
import { formatIST } from "@/lib/format";
export default async function Notifications() {
  const s = await createClient();
  const { data } = await s
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  const n = data ?? [];
  return (
    <main className="page">
      <h1 className="h3 fw-bold">Notifications</h1>
      <div className="panel">
        {n.map((x) => (
          <div className="p-3 border-bottom" key={x.id}>
            <strong>{x.title}</strong>
            <p className="mb-1">{x.body}</p>
            <small className="text-secondary">{formatIST(x.created_at)}</small>
          </div>
        ))}
        {!n.length && (
          <div className="p-5 text-center text-secondary">
            You are all caught up.
          </div>
        )}
      </div>
    </main>
  );
}
