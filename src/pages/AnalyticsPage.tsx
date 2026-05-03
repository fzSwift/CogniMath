import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Alert } from "../components/ui/Alert";
import { Card } from "../components/ui/Card";
import { PassFailPie } from "../components/charts/PassFailPie";
import { PerformanceChart } from "../components/charts/PerformanceChart";
import type { PerformanceChartItem } from "../components/charts/PerformanceChart";
import { supabase } from "../lib/supabase";
import type { ClassPerformanceViewRow, WeakTopicsViewRow } from "../types";

type DateRangePreset = "all" | "7" | "30" | "custom";

interface QuestionSetsNested {
  id: string;
  title: string;
  class_id: string;
  classes?: { class_name: string } | { class_name: string }[] | null;
}

interface AttemptRow {
  percentage: number | string;
  passed: boolean;
  completed_at: string;
  difficulty_level: number;
  question_sets?: QuestionSetsNested | QuestionSetsNested[] | null;
}

function unwrapQs(raw: AttemptRow["question_sets"]): QuestionSetsNested | null {
  if (!raw) return null;
  return Array.isArray(raw) ? raw[0] ?? null : raw;
}

function classNameFromQs(qs: QuestionSetsNested | null): string {
  if (!qs) return "Unknown class";
  const c = qs.classes;
  if (!c) return "Unknown class";
  const row = Array.isArray(c) ? c[0] : c;
  return row?.class_name ?? "Unknown class";
}

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

function customRangeIso(fromYmd: string, toYmd: string): { from: string; to: string } | null {
  if (!fromYmd || !toYmd) return null;
  const from = `${fromYmd}T00:00:00.000Z`;
  const to = `${toYmd}T23:59:59.999Z`;
  if (new Date(from) > new Date(to)) return null;
  return { from, to };
}

function aggregateClassBarsFromAttempts(rows: AttemptRow[]): PerformanceChartItem[] {
  const m = new Map<string, number[]>();
  for (const a of rows) {
    const name = classNameFromQs(unwrapQs(a.question_sets));
    const arr = m.get(name) ?? [];
    arr.push(Number(a.percentage));
    m.set(name, arr);
  }
  return [...m.entries()].map(([label, vals]) => ({
    label,
    value: Number((vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(2)),
  }));
}

function difficultyBarsFromAttempts(rows: AttemptRow[]): PerformanceChartItem[] {
  const m = new Map<number, number[]>();
  for (const r of rows) {
    const lv = r.difficulty_level;
    if (lv < 1 || lv > 5) continue;
    const arr = m.get(lv) ?? [];
    arr.push(Number(r.percentage));
    m.set(lv, arr);
  }
  return [...m.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([lv, vals]) => ({
      label: `Lv ${lv}`,
      value: Number((vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(2)),
    }));
}

function weekBucketsFromAttempts(rows: AttemptRow[]): PerformanceChartItem[] {
  const startOfWeekMonday = (d: Date) => {
    const x = new Date(d);
    const day = x.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    x.setDate(x.getDate() + diff);
    x.setHours(0, 0, 0, 0);
    return x;
  };
  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  const m = new Map<string, { count: number; sort: number }>();
  for (const a of rows) {
    if (!a.completed_at) continue;
    const mon = startOfWeekMonday(new Date(a.completed_at));
    const key = fmt(mon);
    const prev = m.get(key) ?? { count: 0, sort: mon.getTime() };
    prev.count += 1;
    m.set(key, prev);
  }
  return [...m.entries()]
    .sort((a, b) => a[1].sort - b[1].sort)
    .map(([label, v]) => ({ label: `Week of ${label}`, value: v.count }));
}

function escapeCsvCell(v: string | number): string {
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadCsv(filename: string, lines: string[][]) {
  const body = lines.map((row) => row.map(escapeCsvCell).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

interface TopicRollup {
  class_id: string;
  class_name: string;
  topic: string;
  avgScore: number;
  wrongSum: number;
  studentRows: number;
}

function rollupWeakTopics(weakRows: WeakTopicsViewRow[], classNameById: Map<string, string>): TopicRollup[] {
  const m = new Map<string, { sumScore: number; n: number; wrongSum: number; class_id: string }>();
  for (const w of weakRows) {
    const key = `${w.class_id}\t${w.topic}`;
    const prev = m.get(key) ?? { sumScore: 0, n: 0, wrongSum: 0, class_id: w.class_id };
    prev.sumScore += Number(w.average_score);
    prev.n += 1;
    prev.wrongSum += Number(w.wrong_answers_count);
    m.set(key, prev);
  }
  return [...m.entries()].map(([key, v]) => {
    const topic = key.split("\t")[1] ?? key;
    return {
      class_id: v.class_id,
      class_name: classNameById.get(v.class_id) ?? v.class_id,
      topic,
      avgScore: v.n ? v.sumScore / v.n : 0,
      wrongSum: v.wrongSum,
      studentRows: v.n,
    };
  });
}

function topRecommendations(rolled: TopicRollup[], take: number): TopicRollup[] {
  return [...rolled]
    .sort((a, b) => {
      if (a.avgScore !== b.avgScore) return a.avgScore - b.avgScore;
      return b.wrongSum - a.wrongSum;
    })
    .slice(0, take);
}

export function AnalyticsPage() {
  const [searchParams] = useSearchParams();
  const classId = searchParams.get("classId") ?? "";

  const [rangePreset, setRangePreset] = useState<DateRangePreset>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const [classPerformance, setClassPerformance] = useState<ClassPerformanceViewRow[]>([]);
  const [weakTopics, setWeakTopics] = useState<WeakTopicsViewRow[]>([]);
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const dateBounds = useMemo(() => {
    if (rangePreset === "all") return { from: null as string | null, to: null as string | null };
    if (rangePreset === "7") return { from: startOfDayUtcDaysAgo(7), to: endOfTodayUtcIso() };
    if (rangePreset === "30") return { from: startOfDayUtcDaysAgo(30), to: endOfTodayUtcIso() };
    const c = customRangeIso(customFrom, customTo);
    return c ?? { from: null, to: null };
  }, [rangePreset, customFrom, customTo]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    let attQuery = supabase
      .from("student_attempts")
      .select("percentage, passed, completed_at, difficulty_level, question_sets ( id, title, class_id, classes ( class_name ) )")
      .order("completed_at", { ascending: false });
    if (classId) attQuery = attQuery.eq("question_sets.class_id", classId);
    if (dateBounds.from) attQuery = attQuery.gte("completed_at", dateBounds.from);
    if (dateBounds.to) attQuery = attQuery.lte("completed_at", dateBounds.to);

    const [perf, weak, att] = await Promise.all([
      supabase.from("class_performance_view").select("*"),
      supabase.from("weak_topics_view").select("*"),
      attQuery,
    ]);
    const err = perf.error?.message || weak.error?.message || att.error?.message;
    if (err) {
      setError(err);
      setLoading(false);
      return;
    }
    setClassPerformance((perf.data ?? []) as ClassPerformanceViewRow[]);
    setWeakTopics((weak.data ?? []) as WeakTopicsViewRow[]);
    setAttempts((att.data ?? []) as unknown as AttemptRow[]);
    setLoading(false);
  }, [classId, dateBounds.from, dateBounds.to]);

  useEffect(() => {
    void load();
  }, [load]);

  const perfRows = useMemo(
    () => (classId ? classPerformance.filter((r) => r.class_id === classId) : classPerformance),
    [classPerformance, classId],
  );
  const weakRows = useMemo(() => (classId ? weakTopics.filter((w) => w.class_id === classId) : weakTopics), [weakTopics, classId]);

  const classNameById = useMemo(() => {
    const m = new Map<string, string>();
    classPerformance.forEach((r) => m.set(r.class_id, r.class_name));
    return m;
  }, [classPerformance]);

  const topicRollup = useMemo(() => rollupWeakTopics(weakRows, classNameById), [weakRows, classNameById]);
  const topicRollupSorted = useMemo(
    () => [...topicRollup].sort((a, b) => a.avgScore - b.avgScore || b.wrongSum - a.wrongSum).slice(0, 10),
    [topicRollup],
  );
  const recommendations = useMemo(() => topRecommendations(topicRollup, 3), [topicRollup]);

  const pass = attempts.filter((a) => a.passed).length;
  const fail = attempts.filter((a) => !a.passed).length;

  const bySetDetailed = useMemo(() => {
    const map = new Map<string, { scores: number[]; passed: boolean[]; setId: string; title: string }>();
    for (const a of attempts) {
      const qs = unwrapQs(a.question_sets);
      const title = qs?.title ?? "Question set";
      const setId = qs?.id ?? "";
      const key = setId || `title:${title}`;
      const prev = map.get(key) ?? { scores: [], passed: [], setId, title };
      prev.title = title;
      prev.scores.push(Number(a.percentage));
      prev.passed.push(a.passed);
      if (setId) prev.setId = setId;
      map.set(key, prev);
    }
    return [...map.values()].map((v) => {
      const n = v.scores.length;
      const avg = n ? v.scores.reduce((s, x) => s + x, 0) / n : 0;
      const passN = v.passed.filter(Boolean).length;
      const passRate = n ? (passN / n) * 100 : 0;
      return { setId: v.setId, title: v.title, avgPct: avg, passPct: passRate, count: n };
    });
  }, [attempts]);

  const bySetChart: PerformanceChartItem[] = useMemo(
    () =>
      bySetDetailed.map((r) => ({
        label: r.title.length > 28 ? `${r.title.slice(0, 26)}…` : r.title,
        value: Number(r.avgPct.toFixed(2)),
        secondary: Number(r.passPct.toFixed(2)),
      })),
    [bySetDetailed],
  );

  const classChartData = useMemo(() => aggregateClassBarsFromAttempts(attempts), [attempts]);
  const difficultyData = useMemo(() => difficultyBarsFromAttempts(attempts), [attempts]);
  const activityData = useMemo(() => weekBucketsFromAttempts(attempts), [attempts]);

  const filterClassName = perfRows[0]?.class_name ?? classPerformance.find((r) => r.class_id === classId)?.class_name;

  const scopeAttemptsCaption = classId
    ? `Attempts in ${filterClassName ?? "this class"} only${rangePreset !== "all" ? ` · ${rangeLabel(rangePreset, customFrom, customTo)}` : ""}.`
    : rangePreset !== "all"
      ? `All your classes · ${rangeLabel(rangePreset, customFrom, customTo)}.`
      : "All your classes · all dates.";

  const exportPerformanceCsv = () => {
    const header = [
      "class_id",
      "class_name",
      "student_name",
      "question_set_id",
      "question_set_title",
      "average_percentage",
      "total_attempts",
      "passed_attempts",
    ];
    const rows = perfRows.map((r) => [
      r.class_id,
      r.class_name,
      r.student_name,
      r.question_set_id ?? "",
      r.question_set_title,
      String(r.average_percentage),
      String(r.total_attempts),
      String(r.passed_attempts),
    ]);
    downloadCsv(`cognimath-performance-${classId || "all-classes"}.csv`, [header, ...rows]);
  };

  const exportWeakTopicsCsv = () => {
    const sorted = [...topicRollup].sort((a, b) => a.avgScore - b.avgScore || b.wrongSum - a.wrongSum);
    const header = ["class_id", "class_name", "topic", "avg_score_rolled", "wrong_answers_sum", "student_level_rows"];
    const rows = sorted.map((r) => [
      r.class_id,
      r.class_name,
      r.topic,
      r.avgScore.toFixed(2),
      String(r.wrongSum),
      String(r.studentRows),
    ]);
    downloadCsv(`cognimath-weak-topics-${classId || "all"}.csv`, [header, ...rows]);
  };

  const exportAttemptsBySetCsv = () => {
    const header = ["question_set_id", "title", "attempt_count_in_scope", "avg_percentage", "pass_rate_pct"];
    const rows = bySetDetailed.map((r) => [r.setId, r.title, String(r.count), r.avgPct.toFixed(2), r.passPct.toFixed(2)]);
    downloadCsv(`cognimath-attempts-by-set-filtered.csv`, [header, ...rows]);
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-slate-600">
        Loading analytics…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error ? <Alert variant="error">{error}</Alert> : null}
      {classId ? (
        <Alert variant="info">
          Showing analytics for <span className="font-semibold">{filterClassName ?? "selected class"}</span>.{" "}
          <Link to="/analytics" className="font-medium text-indigo-800 underline">
            Clear class filter
          </Link>
        </Alert>
      ) : null}

      <Card>
        <h3 className="mb-2 font-semibold">Date range (attempts-based charts)</h3>
        <p className="mb-3 text-xs text-slate-500">
          Pass/fail, class averages, question sets, activity, and difficulty use attempts in range. Weak topics and performance export still use server
          aggregates (not filtered by these dates).
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Preset</span>
            <select
              className="rounded border border-slate-300 p-2"
              value={rangePreset}
              onChange={(e) => setRangePreset(e.target.value as DateRangePreset)}
            >
              <option value="all">All time</option>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="custom">Custom…</option>
            </select>
          </label>
          {rangePreset === "custom" ? (
            <>
              <label className="text-sm">
                <span className="mb-1 block text-slate-600">From</span>
                <input type="date" className="rounded border p-2" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-slate-600">To</span>
                <input type="date" className="rounded border p-2" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
              </label>
            </>
          ) : null}
        </div>
        {rangePreset === "custom" && (!customFrom || !customTo || !customRangeIso(customFrom, customTo)) ? (
          <p className="mt-2 text-xs text-amber-800">Choose a valid from/to range (from ≤ to).</p>
        ) : null}
      </Card>

      <Card>
        <h3 className="mb-2 font-semibold">Export (appendix / supervisor)</h3>
        <p className="mb-3 text-xs text-slate-500">
          Performance CSV uses <span className="font-medium">class_performance_view</span> (all-time aggregates, same class filter as above). Other
          exports match the tables on this page.
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="rounded border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50" onClick={exportPerformanceCsv}>
            Export performance (CSV)
          </button>
          <button type="button" className="rounded border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50" onClick={exportWeakTopicsCsv}>
            Export weak topics rollup (CSV)
          </button>
          <button
            type="button"
            className="rounded border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50"
            onClick={exportAttemptsBySetCsv}
          >
            Export attempts-by-set (filtered)
          </button>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h3 className="mb-1 font-semibold">Class performance (avg %)</h3>
          <p className="mb-3 text-xs text-slate-500">{scopeAttemptsCaption}</p>
          <PerformanceChart
            data={classChartData}
            emptyLabel={classId ? "No attempts in this scope yet." : "No attempts in this scope yet."}
          />
        </Card>
        <Card>
          <h3 className="mb-1 font-semibold">Pass / fail (attempts in scope)</h3>
          <p className="mb-3 text-xs text-slate-500">{scopeAttemptsCaption}</p>
          <PassFailPie pass={pass} fail={fail} />
        </Card>
      </div>

      <Card>
        <h3 className="mb-1 font-semibold">Question sets · average % and pass rate</h3>
        <p className="mb-3 text-xs text-slate-500">{scopeAttemptsCaption}</p>
        <PerformanceChart
          data={bySetChart}
          valueLabel="Avg score %"
          secondaryLabel="Pass rate %"
          slantedLabels
          emptyLabel="No attempt data in this scope."
        />
        {bySetDetailed.length > 0 ? (
          <div className="mt-4 overflow-x-auto text-sm">
            <table className="w-full min-w-[28rem] border-collapse text-left">
              <thead>
                <tr className="border-b text-xs text-slate-500">
                  <th className="py-2 pr-2 font-medium">Question set</th>
                  <th className="py-2 pr-2 font-medium">Attempts</th>
                  <th className="py-2 pr-2 font-medium">Avg %</th>
                  <th className="py-2 pr-2 font-medium">Pass %</th>
                  <th className="py-2 font-medium">Open</th>
                </tr>
              </thead>
              <tbody>
                {bySetDetailed.map((r) => (
                  <tr key={r.setId + r.title} className="border-b border-slate-100">
                    <td className="py-2 pr-2">{r.title}</td>
                    <td className="py-2 pr-2">{r.count}</td>
                    <td className="py-2 pr-2">{r.avgPct.toFixed(1)}%</td>
                    <td className="py-2 pr-2">{r.passPct.toFixed(0)}%</td>
                    <td className="py-2">
                      {r.setId ? (
                        <Link to={`/question-sets/${r.setId}`} className="font-medium text-indigo-800 underline">
                          Edit set
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Card>

      <Card>
        <h3 className="mb-1 font-semibold">Activity · attempts per week</h3>
        <p className="mb-3 text-xs text-slate-500">{scopeAttemptsCaption}</p>
        <PerformanceChart
          data={activityData}
          valueLabel="Attempts"
          yPercentScale={false}
          emptyLabel="No dated attempts in this scope."
        />
      </Card>

      <Card>
        <h3 className="mb-1 font-semibold">Performance by difficulty (attempt level)</h3>
        <p className="mb-3 text-xs text-slate-500">{scopeAttemptsCaption}</p>
        <PerformanceChart data={difficultyData} emptyLabel="No attempts with difficulty in this scope." />
      </Card>

      <Card>
        <h3 className="mb-2 font-semibold">Weak topics · class topics to reteach (rolled up)</h3>
        <p className="mb-3 text-xs text-slate-500">
          Aggregated from <span className="font-medium">weak_topics_view</span> (student-topic rows combined by class + topic). Worst averages first; wrong
          answers summed.{classId ? " Filtered to this class." : ""}
        </p>
        {topicRollupSorted.length === 0 ? (
          <p className="text-sm text-slate-600">No weak-topic rows{classId ? " for this class" : ""}.</p>
        ) : (
          <div className="overflow-x-auto text-sm">
            <table className="w-full min-w-[32rem] border-collapse text-left">
              <thead>
                <tr className="border-b text-xs text-slate-500">
                  <th className="py-2 pr-2 font-medium">Class</th>
                  <th className="py-2 pr-2 font-medium">Topic</th>
                  <th className="py-2 pr-2 font-medium">Avg score (rolled)</th>
                  <th className="py-2 pr-2 font-medium">Wrong answers (sum)</th>
                  <th className="py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {topicRollupSorted.map((r) => (
                  <tr key={`${r.class_id}-${r.topic}`} className="border-b border-slate-100">
                    <td className="py-2 pr-2">{r.class_name}</td>
                    <td className="py-2 pr-2 font-medium">{r.topic}</td>
                    <td className="py-2 pr-2">{r.avgScore.toFixed(1)}%</td>
                    <td className="py-2 pr-2">{r.wrongSum}</td>
                    <td className="py-2">
                      <Link to={`/classes/${r.class_id}`} className="font-medium text-indigo-800 underline">
                        Open class
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <h3 className="mb-2 font-semibold">Recommendations</h3>
        <p className="mb-3 text-xs text-slate-500">
          Top topics by lowest rolled-up average score (ties broken by total wrong answers). Use with your judgement — small sample sizes can skew
          averages.
        </p>
        {recommendations.length === 0 ? (
          <p className="text-slate-700">No weak-topic data yet to rank.</p>
        ) : (
          <ul className="list-inside list-disc space-y-2 text-slate-800">
            {recommendations.map((r) => (
              <li key={`${r.class_id}-${r.topic}`}>
                <span className="font-semibold">{r.topic}</span> ({r.class_name}) — avg {r.avgScore.toFixed(1)}% across learner-topic rows,{" "}
                {r.wrongSum} wrong answers logged. Consider reteaching and short formative checks.
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function rangeLabel(preset: DateRangePreset, from: string, to: string): string {
  if (preset === "all") return "All time";
  if (preset === "7") return "Last 7 days";
  if (preset === "30") return "Last 30 days";
  if (preset === "custom" && from && to) return `${from} → ${to}`;
  return "Custom range";
}
