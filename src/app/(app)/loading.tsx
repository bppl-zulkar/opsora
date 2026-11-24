import Image from "next/image";
export default function Loading() {
  return (
    <main className="page">
      <div className="loading-shell">
        <Image src="/opsora-logo.png" alt="" width={180} height={58} />
        <div>
          <span />
          <span />
          <span />
        </div>
        <p>Loading Opsora…</p>
      </div>
    </main>
  );
}
