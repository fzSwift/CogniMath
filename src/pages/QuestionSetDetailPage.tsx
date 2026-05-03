import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useParams } from "react-router-dom";
import { Alert } from "../components/ui/Alert";
import { Card } from "../components/ui/Card";
import { supabase } from "../lib/supabase";
import type { Question } from "../types";

const difficultyNames: Record<number, string> = {
  1: "Level 1 Easy",
  2: "Level 2 Medium",
  3: "Level 3 Hard",
  4: "Level 4 Advanced",
  5: "Level 5 Challenge",
};

type AnswerLetter = "A" | "B" | "C" | "D";

const initialForm = {
  question_text: "",
  option_a: "",
  option_b: "",
  option_c: "",
  option_d: "",
  correct_answer: "A" as AnswerLetter,
  difficulty_level: 1,
  sequence_order: 1,
  points: 10,
};

type QuestionFormValues = typeof initialForm;

function questionToForm(q: Question): QuestionFormValues {
  const letter = String(q.correct_answer).toUpperCase();
  const letters: AnswerLetter[] = ["A", "B", "C", "D"];
  const correct = letters.includes(letter as AnswerLetter) ? (letter as AnswerLetter) : "A";
  return {
    question_text: q.question_text,
    option_a: q.option_a,
    option_b: q.option_b,
    option_c: q.option_c,
    option_d: q.option_d,
    correct_answer: correct,
    difficulty_level: q.difficulty_level,
    sequence_order: q.sequence_order,
    points: q.points,
  };
}

function optionForLetter(f: QuestionFormValues, letter: AnswerLetter) {
  switch (letter) {
    case "A":
      return f.option_a;
    case "B":
      return f.option_b;
    case "C":
      return f.option_c;
    case "D":
      return f.option_d;
    default:
      return "";
  }
}

function formValidationHints(f: QuestionFormValues): string[] {
  const hints: string[] = [];
  const stem = f.question_text.trim();
  if (stem.length > 0 && stem.length < 12) {
    hints.push("Stem is very short — check that the question reads clearly to students.");
  }
  const opts = [
    f.option_a.trim().toLowerCase(),
    f.option_b.trim().toLowerCase(),
    f.option_c.trim().toLowerCase(),
    f.option_d.trim().toLowerCase(),
  ];
  const seen = new Set<string>();
  for (let i = 0; i < opts.length; i++) {
    const o = opts[i];
    if (o.length === 0) continue;
    if (seen.has(o)) {
      hints.push("Two or more options have the same text — students may be confused.");
      break;
    }
    seen.add(o);
  }
  const correctText = optionForLetter(f, f.correct_answer).trim();
  if (correctText.length === 0 && (f.option_a || f.option_b || f.option_c || f.option_d)) {
    hints.push("The selected correct answer has empty option text.");
  }
  return hints;
}

export function QuestionSetDetailPage() {
  const { id } = useParams();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [form, setForm] = useState<QuestionFormValues>(initialForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [reorderBusy, setReorderBusy] = useState(false);
  const [dupBusyId, setDupBusyId] = useState<string | null>(null);

  const validationHints = useMemo(() => formValidationHints(form), [form]);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    const { data, error: qError } = await supabase
      .from("questions")
      .select("*")
      .eq("question_set_id", id)
      .order("difficulty_level", { ascending: true })
      .order("sequence_order", { ascending: true });
    if (qError) setError(qError.message);
    setQuestions((data ?? []) as Question[]);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, [id]);

  const saveQuestion = async (e: FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setSaveError("");
    const payload = { ...form, correct_answer: form.correct_answer };
    const res = editId
      ? await supabase.from("questions").update(payload).eq("id", editId)
      : await supabase.from("questions").insert({ ...payload, question_set_id: id });
    if (res.error) {
      setSaveError(res.error.message);
      return;
    }
    setForm(initialForm);
    setEditId(null);
    void load();
  };

  const removeQuestion = async (questionId: string) => {
    const msg =
      "Delete this question permanently?\n\n" +
      "This cannot be undone. Stored student_answers for this question will be removed (cascade). " +
      "Past attempt totals and scores in the database are unchanged, but answer-level review for this item will be gone.\n\n" +
      "Click OK to delete.";
    if (!confirm(msg)) return;
    setSaveError("");
    const { error: delErr } = await supabase.from("questions").delete().eq("id", questionId);
    if (delErr) {
      setSaveError(delErr.message);
      return;
    }
    if (editId === questionId) {
      setEditId(null);
      setForm(initialForm);
    }
    void load();
  };

  const duplicateQuestion = async (q: Question) => {
    if (!id) return;
    setDupBusyId(q.id);
    setSaveError("");
    const sameDiff = questions.filter((x) => x.difficulty_level === q.difficulty_level);
    const nextSeq = Math.max(0, ...sameDiff.map((x) => x.sequence_order)) + 1;
    const { error: insErr } = await supabase.from("questions").insert({
      question_set_id: id,
      question_text: q.question_text,
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c,
      option_d: q.option_d,
      correct_answer: q.correct_answer,
      difficulty_level: q.difficulty_level,
      sequence_order: nextSeq,
      points: q.points,
    });
    setDupBusyId(null);
    if (insErr) {
      setSaveError(insErr.message);
      return;
    }
    void load();
  };

  const swapSequenceWithNeighbor = async (q: Question, direction: "up" | "down") => {
    if (!id) return;
    const group = questions
      .filter((x) => x.difficulty_level === q.difficulty_level)
      .sort((a, b) => a.sequence_order - b.sequence_order);
    const idx = group.findIndex((x) => x.id === q.id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= group.length) return;
    const other = group[swapIdx];
    setReorderBusy(true);
    setSaveError("");
    const tempSeq = Math.max(...questions.map((x) => x.sequence_order), 0) + 10_000;
    const seqQ = q.sequence_order;
    const seqO = other.sequence_order;
    const r1 = await supabase.from("questions").update({ sequence_order: tempSeq }).eq("id", q.id);
    const r2 = await supabase.from("questions").update({ sequence_order: seqQ }).eq("id", other.id);
    const r3 = await supabase.from("questions").update({ sequence_order: seqO }).eq("id", q.id);
    setReorderBusy(false);
    const err = r1.error?.message || r2.error?.message || r3.error?.message;
    if (err) {
      setSaveError(err);
      void load();
      return;
    }
    void load();
  };

  const grouped = useMemo(() => {
    const map: Record<number, Question[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] };
    for (const q of questions) map[q.difficulty_level].push(q);
    for (const lv of [1, 2, 3, 4, 5] as const) {
      map[lv].sort((a, b) => a.sequence_order - b.sequence_order);
    }
    return map;
  }, [questions]);

  const previewOptions: { letter: AnswerLetter; text: string }[] = [
    { letter: "A", text: form.option_a },
    { letter: "B", text: form.option_b },
    { letter: "C", text: form.option_c },
    { letter: "D", text: form.option_d },
  ];

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-slate-600">
        Loading questions…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error ? <Alert variant="error">{error}</Alert> : null}
      <Card>
        <h3 className="mb-3 font-semibold">{editId ? "Edit Question" : "Add Question"}</h3>
        {saveError ? (
          <div className="mb-3">
            <Alert variant="error">{saveError}</Alert>
          </div>
        ) : null}
        {validationHints.length > 0 ? (
          <div className="mb-3 space-y-1">
            {validationHints.map((h, i) => (
              <Alert key={i} variant="info">
                {h}
              </Alert>
            ))}
          </div>
        ) : null}
        <form onSubmit={saveQuestion} className="grid gap-3 md:grid-cols-2">
          <textarea
            className="md:col-span-2 w-full rounded border p-2"
            placeholder="Question text"
            value={form.question_text}
            onChange={(e) => setForm({ ...form, question_text: e.target.value })}
            required
          />
          <input className="w-full rounded border p-2" placeholder="Option A" value={form.option_a} onChange={(e) => setForm({ ...form, option_a: e.target.value })} required />
          <input className="w-full rounded border p-2" placeholder="Option B" value={form.option_b} onChange={(e) => setForm({ ...form, option_b: e.target.value })} required />
          <input className="w-full rounded border p-2" placeholder="Option C" value={form.option_c} onChange={(e) => setForm({ ...form, option_c: e.target.value })} required />
          <input className="w-full rounded border p-2" placeholder="Option D" value={form.option_d} onChange={(e) => setForm({ ...form, option_d: e.target.value })} required />
          <label className="block text-sm md:col-span-2">
            <span className="mb-1 block text-slate-600">Correct answer</span>
            <select className="w-full max-w-xs rounded border p-2" value={form.correct_answer} onChange={(e) => setForm({ ...form, correct_answer: e.target.value as AnswerLetter })}>
              {(["A", "B", "C", "D"] as const).map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Difficulty (1–5)</span>
            <input className="w-full rounded border p-2" type="number" min={1} max={5} value={form.difficulty_level} onChange={(e) => setForm({ ...form, difficulty_level: Number(e.target.value) })} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Sequence in level</span>
            <input className="w-full rounded border p-2" type="number" min={1} value={form.sequence_order} onChange={(e) => setForm({ ...form, sequence_order: Number(e.target.value) })} />
          </label>
          <label className="block text-sm md:col-span-2">
            <span className="mb-1 block text-slate-600">Points</span>
            <input className="w-full max-w-xs rounded border p-2" type="number" min={1} value={form.points} onChange={(e) => setForm({ ...form, points: Number(e.target.value) })} />
          </label>
          <button type="submit" className="rounded bg-indigo-600 px-4 py-2 text-white">
            {editId ? "Update Question" : "Add Question"}
          </button>
          {editId ? (
            <button
              type="button"
              className="rounded border border-slate-300 px-4 py-2 text-sm"
              onClick={() => {
                setEditId(null);
                setForm(initialForm);
                setSaveError("");
              }}
            >
              Cancel edit
            </button>
          ) : null}
        </form>
      </Card>

      <Card>
        <h3 className="mb-2 font-semibold">Student preview</h3>
        <p className="mb-3 text-xs text-slate-500">
          How the stem and choices appear in the client. The correct choice is highlighted only here for authoring — Unity would not reveal it during a
          quiz.
        </p>
        {form.question_text.trim() || form.option_a || form.option_b || form.option_c || form.option_d ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
            <p className="mb-4 font-medium text-slate-900">{form.question_text.trim() || "(No question text yet)"}</p>
            <ul className="space-y-2">
              {previewOptions.map(({ letter, text }) => {
                const isCorrect = letter === form.correct_answer;
                return (
                  <li
                    key={letter}
                    className={`rounded-md border px-3 py-2 ${isCorrect ? "border-indigo-400 bg-indigo-50 ring-1 ring-indigo-200" : "border-slate-200 bg-white"}`}
                  >
                    <span className="font-mono font-semibold text-slate-600">{letter}.</span> {text.trim() || "(empty)"}
                    {isCorrect ? <span className="ml-2 text-xs font-medium text-indigo-700">(marked correct — preview only)</span> : null}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-slate-600">Fill the form above to see a live preview.</p>
        )}
      </Card>

      {Object.entries(grouped).map(([level, list]) => (
        <Card key={level}>
          <h4 className="mb-3 font-semibold">{difficultyNames[Number(level)]}</h4>
          <div className="space-y-3">
            {list.map((q, i) => (
              <div key={q.id} className="rounded border p-3 text-sm">
                <p className="font-medium">
                  {q.sequence_order}. {q.question_text}
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  A: {q.option_a} · B: {q.option_b} · C: {q.option_c} · D: {q.option_d}
                </p>
                <p className="text-slate-600">
                  Answer: {q.correct_answer} | Points: {q.points}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={reorderBusy || i === 0}
                    className="rounded border border-slate-300 px-2 py-1 text-xs font-medium hover:bg-slate-50 disabled:opacity-40"
                    onClick={() => void swapSequenceWithNeighbor(q, "up")}
                    title="Move earlier in this difficulty level"
                  >
                    Move up
                  </button>
                  <button
                    type="button"
                    disabled={reorderBusy || i === list.length - 1}
                    className="rounded border border-slate-300 px-2 py-1 text-xs font-medium hover:bg-slate-50 disabled:opacity-40"
                    onClick={() => void swapSequenceWithNeighbor(q, "down")}
                    title="Move later in this difficulty level"
                  >
                    Move down
                  </button>
                  <button
                    type="button"
                    className="rounded bg-slate-800 px-3 py-1 text-xs text-white"
                    onClick={() => {
                      setEditId(q.id);
                      setForm(questionToForm(q));
                      setSaveError("");
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={dupBusyId === q.id}
                    className="rounded border border-indigo-300 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-900 hover:bg-indigo-100 disabled:opacity-50"
                    onClick={() => void duplicateQuestion(q)}
                  >
                    {dupBusyId === q.id ? "Duplicating…" : "Duplicate"}
                  </button>
                  <button type="button" className="rounded bg-red-600 px-3 py-1 text-xs text-white" onClick={() => void removeQuestion(q.id)}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
