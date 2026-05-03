import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Alert } from "../components/ui/Alert";
import { Card } from "../components/ui/Card";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import type { Profile } from "../types";

export function SettingsPage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState("");
  const [fullNameEdit, setFullNameEdit] = useState("");
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");
  const [profileErr, setProfileErr] = useState("");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwdBusy, setPwdBusy] = useState(false);
  const [pwdMsg, setPwdMsg] = useState("");
  const [pwdErr, setPwdErr] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setLoading(false);
        return;
      }
      setEmail(userData.user.email ?? "");
      const { data, error: pErr } = await supabase.from("profiles").select("*").eq("id", userData.user.id).single();
      if (pErr) setError(pErr.message);
      const p = data as Profile | null;
      setProfile(p);
      setFullNameEdit(p?.full_name ?? "");
      setLoading(false);
    };
    void load();
  }, []);

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    setProfileErr("");
    setProfileMsg("");
    setProfileBusy(true);
    const { error: uErr } = await supabase.from("profiles").update({ full_name: fullNameEdit.trim() }).eq("id", userData.user.id);
    setProfileBusy(false);
    if (uErr) {
      setProfileErr(uErr.message);
      return;
    }
    setProfile((prev) => (prev ? { ...prev, full_name: fullNameEdit.trim() } : prev));
    setProfileMsg("Display name saved.");
  };

  const savePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPwdErr("");
    setPwdMsg("");
    if (newPassword.length < 6) {
      setPwdErr("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdErr("New password and confirmation do not match.");
      return;
    }
    setPwdBusy(true);
    const { error: pwErr } = await supabase.auth.updateUser({ password: newPassword });
    setPwdBusy(false);
    if (pwErr) {
      setPwdErr(pwErr.message);
      return;
    }
    setNewPassword("");
    setConfirmPassword("");
    setPwdMsg("Password updated.");
  };

  const logout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  if (loading) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center text-slate-600">
        Loading profile…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {error ? (
        <div>
          <Alert variant="error">{error}</Alert>
        </div>
      ) : null}

      <Card>
        <h3 className="mb-2 text-lg font-semibold">Teacher profile</h3>
        <p className="mb-4 text-sm text-slate-600">Your display name is shown across the dashboard. Email comes from your login account and cannot be changed here.</p>
        <form onSubmit={saveProfile} className="space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Email</span>
            <input className="w-full cursor-not-allowed rounded border border-slate-200 bg-slate-50 p-2 text-slate-600" readOnly value={email || "—"} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Display name</span>
            <input
              className="w-full rounded border border-slate-300 p-2"
              value={fullNameEdit}
              onChange={(e) => setFullNameEdit(e.target.value)}
              required
              minLength={1}
            />
          </label>
          <p className="text-xs text-slate-500">
            Role: <span className="font-medium text-slate-700">{profile?.role ?? "teacher"}</span>
            {profile?.role === "admin"
              ? " — platform admin: RLS allows access to every teacher’s classes and students."
              : " — teacher accounts only see their own classes, enrollments, and students they created."}
          </p>
          {profileErr ? <Alert variant="error">{profileErr}</Alert> : null}
          {profileMsg ? <Alert variant="info">{profileMsg}</Alert> : null}
          <button type="submit" disabled={profileBusy} className="rounded bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 disabled:opacity-50">
            {profileBusy ? "Saving…" : "Save display name"}
          </button>
        </form>
      </Card>

      <Card>
        <h3 className="mb-2 text-lg font-semibold">Security</h3>
        <p className="mb-4 text-sm text-slate-600">Set a new password for this account. You must be signed in.</p>
        <form onSubmit={savePassword} className="space-y-3 max-w-md">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">New password</span>
            <input
              className="w-full rounded border border-slate-300 p-2"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={6}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Confirm new password</span>
            <input
              className="w-full rounded border border-slate-300 p-2"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={6}
            />
          </label>
          {pwdErr ? <Alert variant="error">{pwdErr}</Alert> : null}
          {pwdMsg ? <Alert variant="info">{pwdMsg}</Alert> : null}
          <button type="submit" disabled={pwdBusy || !newPassword} className="rounded bg-slate-800 px-4 py-2 text-white hover:bg-slate-900 disabled:opacity-50">
            {pwdBusy ? "Updating…" : "Update password"}
          </button>
        </form>
      </Card>

      <Card>
        <h3 className="mb-2 text-lg font-semibold">Connection</h3>
        <p className="text-sm text-slate-700">
          Supabase client:{" "}
          {isSupabaseConfigured ? (
            <span className="font-medium text-green-700">Environment configured</span>
          ) : (
            <span className="font-medium text-amber-800">Missing URL or anon key — check .env</span>
          )}
        </p>
        <p className="mt-2 text-xs text-slate-500">Profile loaded {profile ? "successfully" : "with errors"} from your project.</p>
      </Card>

      <Card>
        <h3 className="mb-2 text-lg font-semibold">About</h3>
        <p className="text-sm font-medium text-slate-800">CogniMath — Teacher dashboard</p>
        <p className="mt-2 text-sm text-slate-600">
          Web dashboard for teachers: classes, students, question sets, join codes, and analytics. Students typically use the Unity client; this app is for
          rostering, content, and insight.
        </p>
        <p className="mt-3 text-xs text-slate-500">
          Build mode: <span className="font-mono">{import.meta.env.MODE}</span>
        </p>
      </Card>

      <Card>
        <h3 className="mb-2 text-lg font-semibold">Data &amp; privacy</h3>
        <ul className="list-inside list-disc space-y-2 text-sm text-slate-600">
          <li>Teaching data (classes, students, attempts, answers) is stored in your Supabase project and protected by row-level security for signed-in teachers.</li>
          <li>This dashboard is teacher-only; do not share teacher credentials.</li>
          <li>Student names and usernames are entered by teachers or join requests — handle them according to your institution&apos;s policies.</li>
        </ul>
      </Card>

      <Card>
        <h3 className="mb-2 text-lg font-semibold">Session</h3>
        <button type="button" className="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700" onClick={() => void logout()}>
          Log out
        </button>
      </Card>
    </div>
  );
}
