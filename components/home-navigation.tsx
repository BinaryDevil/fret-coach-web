"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AuthSession, clearSession, getSession } from "../lib/fretcoach-api";

export function HomeNavigation() {
  const [session, setSession] = useState<AuthSession | null>(null);

  useEffect(() => {
    const syncSession = () => setSession(getSession());
    syncSession();
    window.addEventListener("storage", syncSession);
    return () => window.removeEventListener("storage", syncSession);
  }, []);

  const displayName = session?.user.displayName || session?.user.email.split("@")[0];
  const initials = displayName?.trim().split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "FC";

  return <nav className="topbar" aria-label="Primary navigation">
    <Link className="brand" href="/" aria-label="FretCoach home"><span className="brand-mark">F</span><span>FretCoach</span></Link>
    <div className="nav-actions">
      <Link href="/library">Practice library</Link>
      <a href="#progress">Progress</a>
      {session ? <details className="profile-menu"><summary className="avatar" aria-label={`Open profile menu for ${displayName}`}>{initials}</summary><div><b>{displayName}</b><button onClick={() => { clearSession(); setSession(null); }}>Sign out</button></div></details> : <Link className="signIn" href="/login">Sign in</Link>}
    </div>
  </nav>;
}
