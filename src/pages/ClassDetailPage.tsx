import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import QRCode from "react-qr-code";
import { Alert } from "../components/ui/Alert";
import { Card } from "../components/ui/Card";
import { generateInviteCode } from "../lib/inviteCode";
import { supabase } from "../lib/supabase";
import type { ClassDashboardRow, ClassJoinRequest, Student } from "../types";

export function ClassDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [classRow, setClassRow] = useState<ClassDashboardRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [students, setStudents] = useState<{ id: string; students: Student }[]>([]);
  const [questionSets, setQuestionSets] = useState<{ id: string; title: string; threshold_score: number }[]>([]);
  const [studentId, setStudentId] = useState("");
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [joinRequests, setJoinRequests] = useState<ClassJoinRequest[]>([]);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [copied, setCopied] = useState(false);
  const [requestBusyId, setRequestBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const [busyEnrollmentId, setBusyEnrollmentId] = useState<string | null>(null);
  const [busyQuestionSetId, setBusyQuestionSetId] = useState<string | null>(null);
  const [classBusy, setClassBusy] = useState(false);
  const [editBusy, setEditBusy] = useState(false);
  const [loadError, setLoadError] = useState("");

  const isArchived = Boolean(classRow?.archived_at);

  const studentsNotInClass = useMemo(() => {
    const enrolled = new Set(students.map((row) => row.students.id));
    return allStudents.filter((s) => !enrolled.has(s.id));
  }, [allStudents, students]);

  const load = async () => {
    if (!id) return;
    setLoadError("");
    const [dashRes, studentsRes, setsRes, allStudentsRes, requestsRes] = await Promise.all([
      supabase.from("class_dashboard_row").select("*").eq("id", id).single(),
      supabase.from("class_students").select("id, students(*)").eq("class_id", id),
      supabase.from("question_sets").select("id, title, threshold_score").eq("class_id", id),
      supabase.from("students").select("*").is("archived_at", null),
      supabase
        .from("class_join_requests")
        .select("*")
        .eq("class_id", id)
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
    ]);

    if (dashRes.error || !dashRes.data) {
      setLoadError(
        dashRes.error?.message.includes("class_dashboard_row") || dashRes.error?.code === "42P01"
          ? "Run supabase/schema.sql or upgrade_class_features.sql so class_dashboard_row exists."
          : dashRes.error?.message ?? "Class not found.",
      );
      setClassRow(null);
      return;
    }

    const row = dashRes.data as unknown as ClassDashboardRow;
    setClassRow(row);
    setEditName(row.class_name);
    setEditDescription(row.description ?? "");
    setStudents((studentsRes.data ?? []) as unknown as { id: string; students: Student }[]);
    setQuestionSets(setsRes.data ?? []);
    setAllStudents((allStudentsRes.data ?? []) as Student[]);
    setJoinRequests((requestsRes.data ?? []) as ClassJoinRequest[]);
  };

  useEffect(() => {
    void load();
  }, [id]);

  useEffect(() => {
    if (location.hash !== "#join-requests") return;
    requestAnimationFrame(() => {
      document.getElementById("join-requests")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [location.hash, joinRequests.length]);

  const saveClassDetails = async (e: FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setEditBusy(true);
    setActionError("");
    const { error } = await supabase.from("classes").update({ class_name: editName.trim(), description: editDescription.trim() || null }).eq("id", id);
    setEditBusy(false);
    if (error) {
      setActionError(error.message);
      return;
    }
    void load();
  };

  const assignStudent = async (e: FormEvent) => {
    e.preventDefault();
    if (!id || !studentId || isArchived) return;
    setActionError("");
    const { error } = await supabase.from("class_students").insert({ class_id: id, student_id: studentId });
    if (error) {
      setActionError(error.message);
      return;
    }
    setStudentId("");
    void load();
  };

  const removeStudentFromClass = async (enrollmentId: string) => {
    if (isArchived) return;
    if (!confirm("Remove this student from the class? They stay in the system and can be added again later.")) return;
    setActionError("");
    setBusyEnrollmentId(enrollmentId);
    const { error } = await supabase.from("class_students").delete().eq("id", enrollmentId);
    setBusyEnrollmentId(null);
    if (error) {
      setActionError(error.message);
      return;
    }
    void load();
  };

  const deleteQuestionSet = async (questionSetId: string, title: string) => {
    if (isArchived) return;
    if (
      !confirm(
        `Delete question set "${title}"? This removes its questions and related attempts/progress in Supabase (cascade). This cannot be undone.`,
      )
    )
      return;
    setActionError("");
    setBusyQuestionSetId(questionSetId);
    const { error } = await supabase.from("question_sets").delete().eq("id", questionSetId);
    setBusyQuestionSetId(null);
    if (error) {
      setActionError(error.message);
      return;
    }
    void load();
  };

  const archiveClass = async () => {
    if (!id || isArchived) return;
    if (!confirm("Archive this class? It will leave the default class list until you restore it.")) return;
    setActionError("");
    setClassBusy(true);
    const { error } = await supabase.from("classes").update({ archived_at: new Date().toISOString() }).eq("id", id);
    setClassBusy(false);
    if (error) {
      setActionError(error.message);
      return;
    }
    navigate("/classes");
  };

  const restoreClass = async () => {
    if (!id || !isArchived) return;
    setClassBusy(true);
    setActionError("");
    const { error } = await supabase.from("classes").update({ archived_at: null }).eq("id", id);
    setClassBusy(false);
    if (error) {
      setActionError(error.message);
      return;
    }
    void load();
  };

  const permanentlyDeleteClass = async () => {
    if (!id) return;
    if (!confirm("Permanently delete this class and all related data? This cannot be undone.")) return;
    setClassBusy(true);
    setActionError("");
    const { error } = await supabase.from("classes").delete().eq("id", id);
    setClassBusy(false);
    if (error) {
      setActionError(error.message);
      return;
    }
    navigate("/classes");
  };

  const saveInviteCode = async (code: string | null) => {
    if (!id || isArchived) return;
    setInviteBusy(true);
    setInviteError("");
    const { error } = await supabase.from("classes").update({ invite_code: code }).eq("id", id);
    setInviteBusy(false);
    if (error) {
      setInviteError(error.message);
      return;
    }
    void load();
  };

  const regenerateInviteCode = async () => {
    if (!id || isArchived) return;
    let attempts = 0;
    while (attempts < 8) {
      attempts += 1;
      const code = generateInviteCode(8);
      setInviteBusy(true);
      setInviteError("");
      const { error } = await supabase.from("classes").update({ invite_code: code }).eq("id", id);
      setInviteBusy(false);
      if (!error) {
        void load();
        return;
      }
      if (!error.message.includes("duplicate") && !error.message.includes("unique")) {
        setInviteError(error.message);
        return;
      }
    }
    setInviteError("Could not generate a unique code. Try again.");
  };

  const copyCode = async () => {
    const code = classRow?.invite_code;
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setInviteError("Clipboard not available.");
    }
  };

  const approveRequest = async (requestId: string) => {
    if (isArchived) return;
    setRequestBusyId(requestId);
    setInviteError("");
    const { error } = await supabase.rpc("approve_class_join_request", { p_request_id: requestId });
    setRequestBusyId(null);
    if (error) setInviteError(error.message);
    void load();
  };

  const rejectRequest = async (requestId: string) => {
    if (isArchived) return;
    setRequestBusyId(requestId);
    setInviteError("");
    const { error } = await supabase.rpc("reject_class_join_request", { p_request_id: requestId });
    setRequestBusyId(null);
    if (error) setInviteError(error.message);
    void load();
  };

  const code = classRow?.invite_code ?? "";
  const passRate =
    classRow && classRow.attempt_count > 0
      ? Math.round((100 * classRow.passed_attempt_count) / classRow.attempt_count)
      : null;

  if (loadError && !classRow) {
    return (
      <div className="space-y-4">
        <Alert variant="error">{loadError}</Alert>
        <Link to="/classes" className="text-indigo-700 hover:underline">
          Back to classes
        </Link>
      </div>
    );
  }

  if (!classRow) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center text-slate-600">
        Loading class…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {isArchived ? (
        <Alert variant="info">
          This class is archived. Restore it to manage join codes, enrollments, and question sets. You can still edit the name and description below.
        </Alert>
      ) : null}

      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold">{classRow.class_name}</h3>
            <p className="text-slate-500">{classRow.description}</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Link
              to={`/analytics?classId=${id}`}
              className="rounded border border-slate-300 px-3 py-2 text-center text-sm hover:bg-slate-50"
            >
              Analytics for class
            </Link>
            {!isArchived ? (
              <button
                type="button"
                className="rounded border border-amber-300 px-3 py-2 text-sm text-amber-900 hover:bg-amber-50 disabled:opacity-50"
                disabled={classBusy}
                onClick={() => void archiveClass()}
              >
                Archive class
              </button>
            ) : (
              <button
                type="button"
                className="rounded bg-emerald-600 px-3 py-2 text-sm text-white hover:bg-emerald-700 disabled:opacity-50"
                disabled={classBusy}
                onClick={() => void restoreClass()}
              >
                Restore class
              </button>
            )}
            <button
              type="button"
              className="rounded border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
              disabled={classBusy}
              onClick={() => void permanentlyDeleteClass()}
            >
              Delete permanently
            </button>
          </div>
        </div>
        {actionError ? <p className="mt-3 text-sm text-red-600">{actionError}</p> : null}
      </Card>

      <Card>
        <h4 className="mb-2 font-semibold">Edit class</h4>
        <form onSubmit={saveClassDetails} className="space-y-3">
          <input className="w-full max-w-md rounded border p-2" value={editName} onChange={(e) => setEditName(e.target.value)} required />
          <textarea className="w-full max-w-md rounded border p-2" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={2} />
          <button type="submit" className="rounded bg-indigo-600 px-4 py-2 text-sm text-white disabled:opacity-50" disabled={editBusy}>
            {editBusy ? "Saving…" : "Save changes"}
          </button>
        </form>
      </Card>

      <Card>
        <h4 className="mb-2 font-semibold text-slate-800">Class health</h4>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">Avg score</p>
            <p className="text-xl font-semibold text-indigo-900">{Number(classRow.avg_score_pct).toFixed(1)}%</p>
            <p className="text-xs text-slate-500">Across attempts in this class</p>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">Pass rate</p>
            <p className="text-xl font-semibold text-indigo-900">{passRate === null ? "—" : `${passRate}%`}</p>
            <p className="text-xs text-slate-500">
              {classRow.attempt_count} attempt{classRow.attempt_count === 1 ? "" : "s"}
            </p>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">Last activity</p>
            <p className="text-lg font-semibold text-indigo-900">
              {classRow.last_activity_at ? new Date(classRow.last_activity_at).toLocaleString() : "—"}
            </p>
            <p className="text-xs text-slate-500">Latest attempt completion</p>
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Roster: {classRow.student_count} students · {classRow.question_set_count} question sets · {classRow.pending_join_count} pending join
          requests
        </p>
      </Card>

      <Card>
        <h4 className="mb-2 font-semibold">Student join code</h4>
        <p className="mb-4 text-sm text-slate-600">
          Share this code or QR with students using the Unity app. They submit a join request; you approve them below before they are added to the class roster.
        </p>
        {inviteError ? <p className="mb-3 text-sm text-red-600">{inviteError}</p> : null}
        <div className={`flex flex-col gap-6 lg:flex-row lg:items-start ${isArchived ? "opacity-60" : ""}`}>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            {code ? (
              <QRCode value={code} size={160} title="Class invite code" />
            ) : (
              <div className="flex h-40 w-40 items-center justify-center bg-slate-100 text-center text-xs text-slate-500">
                Generate a code to show QR
              </div>
            )}
          </div>
          <div className="flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-slate-100 px-3 py-2 font-mono text-lg tracking-wider">{code || "—"}</span>
              <button
                type="button"
                className="rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                disabled={!code || inviteBusy || isArchived}
                onClick={() => void copyCode()}
              >
                {copied ? "Copied" : "Copy"}
              </button>
              <button
                type="button"
                className="rounded bg-indigo-600 px-3 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
                disabled={inviteBusy || isArchived}
                onClick={() => void regenerateInviteCode()}
              >
                {inviteBusy ? "Saving…" : code ? "New code" : "Generate code"}
              </button>
              {code ? (
                <button
                  type="button"
                  className="rounded border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
                  disabled={inviteBusy || isArchived}
                  onClick={() => void saveInviteCode(null)}
                >
                  Clear code
                </button>
              ) : null}
            </div>
            <p className="text-xs text-slate-500">
              Unity: call RPC <code className="rounded bg-slate-100 px-1">submit_class_join_request</code> with the invite code and student name/username (anon key allowed).
            </p>
          </div>
        </div>
      </Card>

      <Card id="join-requests">
        <h4 className="mb-3 font-semibold">Pending join requests</h4>
        {joinRequests.length === 0 ? (
          <p className="text-sm text-slate-500">No pending requests.</p>
        ) : (
          <ul className="space-y-3">
            {joinRequests.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-3 text-sm">
                <div>
                  <span className="font-medium">{r.full_name}</span>
                  <span className="text-slate-600"> @{r.username}</span>
                  <span className="block text-xs text-slate-400">{new Date(r.created_at).toLocaleString()}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded bg-emerald-600 px-3 py-1.5 text-white disabled:opacity-50"
                    disabled={requestBusyId === r.id || isArchived}
                    onClick={() => void approveRequest(r.id)}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="rounded border border-slate-300 px-3 py-1.5 disabled:opacity-50"
                    disabled={requestBusyId === r.id || isArchived}
                    onClick={() => void rejectRequest(r.id)}
                  >
                    Reject
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h4 className="mb-3 font-semibold">Add student manually</h4>
          <form onSubmit={assignStudent} className="flex flex-col gap-2 sm:flex-row">
            <select
              className="flex-1 rounded border p-2"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              required
              disabled={isArchived}
            >
              <option value="">Select student</option>
              {studentsNotInClass.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
            </select>
            <button type="submit" className="rounded bg-indigo-600 px-4 py-2 text-white sm:shrink-0 disabled:opacity-50" disabled={isArchived}>
              Add
            </button>
          </form>
          {studentsNotInClass.length === 0 && allStudents.length > 0 ? (
            <p className="mt-2 text-xs text-slate-500">All existing students are already in this class.</p>
          ) : null}
          <div className="mt-4 space-y-2">
            {students.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{s.students.full_name}</span>
                  <span className="text-slate-500">@{s.students.username}</span>
                  <Link to={`/student-results/${s.students.id}`} className="text-xs text-indigo-700 hover:underline">
                    View results
                  </Link>
                </div>
                <button
                  type="button"
                  className="rounded border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
                  disabled={busyEnrollmentId === s.id || isArchived}
                  onClick={() => void removeStudentFromClass(s.id)}
                >
                  {busyEnrollmentId === s.id ? "…" : "Remove"}
                </button>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <h4 className="mb-3 font-semibold">Assigned question sets</h4>
          <div className="space-y-2">
            {questionSets.map((qs) => (
              <div key={qs.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-2 text-sm">
                <div>
                  <Link to={`/question-sets/${qs.id}`} className="font-medium text-indigo-800 hover:underline">
                    {qs.title}
                  </Link>
                  <span className="text-slate-600"> — threshold {qs.threshold_score}%</span>
                </div>
                <button
                  type="button"
                  className="rounded border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
                  disabled={busyQuestionSetId === qs.id || isArchived}
                  onClick={() => void deleteQuestionSet(qs.id, qs.title)}
                >
                  {busyQuestionSetId === qs.id ? "…" : "Delete"}
                </button>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
