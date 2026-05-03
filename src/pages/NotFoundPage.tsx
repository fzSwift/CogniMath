import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-100">
      <h1 className="text-3xl font-bold text-slate-800">Page not found</h1>
      <Link className="mt-4 text-indigo-700" to="/dashboard">Go to dashboard</Link>
    </div>
  );
}
