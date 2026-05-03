import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { Alert } from "../components/ui/Alert";
import { Card } from "../components/ui/Card";
import { supabase } from "../lib/supabase";
import type { ClassRoom, QuestionSet } from "../types";

export function QuestionSetsPage() {
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [sets, setSets] = useState<QuestionSet[]>([]);
  const [form, setForm] = useState({
    class_id: "",
    title: "",
    topic: "",
    description: "",
    threshold_score: 70,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [createError, setCreateError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    const [classRes, setsRes] = await Promise.all([
      supabase.from("classes").select("*").is("archived_at", null),
      supabase.from("question_sets").select("*").order("created_at", { ascending: false }),
    ]);
    const err = classRes.error?.message || setsRes.error?.message;
    if (err) setError(err);
    setClasses((classRes.data ?? []) as ClassRoom[]);
    setSets((setsRes.data ?? []) as QuestionSet[]);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    setCreateError("");
    const { error: insErr } = await supabase.from("question_sets").insert({ ...form, teacher_id: userData.user.id });
    if (insErr) {
      setCreateError(insErr.message);
      return;
    }
    setForm({ class_id: "", title: "", topic: "", description: "", threshold_score: 70 });
    void load();
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-slate-600">
        Loading question sets…
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {error ? (
        <div className="lg:col-span-3">
          <Alert variant="error">{error}</Alert>
        </div>
      ) : null}
      <Card>
        <h3 className="mb-3 font-semibold">Create Question Set</h3>
        {createError ? (
          <div className="mb-3">
            <Alert variant="error">{createError}</Alert>
          </div>
        ) : null}
        <form onSubmit={create} className="space-y-3">
          <select className="w-full rounded border p-2" value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value })} required>
            <option value="">Select class</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.class_name}
              </option>
            ))}
          </select>
          <input className="w-full rounded border p-2" placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          <input className="w-full rounded border p-2" placeholder="Topic" value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} required />
          <textarea className="w-full rounded border p-2" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <input
            className="w-full rounded border p-2"
            type="number"
            min={0}
            max={100}
            placeholder="Threshold score"
            value={form.threshold_score}
            onChange={(e) => setForm({ ...form, threshold_score: Number(e.target.value) })}
            required
          />
          <button type="submit" className="rounded bg-indigo-600 px-4 py-2 text-white">
            Save Question Set
          </button>
        </form>
      </Card>
      <div className="space-y-3 lg:col-span-2">
        {sets.map((qs) => (
          <Link key={qs.id} to={`/question-sets/${qs.id}`} className="block rounded-xl border bg-white p-4 hover:border-indigo-300">
            <h4 className="font-semibold">{qs.title}</h4>
            <p className="text-sm text-slate-500">
              {qs.topic} — threshold {qs.threshold_score}%
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
