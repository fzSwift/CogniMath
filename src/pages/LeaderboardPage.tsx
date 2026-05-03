import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Alert } from "../components/ui/Alert";
import { Card } from "../components/ui/Card";
import { supabase } from "../lib/supabase";
import type { ClassLeaderboardRow, StudentLeaderboardRow } from "../types";

type TabId = "weekly_students" | "monthly_students" | "term_students" | "weekly_classes" | "monthly_classes";

const tabs: { id: TabId; label: string; view: string; kind: "student" | "class" }[] = [
  { id: "weekly_students", label: "Students · week", view: "weekly_student_leaderboard", kind: "student" },
  { id: "monthly_students", label: "Students · month", view: "monthly_student_leaderboard", kind: "student" },
  { id: "term_students", label: "Students · term (4 mo)", view: "term_student_leaderboard", kind: "student" },
  { id: "weekly_classes", label: "Classes · week", view: "weekly_class_leaderboard", kind: "class" },
  { id: "monthly_classes", label: "Classes · month", view: "monthly_class_leaderboard", kind: "class" },
];

function num(v: number | string) {
  return typeof v === "number" ? v : Number(v);
}

export function LeaderboardPage() {
  const [tab, setTab] = useState<TabId>("weekly_students");
  const [studentRows, setStudentRows] = useState<StudentLeaderboardRow[]>([]);
  const [classRows, setClassRows] = useState<ClassLeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const active = tabs.find((t) => t.id === tab)!;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data, error: qErr } = await supabase.from(active.view).select("*").order("rank", { ascending: true });
    if (qErr) {
      if (qErr.message.includes(active.view) || qErr.code === "42P01") {
        setError(
          `${qErr.message} Run the latest supabase/schema.sql (leaderboard section) on your project.`,
        );
      } else {
        setError(qErr.message);
      }
      setStudentRows([]);
      setClassRows([]);
      setLoading(false);
      return;
    }
    if (active.kind === "student") {
      setStudentRows((data ?? []) as StudentLeaderboardRow[]);
      setClassRows([]);
    } else {
      setClassRows((data ?? []) as ClassLeaderboardRow[]);
      setStudentRows([]);
    }
    setLoading(false);
  }, [active.view, active.kind]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="text-lg font-semibold text-slate-900">Leaderboard</h2>
        <p className="mt-2 text-sm text-slate-600">
          Points come from <span className="font-medium">correct answers</span> (see schema): each row uses the question&apos;s base points × difficulty
          level (1–5). You only see classes you teach; ranks are computed from those rows for each time window.
        </p>
      </Card>

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg border px-3 py-2 text-sm font-medium ${
              tab === t.id ? "border-indigo-500 bg-indigo-50 text-indigo-900" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error ? <Alert variant="error">{error}</Alert> : null}

      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold text-slate-800">{active.label}</h3>
          <button type="button" className="text-sm text-indigo-800 underline" onClick={() => void load()}>
            Refresh
          </button>
        </div>
        {loading ? (
          <p className="text-sm text-slate-600">Loading…</p>
        ) : active.kind === "student" ? (
          studentRows.length === 0 ? (
            <p className="text-sm text-slate-600">No leaderboard rows yet for this window (need correct answers logged).</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-3">Rank (class)</th>
                    <th className="py-2 pr-3">Overall</th>
                    <th className="py-2 pr-3">Student</th>
                    <th className="py-2 pr-3">Class</th>
                    <th className="py-2 pr-3 text-right">Points</th>
                    <th className="py-2">Open</th>
                  </tr>
                </thead>
                <tbody>
                  {studentRows.map((r) => (
                    <tr key={`${r.class_id}-${r.student_id}`} className="border-b border-slate-100">
                      <td className="py-2 pr-3 font-medium">{num(r.rank)}</td>
                      <td className="py-2 pr-3 text-slate-600">{num(r.overall_rank)}</td>
                      <td className="py-2 pr-3">{r.student_name}</td>
                      <td className="py-2 pr-3">{r.class_name}</td>
                      <td className="py-2 pr-3 text-right font-medium">{num(r.total_points)}</td>
                      <td className="py-2">
                        <div className="flex flex-wrap gap-2 text-xs">
                          <Link to={`/student-results/${r.student_id}`} className="text-indigo-800 underline">
                            Student
                          </Link>
                          <Link to={`/classes/${r.class_id}`} className="text-indigo-800 underline">
                            Class
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : classRows.length === 0 ? (
          <p className="text-sm text-slate-600">No class totals yet for this window.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[24rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-3">Rank</th>
                  <th className="py-2 pr-3">Class</th>
                  <th className="py-2 pr-3 text-right">Total points</th>
                  <th className="py-2">Open</th>
                </tr>
              </thead>
              <tbody>
                {classRows.map((r) => (
                  <tr key={r.class_id} className="border-b border-slate-100">
                    <td className="py-2 pr-3 font-medium">{num(r.rank)}</td>
                    <td className="py-2 pr-3">{r.class_name}</td>
                    <td className="py-2 pr-3 text-right font-medium">{num(r.total_class_points)}</td>
                    <td className="py-2">
                      <Link to={`/classes/${r.class_id}`} className="text-xs text-indigo-800 underline">
                        Class detail
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
