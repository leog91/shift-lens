"use client";

import { useState, type FormEvent } from "react";
import { createAuthClient } from "better-auth/react";
import { useRouter } from "next/navigation";

const auth = createAuthClient();
export function HostedLogin() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const result = await auth.signIn.email({
        email: String(form.get("email") ?? "").trim(), password: String(form.get("password") ?? ""), rememberMe: false
      });
      if (result.error) throw new Error("Sign-in failed");
      router.replace("/dashboard");
      router.refresh();
    } catch { setError("Unable to sign in. Check your email and password, or try again later."); }
    finally { setBusy(false); }
  }
  return <form className="grid gap-3" onSubmit={login}>
    <label className="grid gap-1 text-sm" htmlFor="login-email">Email<input className="rounded border p-2" id="login-email" name="email" type="email" autoComplete="username" required maxLength={254} disabled={busy} /></label>
    <label className="grid gap-1 text-sm" htmlFor="login-password">Password<input className="rounded border p-2" id="login-password" name="password" type="password" autoComplete="current-password" required maxLength={128} disabled={busy} /></label>
    <button className="rounded bg-stone-900 px-4 py-2 text-white disabled:opacity-50" disabled={busy} type="submit">{busy ? "Signing in…" : "Sign in"}</button>
    {error ? <p role="alert">{error}</p> : null}
  </form>;
}

export function HostedLogout() {
  const router = useRouter();
  const [error, setError] = useState(false);
  return <div><button type="button" className="rounded border px-3 py-1" onClick={async () => {
    try {
      const result = await auth.signOut();
      if (result.error) throw new Error("Sign-out failed");
      router.replace("/");
      router.refresh();
    } catch { setError(true); }
  }}>Sign out</button>{error ? <p role="alert">Could not sign out. Please retry.</p> : null}</div>;
}
