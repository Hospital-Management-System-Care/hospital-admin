"use client";

import { useState } from "react";
import { signInPlatformAdmin } from "@/lib/adminApi";

export default function AdminLogin({ onSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      await signInPlatformAdmin({ email, password });
      onSuccess();
    } catch (loginError) {
      setError(loginError.message || "Unable to sign in.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="mx-auto mt-16 w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-xl font-bold">Support team sign in</h1>
      <p className="mt-1 text-sm text-slate-600">Use an active platform administrator account to review payment proofs.</p>
      <label className="mt-5 block text-sm font-semibold">Email
        <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-teal-700" />
      </label>
      <label className="mt-4 block text-sm font-semibold">Password
        <input required type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-teal-700" />
      </label>
      {error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}
      <button disabled={saving} className="mt-5 w-full rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{saving ? "Signing in…" : "Sign in"}</button>
    </form>
  );
}
