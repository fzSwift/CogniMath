import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { Alert } from "../components/ui/Alert";
import { Card } from "../components/ui/Card";
import { supabase } from "../lib/supabase";
import type { ClassDashboardRow } from "../types";

type ListScope = "active" | "archived" | "all";
type SortKey = "name" | "created" | "size";
type SortDir = "asc" | "desc";

export function ClassesPage() {
  const [rows, setRows] = useState<ClassDashboardRow[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [listError, setListError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("created");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [listScope, setListScope] = useState<ListScope>("active");
  const [copyFlashId, setCopyFlashId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setListError("");
    let q = supabase.from("class_dashboard_row").select("*");
    if (listScope === "active") q = q.is("archived_at", null);
    else if (listScope === "archived") q = q.not("archived_at", "is", null);
    const { data, error } = await q.order("created_at", { ascending: false });
    if (error) {
      if (error.message.includes("class_dashboard_row") || error.code === "42P01") {
        setListError(
          "Database view missing: run the latest supabase/schema.sql or supabase/upgrade_class_features.sql in Supabase SQL Editor.",
        );
      } else setListError(error.message);
      setRows([]);
      setLoading(false);
      return;
    }
    setRows((data ?? []) as unknown as ClassDashboardRow[]);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, [listScope]);

  const filteredSorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = q
      ? rows.filter((r) => r.class_name.toLowerCase().includes(q) || (r.description ?? "").toLowerCase().includes(q))
      : [...rows];
    const dir = sortDir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      if (sortKey === "name") return a.class_name.localeCompare(b.class_name) * dir;
      if (sortKey === "size") return (a.student_count - b.student_count) * dir;
      return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * dir;
    });
    return list;
  }, [rows, search, sortKey, sortDir]);

  const createClass = async (e: FormEvent) => {
    e.preventDefault();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    setListError("");
    const { error } = await supabase.from("classes").insert({ class_name: name, description, teacher_id: userData.user.id });
    if (error) {
      setListError(error.message);
      return;
    }
    setName("");
    setDescription("");
    void load();
  };

  const archiveClass = async (classId: string, className: string) => {
    if (!confirm(`Archive class "${className}"? It will disappear from the default list; you can restore it later.`)) return;
    setListError("");
    setBusyId(classId);
    const { error } = await supabase.from("classes").update({ archived_at: new Date().toISOString() }).eq("id", classId);
    setBusyId(null);
    if (error) {
      setListError(error.message);
      return;
    }
    void load();
  };

  const restoreClass = async (classId: string) => {
    setListError("");
    setBusyId(classId);
    const { error } = await supabase.from("classes").update({ archived_at: null }).eq("id", classId);
    setBusyId(null);
    if (error) {
      setListError(error.message);
      return;
    }
    void load();
  };

  const copyInvite = async (code: string, classId: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopyFlashId(classId);
      setTimeout(() => setCopyFlashId(null), 2000);
    } catch {
      setListError("Could not copy invite code.");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-slate-600">
        Loading classes…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {listError ? <Alert variant="error">{listError}</Alert> : null}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <h3 className="mb-3 font-semibold">Create Class</h3>
          <form onSubmit={createClass} className="space-y-3">
            <input className="w-full rounded border p-2" placeholder="Class name" value={name} onChange={(e) => setName(e.target.value)} required />
            <textarea className="w-full rounded border p-2" placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
            <button type="submit" className="rounded bg-indigo-600 px-4 py-2 text-white">
              Save
            </button>
          </form>
        </Card>
        <div className="space-y-3 lg:col-span-2">
          <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="min-w-[12rem] flex-1">
              <label className="mb-1 block text-xs font-medium text-slate-600">Search</label>
              <input className="w-full rounded border p-2 text-sm" placeholder="Class name or description" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Sort by</label>
              <select className="w-full rounded border p-2 text-sm sm:w-40" value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}>
                <option value="created">Date created</option>
                <option value="name">Name</option>
                <option value="size">Class size</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Order</label>
              <select className="w-full rounded border p-2 text-sm sm:w-32" value={sortDir} onChange={(e) => setSortDir(e.target.value as SortDir)}>
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </select>
            </div>
            <div className="min-w-[10rem] flex-1">
              <label className="mb-1 block text-xs font-medium text-slate-600">Show</label>
              <select className="w-full rounded border p-2 text-sm" value={listScope} onChange={(e) => setListScope(e.target.value as ListScope)}>
                <option value="active">Active classes</option>
                <option value="archived">Archived only</option>
                <option value="all">All classes</option>
              </select>
            </div>
          </div>

          {filteredSorted.map((c) => {
            const openHref = c.pending_join_count > 0 ? `/classes/${c.id}#join-requests` : `/classes/${c.id}`;
            const isArchived = Boolean(c.archived_at);
            return (
              <div key={c.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-semibold">{c.class_name}</h4>
                    {isArchived ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900">Archived</span>
                    ) : null}
                    {c.pending_join_count > 0 ? (
                      <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs font-medium text-amber-950">
                        {c.pending_join_count} pending join{c.pending_join_count === 1 ? "" : "s"}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm text-slate-500">{c.description}</p>
                  <p className="mt-2 text-xs text-slate-600">
                    {c.student_count} students · {c.question_set_count} question sets
                    {c.pending_join_count > 0 ? ` · ${c.pending_join_count} pending requests` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Link to={openHref} className="rounded bg-indigo-600 px-3 py-2 text-center text-sm text-white hover:bg-indigo-700">
                    Open
                  </Link>
                  {c.invite_code ? (
                    <button
                      type="button"
                      className="rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
                      onClick={() => void copyInvite(c.invite_code!, c.id)}
                    >
                      {copyFlashId === c.id ? "Copied" : "Copy code"}
                    </button>
                  ) : null}
                  {!isArchived ? (
                    <button
                      type="button"
                      className="rounded border border-amber-300 px-3 py-2 text-sm text-amber-900 hover:bg-amber-50 disabled:opacity-50"
                      disabled={busyId === c.id}
                      onClick={() => void archiveClass(c.id, c.class_name)}
                    >
                      {busyId === c.id ? "…" : "Archive"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="rounded border border-emerald-300 px-3 py-2 text-sm text-emerald-900 hover:bg-emerald-50 disabled:opacity-50"
                      disabled={busyId === c.id}
                      onClick={() => void restoreClass(c.id)}
                    >
                      {busyId === c.id ? "…" : "Restore"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
