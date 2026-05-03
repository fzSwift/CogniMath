import { Outlet } from "react-router-dom";
import { Alert } from "../ui/Alert";
import { isSupabaseConfigured } from "../../lib/supabase";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function AppLayout() {
  return (
    <div className="min-h-screen bg-slate-50 lg:flex">
      <Sidebar />
      <div className="flex-1">
        <Topbar />
        <main className="p-6">
          {!isSupabaseConfigured ? (
            <div className="mb-6">
              <Alert variant="info">
                Add <code className="rounded bg-white px-1">VITE_SUPABASE_URL</code> and{" "}
                <code className="rounded bg-white px-1">VITE_SUPABASE_ANON_KEY</code> to <code className="rounded bg-white px-1">.env</code> (see{" "}
                <code className="rounded bg-white px-1">.env.example</code>) then restart the dev server.
              </Alert>
            </div>
          ) : null}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
