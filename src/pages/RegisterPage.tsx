import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Alert } from "../components/ui/Alert";
import { useRedirectIfAuthed } from "../hooks/useRedirectIfAuthed";
import { supabase } from "../lib/supabase";

export function RegisterPage() {
  const navigate = useNavigate();
  const { block: authGate } = useRedirectIfAuthed();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });
    if (signUpError) setError(signUpError.message);
    else navigate("/login");
    setLoading(false);
  };

  if (authGate) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
        <p className="text-slate-600">Loading…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <form onSubmit={onSubmit} className="w-full max-w-md rounded-xl bg-white p-6 shadow">
        <h1 className="mb-4 text-2xl font-bold text-slate-800">Teacher Register</h1>
        <input className="mb-3 w-full rounded border p-2" placeholder="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        <input className="mb-3 w-full rounded border p-2" placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className="mb-3 w-full rounded border p-2" placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error ? (
          <div className="mb-3">
            <Alert variant="error">{error}</Alert>
          </div>
        ) : null}
        <button className="w-full rounded bg-indigo-600 px-4 py-2 text-white disabled:opacity-50" disabled={loading}>
          {loading ? "Creating account..." : "Register"}
        </button>
        <p className="mt-4 text-sm text-slate-600">
          Already have an account? <Link to="/login" className="text-indigo-700">Login</Link>
        </p>
      </form>
    </div>
  );
}
