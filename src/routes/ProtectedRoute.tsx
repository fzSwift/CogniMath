import { useCallback, useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { bootstrapTeacherWorkspace } from "../lib/bootstrapTeacherWorkspace";

export function ProtectedRoute() {
  const { user, loading } = useAuth();
  const [prepDone, setPrepDone] = useState(false);
  const [prepError, setPrepError] = useState<string | null>(null);
  const [prepBusy, setPrepBusy] = useState(false);

  const runBootstrap = useCallback(async () => {
    setPrepError(null);
    setPrepBusy(true);
    const { error } = await bootstrapTeacherWorkspace();
    setPrepBusy(false);
    if (error) setPrepError(error);
    setPrepDone(true);
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setPrepDone(false);
      setPrepError(null);
      return;
    }

    let cancelled = false;
    setPrepDone(false);
    setPrepError(null);
    setPrepBusy(true);

    void bootstrapTeacherWorkspace().then(({ error }) => {
      if (cancelled) return;
      setPrepBusy(false);
      if (error) setPrepError(error);
      setPrepDone(true);
    });

    return () => {
      cancelled = true;
    };
  }, [user?.id, loading]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-slate-600">Loading session...</p>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (!prepDone || prepBusy) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-slate-600">Preparing your workspace...</p>
      </div>
    );
  }

  if (prepError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-100 p-6">
        <p className="max-w-md text-center text-slate-800">Could not finish setup: {prepError}</p>
        <button
          type="button"
          disabled={prepBusy}
          className="rounded bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 disabled:opacity-50"
          onClick={() => void runBootstrap()}
        >
          {prepBusy ? "Retrying…" : "Retry"}
        </button>
      </div>
    );
  }

  return <Outlet />;
}
