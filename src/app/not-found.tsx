import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-vh-100 d-flex align-items-center justify-content-center text-center">
      <div>
        <div className="display-1 fw-bold text-primary">404</div>
        <h1>Page not found</h1>
        <Link className="btn btn-primary mt-3" href="/dashboard">
          Return to dashboard
        </Link>
      </div>
    </main>
  );
}
