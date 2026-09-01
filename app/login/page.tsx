"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useCallback, useState } from "react";
import { GoogleSignInButton } from "../../components/google-sign-in-button";
import { AuthSession, login, loginWithGoogleCredential, register, saveSession } from "../../lib/fretcoach-api";
import styles from "./page.module.css";

export default function LoginPage() {
  return <Suspense fallback={<main className={styles.page}>Loading…</main>}><LoginForm /></Suspense>;
}

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const requestedNext = search.get("next");
  const next = requestedNext?.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : "/library";
  const completeSignIn = useCallback((session: AuthSession) => { saveSession(session); router.replace(next); }, [next, router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      const session = mode === "login"
        ? await login(String(data.get("email")), String(data.get("password")))
        : await register(String(data.get("email")), String(data.get("password")), String(data.get("displayName")));
      completeSignIn(session);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to sign in");
    } finally {
      setBusy(false);
    }
  }

  const signInWithGoogle = useCallback(async (credential: string) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      completeSignIn(await loginWithGoogleCredential(credential));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Google sign-in failed");
    } finally {
      setBusy(false);
    }
  }, [busy, completeSignIn]);

  return <main className={styles.page}>
    <Link href="/" className={styles.brand}><span>F</span>FretCoach</Link>
    <section className={styles.card}>
      <p>WELCOME TO FRETCOACH</p>
      <h1>{mode === "login" ? "Start practicing." : "Create your account."}</h1>
      <GoogleSignInButton disabled={busy} onCredential={signInWithGoogle} onError={setError} />
      <div className={styles.divider}><span>or continue with email</span></div>
      <form onSubmit={submit}>
        {mode === "register" && <label>Name<input name="displayName" required autoComplete="name" /></label>}
        <label>Email<input name="email" type="email" required autoComplete="email" /></label>
        <label>Password<input name="password" type="password" minLength={8} required autoComplete={mode === "login" ? "current-password" : "new-password"} /></label>
        {error && <output>{error}</output>}
        <button disabled={busy}>{busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}</button>
      </form>
      <button className={styles.switch} onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>
        {mode === "login" ? "New here? Create an account" : "Already have an account? Sign in"}
      </button>
    </section>
  </main>;
}
