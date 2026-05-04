import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { Alert } from "../components/ui/Alert";
import { Card } from "../components/ui/Card";
import { formatStudentWithClasses } from "../lib/studentDisplay";
import { supabase } from "../lib/supabase";
import type { StudentTeacherMetric } from "../types";

function fmtShortDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function StudentsPage() {
  const [rows, setRows] = useState<StudentTeacherMetric[]>([]);
  const [classes, setClasses] = useState<{ id: string; class_name: string }[]>([]);
  const [classFilterId, setClassFilterId] = useState("");
  const [classMemberIds, setClassMemberIds] = useState<Set<string> | null>(null);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [classLevel, setClassLevel] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"name" | "created" | "last_attempt">("name");
  const [showArchived, setShowArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [metricsHint, setMetricsHint] = useState("");
  const [createError, setCreateError] = useState("");
  const [createClassId, setCreateClassId] = useState("");
  const [createBusy, setCreateBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadMetrics = useCallback(async () => {
    setLoading(true);
    setError("");
    setMetricsHint("");
    const { data, error: qErr } = await supabase.from("student_teacher_metrics").select("*");
    if (qErr) {
      if (qErr.message.includes("student_teacher_metrics") || qErr.code === "42P01") {
        setMetricsHint("Run supabase/schema.sql or upgrade_students_features.sql so student_teacher_metrics exists.");
      }
      setError(qErr.message);
      setRows([]);
      setLoading(false);
      return;
    }
    setRows((data ?? []) as StudentTeacherMetric[]);
    setLoading(false);
  }, []);

  const loadClasses = useCallback(async () => {
    const { data } = await supabase.from("classes").select("id, class_name").is("archived_at", null).order("class_name");
    setClasses((data ?? []) as { id: string; class_name: string }[]);
  }, []);

  useEffect(() => {
    void loadMetrics();
    void loadClasses();
  }, [loadMetrics, loadClasses]);

  useEffect(() => {
    const loadMembers = async () => {
      if (!classFilterId) {
        setClassMemberIds(null);
        return;
      }
      const { data, error: e } = await supabase.from("class_students").select("student_id").eq("class_id", classFilterId);
      if (e) {
        console.error(e);
        setClassMemberIds(new Set());
        return;
      }
      setClassMemberIds(new Set((data ?? []).map((r: { student_id: string }) => r.student_id)));
    };
    void loadMembers();
  }, [classFilterId]);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setCreateError("");
    if (!createClassId) {
      setCreateError("Choose a class to enroll the new student.");
      return;
    }
    const u = username.trim().toLowerCase();
    if (u.length < 2) {
      setCreateError("Username must be at least 2 characters.");
      return;
    }
    setCreateBusy(true);
    const { error: rpcErr } = await supabase.rpc("create_student_for_class", {
      p_class_id: createClassId,
      p_full_name: fullName.trim(),
      p_username: u,
      p_class_level: classLevel.trim() || null,
    });
    setCreateBusy(false);
    if (rpcErr) {
      setCreateError(rpcErr.message);
      return;
    }
    setFullName("");
    setUsername("");
    setClassLevel("");
    void loadMetrics();
    void loadClasses();
  };

  const setArchived = async (studentId: string, archived: boolean) => {
    setBusyId(studentId);
    const { error: uErr } = await supabase.from("students").update({ archived_at: archived ? new Date().toISOString() : null }).eq("id", studentId);
    setBusyId(null);
    if (uErr) {
      setError(uErr.message);
      return;
    }
    void loadMetrics();
  };

  const filteredSorted = useMemo(() => {
    let list = rows.filter((r) => showArchived || !r.archived_at);
    if (classMemberIds) {
      list = list.filter((r) => classMemberIds.has(r.student_id));
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((r) => {
        const classesStr = (r.enrolled_class_names ?? "").toLowerCase();
        return r.full_name.toLowerCase().includes(q) || r.username.toLowerCase().includes(q) || classesStr.includes(q);
      });
    }
    const copy = [...list];
    copy.sort((a, b) => {
      if (sort === "name") return a.full_name.localeCompare(b.full_name);
      if (sort === "created") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      const tb = b.last_activity_at ? new Date(b.last_activity_at).getTime() : 0;
      const ta = a.last_activity_at ? new Date(a.last_activity_at).getTime() : 0;
      if (tb !== ta) return tb - ta;
      return a.full_name.localeCompare(b.full_name);
    });
    return copy;
  }, [rows, showArchived, classMemberIds, search, sort]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-slate-600">
        Loading students…
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {error ? (
        <div className="lg:col-span-3 space-y-2">
          <Alert variant="error">{error}</Alert>
          {metricsHint ? <Alert variant="info">{metricsHint}</Alert> : null}
        </div>
      ) : null}
      <Card>
        <h3 className="mb-3 font-semibold">Create Student</h3>
        {createError ? (
          <div className="mb-3">
            <Alert variant="error">{createError}</Alert>
          </div>
        ) : null}
        {classes.length === 0 ? (
          <p className="text-sm text-slate-600">
            Add at least one class from{" "}
            <Link to="/classes" className="font-medium text-indigo-700 underline hover:text-indigo-900">
              Classes
            </Link>{" "}
            before creating students.
          </p>
        ) : (
          <form onSubmit={create} className="space-y-3">
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">Class</span>
              <select
                className="w-full rounded border p-2"
                value={createClassId}
                onChange={(e) => setCreateClassId(e.target.value)}
                required
              >
                <option value="">Select class…</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.class_name}
                  </option>
                ))}
              </select>
            </label>
            <input className="w-full rounded border p-2" placeholder="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            <input className="w-full rounded border p-2" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} required />
            <input className="w-full rounded border p-2" placeholder="Class level (optional)" value={classLevel} onChange={(e) => setClassLevel(e.target.value)} />
            <button type="submit" disabled={createBusy} className="rounded bg-indigo-600 px-4 py-2 text-white disabled:opacity-50">
              {createBusy ? "Saving…" : "Save student"}
            </button>
          </form>
        )}
        <p className="mt-3 text-xs text-slate-500">Students are enrolled in the class you pick here and show up in your list immediately.</p>
      </Card>
      <Card className="lg:col-span-2">
        <h3 className="mb-3 font-semibold">Find & sort</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Search</span>
            <input className="w-full rounded border p-2" placeholder="Name or username" value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Class filter</span>
            <select className="w-full rounded border p-2" value={classFilterId} onChange={(e) => setClassFilterId(e.target.value)}>
              <option value="">All students (your classes)</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.class_name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Sort by</span>
            <select className="w-full rounded border p-2" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
              <option value="name">Name (A–Z)</option>
              <option value="created">Date created (newest)</option>
              <option value="last_attempt">Last attempt (recent first)</option>
            </select>
          </label>
          <label className="flex items-end gap-2 pb-2 text-sm text-slate-700">
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
            Show archived students
          </label>
        </div>
      </Card>
      <div className="space-y-2 lg:col-span-3">
        {filteredSorted.length === 0 ? (
          <p className="text-sm text-slate-600">No students match your filters.</p>
        ) : (
          filteredSorted.map((r) => {
            const last = fmtShortDate(r.last_activity_at);
            const archived = Boolean(r.archived_at);
            return (
              <div
                key={r.student_id}
                className={`flex flex-col gap-2 rounded-xl border bg-white p-3 text-sm sm:flex-row sm:items-center sm:justify-between ${archived ? "border-amber-200 bg-amber-50/40" : ""}`}
              >
                <Link to={`/student-results/${r.student_id}`} className="min-w-0 flex-1 hover:text-indigo-800">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
                    <span className="font-semibold">{formatStudentWithClasses(r.full_name, r.enrolled_class_names)}</span>
                    <span className="text-slate-500">@{r.username}</span>
                    {archived ? <span className="rounded bg-amber-100 px-1.5 text-xs text-amber-900">Archived</span> : null}
                  </div>
                  <p className="mt-1 text-xs text-slate-600">Last active {last}</p>
                </Link>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {archived ? (
                    <button
                      type="button"
                      disabled={busyId === r.student_id}
                      onClick={() => void setArchived(r.student_id, false)}
                      className="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-50 disabled:opacity-50"
                    >
                      Restore
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busyId === r.student_id}
                      onClick={() => void setArchived(r.student_id, true)}
                      className="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-50 disabled:opacity-50"
                    >
                      Archive
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
