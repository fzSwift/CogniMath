import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Alert } from "../components/ui/Alert";
import { Card } from "../components/ui/Card";
import { supabase } from "../lib/supabase";
import type { Student, StudentClassEnrollment, WeakTopicsViewRow } from "../types";

function fmtShortDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function StudentResultsPage() {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const [student, setStudent] = useState<Student | null>(null);
  const [editName, setEditName] = useState("");
  const [editLevel, setEditLevel] = useState("");
  const [enrollments, setEnrollments] = useState<StudentClassEnrollment[]>([]);
  const [attempts, setAttempts] = useState<
    { id: string; percentage: number | string; passed: boolean; question_sets?: { title: string } | null }[]
  >([]);
  const [weakTopics, setWeakTopics] = useState<WeakTopicsViewRow[]>([]);
  const [selectedAttempt, setSelectedAttempt] = useState<string>("");
  const [answers, setAnswers] = useState<
    { id: string; selected_answer: string; correct_answer: string; is_correct: boolean; questions?: { question_text: string } | null }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saveOk, setSaveOk] = useState(false);
  const [profileBusy, setProfileBusy] = useState(false);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [weakTopicsError, setWeakTopicsError] = useState("");

  const load = useCallback(async () => {
    if (!studentId) return;
    setLoading(true);
    setError("");
    setSaveOk(false);
    const [studentRes, enrollRes, attemptsRes] = await Promise.all([
      supabase.from("students").select("*").eq("id", studentId).single(),
      supabase
        .from("class_students")
        .select("id, class_id, classes ( id, class_name, description )")
        .eq("student_id", studentId)
        .order("created_at", { ascending: false }),
      supabase.from("student_attempts").select("*, question_sets(title)").eq("student_id", studentId).order("completed_at", { ascending: false }),
    ]);
    const weakRes = await supabase.from("weak_topics_view").select("*").eq("student_id", studentId);
    const err = studentRes.error?.message || enrollRes.error?.message || attemptsRes.error?.message;
    if (err) {
      setError(err);
      setStudent(null);
      setLoading(false);
      return;
    }
    if (!studentRes.data) {
      setError("Student not found or you do not have access.");
      setStudent(null);
      setLoading(false);
      return;
    }
    const s = studentRes.data as Student;
    setStudent(s);
    setEditName(s.full_name);
    setEditLevel(s.class_level ?? "");
    setEnrollments((enrollRes.data ?? []) as unknown as StudentClassEnrollment[]);
    setAttempts((attemptsRes.data ?? []) as typeof attempts);
    if (weakRes.error) {
      setWeakTopics([]);
      setWeakTopicsError(
        weakRes.error.message.includes("student_id") || weakRes.error.code === "42703"
          ? "Run upgrade_students_features.sql (or full schema) so weak_topics_view includes student_id."
          : "",
      );
    } else {
      setWeakTopicsError("");
      const weakRows = (weakRes.data ?? []) as WeakTopicsViewRow[];
      weakRows.sort(
        (a, b) => Number(b.wrong_answers_count) - Number(a.wrong_answers_count) || Number(a.average_score) - Number(b.average_score),
      );
      setWeakTopics(weakRows);
    }
    setLoading(false);
  }, [studentId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const loadAnswers = async () => {
      if (!selectedAttempt) {
        setAnswers([]);
        return;
      }
      const { data, error: ansErr } = await supabase
        .from("student_answers")
        .select("*, questions(question_text)")
        .eq("attempt_id", selectedAttempt);
      if (ansErr) {
        console.error(ansErr);
        setAnswers([]);
        return;
      }
      setAnswers((data ?? []) as typeof answers);
    };
    void loadAnswers();
  }, [selectedAttempt]);

  const snapshot = useMemo(() => {
    const n = attempts.length;
    if (!n) return { passRate: 0, avgPct: 0, count: 0, passed: 0 };
    const passed = attempts.filter((a) => a.passed).length;
    const avgPct = attempts.reduce((s, a) => s + Number(a.percentage), 0) / n;
    return { passRate: (passed / n) * 100, avgPct, count: n, passed };
  }, [attempts]);

  const enrollmentRows = enrollments
    .map((row) => {
      const raw = row.classes;
      const c = Array.isArray(raw) ? raw[0] : raw;
      if (!c) return null;
      return { rowId: row.id, c };
    })
    .filter(Boolean) as { rowId: string; c: { id: string; class_name: string; description: string | null } }[];

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!studentId) return;
    setSaveError("");
    setSaveOk(false);
    setProfileBusy(true);
    const { error: uErr } = await supabase
      .from("students")
      .update({ full_name: editName.trim(), class_level: editLevel.trim() || null })
      .eq("id", studentId);
    setProfileBusy(false);
    if (uErr) {
      setSaveError(uErr.message);
      return;
    }
    setSaveOk(true);
    void load();
  };

  const toggleArchive = async () => {
    if (!studentId || !student) return;
    const next = student.archived_at ? null : new Date().toISOString();
    setArchiveBusy(true);
    const { error: uErr } = await supabase.from("students").update({ archived_at: next }).eq("id", studentId);
    setArchiveBusy(false);
    if (uErr) {
      setError(uErr.message);
      return;
    }
    void load();
  };

  const deleteStudent = async () => {
    if (!studentId || !student) return;
    const msg =
      `Permanently delete "${student.full_name}" (@${student.username})?\n\n` +
      "This cannot be undone. Foreign keys will CASCADE: all student_attempts and student_answers, class_students enrollments, join-request links, and any other rows referencing this student will be removed from the database.\n\n" +
      "Unity clients using this username will lose continuity with historical data.\n\n" +
      "Click OK to delete.";
    if (!confirm(msg)) return;
    setDeleteBusy(true);
    const { error: dErr } = await supabase.from("students").delete().eq("id", studentId);
    setDeleteBusy(false);
    if (dErr) {
      setError(dErr.message);
      return;
    }
    navigate("/students");
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-slate-600">
        Loading student…
      </div>
    );
  }

  const archived = Boolean(student?.archived_at);

  return (
    <div className="space-y-6">
      {error ? <Alert variant="error">{error}</Alert> : null}
      <Card>
        <h2 className="text-lg font-semibold">{student?.full_name ?? "—"}</h2>
        <p className="text-sm text-slate-500">Profile & roster (teacher view)</p>
      </Card>

      <Card>
        <h3 className="mb-3 font-semibold">Edit student</h3>
        <form onSubmit={saveProfile} className="space-y-3 max-w-lg">
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Full name</span>
            <input className="w-full rounded border p-2" value={editName} onChange={(e) => setEditName(e.target.value)} required />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Class level</span>
            <input className="w-full rounded border p-2" value={editLevel} onChange={(e) => setEditLevel(e.target.value)} placeholder="Optional" />
          </label>
          <div>
            <span className="mb-1 block text-sm text-slate-600">Username</span>
            <input className="w-full cursor-not-allowed rounded border bg-slate-100 p-2 text-slate-600" readOnly value={student?.username ?? ""} />
            <p className="mt-2 text-xs text-slate-600">
              Username is read-only. Changing it in the database would break continuity for Unity clients and history keyed by this login — keep it stable
              across terms.
            </p>
          </div>
          {saveError ? <Alert variant="error">{saveError}</Alert> : null}
          {saveOk ? <Alert variant="info">Saved.</Alert> : null}
          <button type="submit" disabled={profileBusy} className="rounded bg-indigo-600 px-4 py-2 text-white disabled:opacity-50">
            {profileBusy ? "Saving…" : "Save changes"}
          </button>
        </form>
      </Card>

      <Card>
        <h3 className="mb-2 font-semibold">Learning snapshot</h3>
        <p className="mb-3 text-xs text-slate-500">Across attempts in classes you teach (same scope as the class health views).</p>
        {snapshot.count === 0 ? (
          <p className="text-sm text-slate-600">No attempts yet — snapshot will populate after the first completed quiz.</p>
        ) : (
          <div className="flex flex-wrap gap-6 text-sm">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Pass rate</p>
              <p className="text-xl font-semibold text-slate-900">{snapshot.passRate.toFixed(0)}%</p>
              <p className="text-xs text-slate-500">
                {snapshot.passed} / {snapshot.count} passed
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Average score</p>
              <p className="text-xl font-semibold text-slate-900">{snapshot.avgPct.toFixed(1)}%</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Attempts</p>
              <p className="text-xl font-semibold text-slate-900">{snapshot.count}</p>
            </div>
          </div>
        )}
      </Card>

      <Card>
        <h3 className="mb-3 font-semibold">Weak topics (coach next)</h3>
        <p className="mb-3 text-xs text-slate-500">From weak_topics_view for this student (topics with weaker scores / wrong answers).</p>
        {weakTopicsError ? <Alert variant="info">{weakTopicsError}</Alert> : null}
        {weakTopics.length === 0 ? (
          <p className="text-sm text-slate-600">No weak-topic signal yet — needs attempts with answer-level data.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {weakTopics.slice(0, 8).map((w) => (
              <li key={`${w.class_id}-${w.topic}-${w.student_id ?? w.student_name}`} className="rounded border border-slate-200 p-3">
                <span className="font-medium">{w.topic}</span>
                <span className="text-slate-500"> · avg {Number(w.average_score).toFixed(0)}%</span>
                <span className="text-slate-500"> · wrong answers: {w.wrong_answers_count}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h3 className="mb-3 font-semibold">Classes enrolled in</h3>
        <p className="mb-3 text-xs text-slate-500">Only classes you teach are shown (same roster as elsewhere).</p>
        {enrollmentRows.length === 0 ? (
          <p className="text-sm text-slate-600">This student is not enrolled in any of your classes yet.</p>
        ) : (
          <ul className="space-y-2">
            {enrollmentRows.map(({ rowId, c }) => (
              <li key={rowId}>
                <Link to={`/classes/${c.id}`} className="block rounded-lg border border-slate-200 p-3 text-sm hover:border-indigo-300 hover:bg-slate-50">
                  <span className="font-medium text-indigo-800">{c.class_name}</span>
                  {c.description ? <p className="mt-1 text-slate-600">{c.description}</p> : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h3 className="mb-3 font-semibold">Attempts</h3>
        {attempts.length === 0 ? (
          <p className="text-sm text-slate-600">No attempts recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {attempts.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setSelectedAttempt(a.id)}
                className={`block w-full rounded border p-2 text-left hover:border-indigo-400 ${selectedAttempt === a.id ? "border-indigo-400 bg-indigo-50" : ""}`}
              >
                {a.question_sets?.title} — {a.percentage}% — {a.passed ? "Passed" : "Failed"}
              </button>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <h3 className="mb-3 font-semibold">Selected vs Correct Answers</h3>
        {!selectedAttempt ? (
          <p className="text-sm text-slate-600">Select an attempt above to review answers.</p>
        ) : answers.length === 0 ? (
          <p className="text-sm text-slate-600">No answers loaded for this attempt.</p>
        ) : (
          <div className="space-y-3 text-sm">
            {answers.map((ans) => (
              <div key={ans.id} className={`rounded border p-3 ${ans.is_correct ? "border-green-300 bg-green-50" : "border-red-300 bg-red-50"}`}>
                <p className="font-medium">{ans.questions?.question_text}</p>
                <p>
                  Selected: {ans.selected_answer} | Correct: {ans.correct_answer}
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <h3 className="mb-2 font-semibold">Archive & delete</h3>
        <p className="mb-3 text-xs text-slate-500">
          Archive hides the student from default lists and class roster counts; attempts and history remain. Deletion is permanent and cascades (see
          confirm dialog).
        </p>
        {archived ? <Alert variant="info">This student is archived (since {fmtShortDate(student?.archived_at)}).</Alert> : null}
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={archiveBusy || !student}
            onClick={() => void toggleArchive()}
            className="rounded border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
          >
            {archiveBusy ? "Updating…" : archived ? "Restore student" : "Archive student"}
          </button>
          <button
            type="button"
            disabled={deleteBusy || !student}
            onClick={() => void deleteStudent()}
            className="rounded border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-900 hover:bg-red-100 disabled:opacity-50"
          >
            {deleteBusy ? "Deleting…" : "Delete student permanently"}
          </button>
        </div>
      </Card>
    </div>
  );
}
