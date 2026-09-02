"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthSession, clearSession, getSession } from "../lib/fretcoach-api";

export function HomeNavigation() {
  const pathname = usePathname();
  const [session, setSession] = useState<AuthSession | null>(null);

  useEffect(() => {
    const syncSession = () => setSession(getSession());
    syncSession();
    window.addEventListener("storage", syncSession);
    return () => window.removeEventListener("storage", syncSession);
  }, []);

  const displayName = session?.user.displayName || session?.user.email.split("@")[0] || "FretCoach user";
  const nameParts = displayName.match(/[\p{L}\p{N}]+/gu) ?? [];
  const initials = nameParts.map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "FC";
  const linkClass = (href: string) => pathname === href ? "navActive" : undefined;

  return <nav className="appNavigation" aria-label="Primary navigation">
    <Link className="brand" href="/" aria-label="FretCoach dashboard"><span className="brand-mark">F</span><span>FretCoach</span></Link>
    <div className="nav-actions">
      <Link className={linkClass("/")} href="/">Dashboard</Link>
      <Link className={linkClass("/library")} href="/library">Practice library</Link>
      <Link className={linkClass("/tabs")} href="/tabs">Public tabs</Link>
      {session && <Link className={linkClass("/my-songs")} href="/my-songs">My songs</Link>}
      {session && <Link className={linkClass("/history")} href="/history">History</Link>}
      {session ? <details className="profile-menu"><summary className="avatar" aria-label={`Open profile menu for ${displayName}`}>{initials}</summary><div><b>{displayName}</b><button onClick={() => { clearSession(); setSession(null); }}>Sign out</button></div></details> : <Link className="signIn" href="/login">Sign in</Link>}
    </div>
  </nav>;
}
