import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Alert } from "../components/ui/Alert";
import { Card } from "../components/ui/Card";
import { PassFailPie } from "../components/charts/PassFailPie";
import { PerformanceChart } from "../components/charts/PerformanceChart";
import { StatCard } from "../components/ui/StatCard";
import { supabase } from "../lib/supabase";
import type { ClassDashboardRow, DashboardStats, StudentAttemptWithLabels } from "../types";

type DatePreset = "all" | "7" | "30";

function endOfTodayUtcIso(): string {
  const d = new Date();
  d.setUTCHours(23, 59, 59, 999);
  return d.toISOString();
}

function startOfDayUtcDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

function boundsForPreset(p: DatePreset): { from: string | null; to: string | null } {
  if (p === "all") return { from: null, to: null };
  if (p === "7") return { from: startOfDayUtcDaysAgo(7), to: endOfTodayUtcIso() };
  return { from: startOfDayUtcDaysAgo(30), to: endOfTodayUtcIso() };
}

function presetLabel(p: DatePreset): string {
  if (p === "all") return "All time";
  if (p === "7") return "Last 7 days";
  return "Last 30 days";
}

function shortDate(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function unwrapQsNested(q: StudentAttemptWithLabels["question_sets"]) {
  if (!q) return null;
  return Array.isArray(q) ? q[0] : q;
}

async function fetchAttemptRowsInRange(
  from: string | null,
  to: string | null,
): Promise<{ percentage: number; passed: boolean }[]> {
  const pageSize = 1000;
  const out: { percentage: number; passed: boolean }[] = [];
  let start = 0;
  for (;;) {
    let q = supabase.from("student_attempts").select("percentage, passed").order("id", { ascending: true });
    if (from) q = q.gte("completed_at", from);
    if (to) q = q.lte("completed_at", to);
    const { data, error } = await q.range(start, start + pageSize - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as { percentage: number | string; passed: boolean }[];
    for (const r of rows) {
      out.push({ percentage: Number(r.percentage), passed: r.passed });
    }
    if (rows.length < pageSize) break;
    start += pageSize;
  }
  return out;
}

export function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalClasses: 0,
    totalStudents: 0,
    totalQuestionSets: 0,
    averagePerformance: 0,
  });
  const [attemptCountInRange, setAttemptCountInRange] = useState(0);
  const [passInRange, setPassInRange] = useState(0);
  const [failInRange, setFailInRange] = useState(0);
  const [attempts, setAttempts] = useState<StudentAttemptWithLabels[]>([]);
  const [rangePreset, setRangePreset] = useState<DatePreset>("30");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dashRows, setDashRows] = useState<ClassDashboardRow[] | null>(null);
  const [dashRowsError, setDashRowsError] = useState(false);

  const { from, to } = useMemo(() => boundsForPreset(rangePreset), [rangePreset]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    let attemptStats: { percentage: number; passed: boolean }[] = [];
    try {
      attemptStats = await fetchAttemptRowsInRange(from, to);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load attempt stats.");
      setLoading(false);
      return;
    }

    let q = supabase
      .from("student_attempts")
      .select("id, student_id, percentage, passed, completed_at, students(full_name), question_sets(id, title)")
      .order("completed_at", { ascending: false })
      .limit(8);
    if (from) q = q.gte("completed_at", from);
    if (to) q = q.lte("completed_at", to);
    const [classRes, studentRes, setRes, recentRes] = await Promise.all([
      supabase.from("classes").select("*", { count: "exact", head: true }).is("archived_at", null),
      supabase.from("students").select("*", { count: "exact", head: true }).is("archived_at", null),
      supabase.from("question_sets").select("*", { count: "exact", head: true }),
      q,
    ]);

    const err =
      classRes.error?.message ||
      studentRes.error?.message ||
      setRes.error?.message ||
      recentRes.error?.message;

    if (err) {
      setError(err);
      setLoading(false);
      return;
    }

    const dashRes = await supabase.from("class_dashboard_row").select("*");
    if (dashRes.error) {
      setDashRows(null);
      setDashRowsError(true);
    } else {
      setDashRows((dashRes.data ?? []) as ClassDashboardRow[]);
      setDashRowsError(false);
    }

    const rows = attemptStats;
    const n = rows.length;
    const avg = n ? rows.reduce((s, r) => s + r.percentage, 0) / n : 0;
    const passN = rows.filter((r) => r.passed).length;
    const failN = n - passN;

    setAttemptCountInRange(n);
    setPassInRange(passN);
    setFailInRange(failN);
    setStats({
      totalClasses: classRes.count ?? 0,
      totalStudents: studentRes.count ?? 0,
      totalQuestionSets: setRes.count ?? 0,
      averagePerformance: Number(avg.toFixed(2)),
    });
    setAttempts((recentRes.data ?? []) as unknown as StudentAttemptWithLabels[]);
    setLoading(false);
  }, [from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [load]);

  const chartData = useMemo(
    () =>
      attempts.map((a) => {
        const pct = Number(a.percentage);
        const qs = unwrapQsNested(a.question_sets);
        const setTitle = qs?.title ?? "Set";
        const shortTitle = setTitle.length > 18 ? `${setTitle.slice(0, 16)}…` : setTitle;
        const d = shortDate(a.completed_at);
        return {
          label: `${d} · ${shortTitle} · ${pct}%`,
          value: pct,
        };
      }),
    [attempts],
  );

  const attention = useMemo(() => {
    if (!dashRows?.length) return null;
    const pendingTotal = dashRows.reduce((s, r) => s + (r.pending_join_count ?? 0), 0);
    const firstPending = dashRows.find((r) => (r.pending_join_count ?? 0) > 0 && !r.archived_at);
    const fourteenAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
    const stale = dashRows
      .filter((r) => !r.archived_at && (r.student_count ?? 0) > 0)
      .filter((r) => {
        if (!r.last_activity_at) return true;
        return new Date(r.last_activity_at).getTime() < fourteenAgo;
      })
      .sort((a, b) => {
        const ta = a.last_activity_at ? new Date(a.last_activity_at).getTime() : 0;
        const tb = b.last_activity_at ? new Date(b.last_activity_at).getTime() : 0;
        return ta - tb;
      });
    const firstStale = stale[0];
    const activeClasses = dashRows.filter((r) => !r.archived_at && (r.student_count ?? 0) > 0);
    const lowest = activeClasses.length
      ? [...activeClasses].sort((a, b) => Number(a.avg_score_pct) - Number(b.avg_score_pct))[0]
      : null;

    return { pendingTotal, firstPending, firstStale, lowest };
  }, [dashRows]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-slate-600">
        Loading dashboard…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error ? <Alert variant="error">{error}</Alert> : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Link
            to="/classes"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-indigo-800 hover:border-indigo-300 hover:bg-indigo-50"
          >
            Classes
          </Link>
          <Link
            to="/students"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-indigo-800 hover:border-indigo-300 hover:bg-indigo-50"
          >
            Students
          </Link>
          <Link
            to="/question-sets"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-indigo-800 hover:border-indigo-300 hover:bg-indigo-50"
          >
            Question sets
          </Link>
          <Link
            to="/analytics"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-indigo-800 hover:border-indigo-300 hover:bg-indigo-50"
          >
            Analytics
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm text-slate-600">
            Period:{" "}
            <select
              className="ml-1 rounded border border-slate-300 bg-white p-1.5 text-sm"
              value={rangePreset}
              onChange={(e) => setRangePreset(e.target.value as DatePreset)}
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="all">All time</option>
            </select>
          </label>
          <button
            type="button"
            className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            onClick={() => void load()}
          >
            Refresh
          </button>
        </div>
      </div>

      {attention &&
      (attention.pendingTotal > 0 || attention.firstStale || (attention.lowest && Number(attention.lowest.attempt_count ?? 0) > 0)) ? (
        <Card>
          <h3 className="mb-2 font-semibold text-slate-800">Needs attention</h3>
          <ul className="space-y-2 text-sm text-slate-700">
            {attention.pendingTotal > 0 && attention.firstPending ? (
              <li>
                <span className="font-medium text-amber-900">{attention.pendingTotal} pending join request(s).</span>{" "}
                <Link className="text-indigo-800 underline" to={`/classes/${attention.firstPending.id}#join-requests`}>
                  Review in {attention.firstPending.class_name}
                </Link>
              </li>
            ) : null}
            {attention.firstStale ? (
              <li>
                <span className="font-medium text-slate-800">No recent activity (14+ days):</span>{" "}
                <Link className="text-indigo-800 underline" to={`/classes/${attention.firstStale.id}`}>
                  {attention.firstStale.class_name}
                </Link>
              </li>
            ) : null}
            {attention.lowest && Number(attention.lowest.attempt_count ?? 0) > 0 ? (
              <li>
                <span className="font-medium text-slate-800">Lowest avg score among active classes:</span>{" "}
                <Link className="text-indigo-800 underline" to={`/classes/${attention.lowest.id}`}>
                  {attention.lowest.class_name}
                </Link>{" "}
                ({Number(attention.lowest.avg_score_pct).toFixed(1)}%)
              </li>
            ) : null}
          </ul>
        </Card>
      ) : dashRowsError ? (
        <Alert variant="info">
          Run <span className="font-mono">upgrade_class_features.sql</span> for class dashboard data and needs-attention hints.
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total classes" value={stats.totalClasses} hint="Active (not archived)" />
        <StatCard title="Total students" value={stats.totalStudents} hint="Active (not archived)" />
        <StatCard title="Question sets" value={stats.totalQuestionSets} />
        <StatCard
          title={`Avg score (${presetLabel(rangePreset).toLowerCase()})`}
          value={`${stats.averagePerformance}%`}
          hint={
            attemptCountInRange
              ? `Across ${attemptCountInRange} attempt${attemptCountInRange === 1 ? "" : "s"} in range (exact count).`
              : "No attempts in this period."
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h3 className="mb-1 font-semibold text-slate-800">Recent attempts · scores</h3>
          <p className="mb-3 text-xs text-slate-500">
            Last 8 attempts in {presetLabel(rangePreset).toLowerCase()}. Labels: date · question set · score.
          </p>
          <PerformanceChart
            data={chartData}
            slantedLabels
            emptyLabel={`No attempts in ${presetLabel(rangePreset).toLowerCase()}.`}
          />
        </Card>
        <Card>
          <h3 className="mb-1 font-semibold text-slate-800">Pass / fail (same period)</h3>
          <p className="mb-3 text-xs text-slate-500">All attempts in the selected period ({attemptCountInRange} total).</p>
          <PassFailPie pass={passInRange} fail={failInRange} />
        </Card>
      </div>

      <Card>
        <h3 className="mb-1 font-semibold text-slate-800">Recent attempts</h3>
        <p className="mb-3 text-xs text-slate-500">Up to 8 most recent in {presetLabel(rangePreset).toLowerCase()}. Links open student results or the question set.</p>
        {attempts.length === 0 ? (
          <p className="text-sm text-slate-600">No recent attempts in this period.</p>
        ) : (
          <div className="space-y-2 text-sm">
            {attempts.map((attempt) => {
              const sid = attempt.student_id;
              const qso = unwrapQsNested(attempt.question_sets);
              const qsid = qso?.id;
              const name = attempt.students?.full_name ?? "Student";
              const title = qso?.title ?? "—";
              const when = shortDate(attempt.completed_at);
              return (
                <div
                  key={attempt.id}
                  className="flex flex-col gap-2 rounded border border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <span className="text-slate-500">{when}</span> · <span className="font-medium">{name}</span> · {title}
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className={attempt.passed ? "font-semibold text-green-700" : "font-semibold text-red-700"}>{attempt.percentage}%</span>
                    <div className="flex gap-2 text-xs">
                      {sid ? (
                        <Link className="font-medium text-indigo-800 underline" to={`/student-results/${sid}`}>
                          Student
                        </Link>
                      ) : null}
                      {qsid ? (
                        <Link className="font-medium text-indigo-800 underline" to={`/question-sets/${qsid}`}>
                          Set
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
