import Image from "next/image";
import Link from "next/link";
export default function Offline() {
  return (
    <main className="min-vh-100 d-flex align-items-center justify-content-center p-4 text-center">
      <div className="panel p-5" style={{ maxWidth: 520 }}>
        <Image src="/opsora-logo.png" alt="Opsora" width={220} height={72} />
        <h1 className="h3 fw-bold mt-3">You are offline</h1>
        <p className="text-secondary">
          Opsora could not reach the server. Check your connection, then try
          again. Secure server data is not cached on this device.
        </p>
        <Link className="btn btn-primary" href="/dashboard">
          Try again
        </Link>
      </div>
    </main>
  );
}
